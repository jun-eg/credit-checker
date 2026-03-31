import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config';
import { FargateService } from '../../constructs/fargate-service';

interface AppStackProps extends cdk.StackProps {
  appName: string;
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  appSecret: secretsmanager.ISecret;
  fargateSecurityGroup: ec2.SecurityGroup;
  appBucket: s3.IBucket;
}

export class AppStack extends cdk.Stack {
  readonly frontendService: ecs.FargateService;
  readonly backendService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const { appName, config, vpc, appSecret, fargateSecurityGroup, appBucket } = props;
    const envLower = config.envName.toLowerCase();

    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: `${appName}-${envLower}`,
    });

    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy',
        ),
      ],
    });

    taskExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${config.env.region}:${config.env.account}:secret:/${appName}/${envLower}/*`,
        ],
      }),
    );

    // github-actions-deploy-roleはCDK外で管理されているためfromRoleArnで参照
    const deployRole = iam.Role.fromRoleArn(
      this,
      'DeployRole',
      `arn:aws:iam::${config.env.account}:role/github-actions-deploy-role`,
    );

    // CIがregister-task-definitionでSHAタグのリビジョンを登録するために必要な権限
    deployRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'ecs:RegisterTaskDefinition',
          'ecs:DescribeTaskDefinition',
          'ecs:DescribeServices',
        ],
        resources: ['*'],
      }),
    );

    // register-task-definitionでexecutionRoleを渡すために必要
    deployRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [taskExecutionRole.roleArn],
      }),
    );

    // --- Frontend Task Role ---
    const frontendTaskRole = new iam.Role(this, 'FrontendTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    frontendTaskRole.addToPolicy(
      new iam.PolicyStatement({
        // ECS Exec (ecs-exec.md) に必要
        actions: [
          'ssmmessages:CreateControlChannel',
          'ssmmessages:CreateDataChannel',
          'ssmmessages:OpenControlChannel',
          'ssmmessages:OpenDataChannel',
        ],
        resources: ['*'],
      }),
    );

    // --- ECR リポジトリ ---
    const frontendRepo = new ecr.Repository(this, 'FrontendRepo', {
      repositoryName: `${appName}-frontend`,
    });

    const backendRepo = new ecr.Repository(this, 'BackendRepo', {
      repositoryName: `${appName}-backend`,
    });

    new ecr.Repository(this, 'MigratorRepo', {
      repositoryName: `${appName}-backend-migrator`,
    });

    // --- Frontend Task Definition ---
    const frontendTask = new ecs.FargateTaskDefinition(this, 'FrontendTask', {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: taskExecutionRole,
      taskRole: frontendTaskRole,
      family: `${appName}-frontend-${envLower}`,
    });

    frontendTask.addContainer('frontend', {
      // CI（reusable-app-deploy.yml）がデプロイ時にSHAタグで register-task-definition を実行する。
      // このlatestはCDK初回デプロイ時のプレースホルダーであり、実運用では使われない。
      image: ecs.ContainerImage.fromEcrRepository(frontendRepo, 'latest'),
      portMappings: [{ containerPort: config.ports.frontend }],
      environment: {
        NODE_ENV: config.nodeEnv,
        FRONTEND_PORT: String(config.ports.frontend),
        AUTH_GOOGLE_ID: config.authGoogleId,
        BACKEND_URL: `https://${config.domain}/api/v1`,
        NEXT_PUBLIC_BACKEND_URL: `https://${config.domain}/api/v1`,
        AUTH_URL: `https://${config.domain}`,
      },
      secrets: {
        AUTH_SECRET: ecs.Secret.fromSecretsManager(appSecret, 'auth_secret'),
        AUTH_GOOGLE_SECRET: ecs.Secret.fromSecretsManager(appSecret, 'auth_google_secret'),
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'frontend' }),
    });

    // --- Backend Task Definition ---
    const backendTaskRole = new iam.Role(this, 'BackendTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    appBucket.grantReadWrite(backendTaskRole);

    backendTaskRole.addToPolicy(
      new iam.PolicyStatement({
        // ECS Exec (ecs-exec.md) に必要
        actions: [
          'ssmmessages:CreateControlChannel',
          'ssmmessages:CreateDataChannel',
          'ssmmessages:OpenControlChannel',
          'ssmmessages:OpenDataChannel',
        ],
        resources: ['*'],
      }),
    );

    const backendTask = new ecs.FargateTaskDefinition(this, 'BackendTask', {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: taskExecutionRole,
      taskRole: backendTaskRole,
      family: `${appName}-backend-${envLower}`,
    });

    backendTask.addContainer('backend', {
      // CI（reusable-app-deploy.yml）がデプロイ時にSHAタグで register-task-definition を実行する。
      // このlatestはCDK初回デプロイ時のプレースホルダーであり、実運用では使われない。
      image: ecs.ContainerImage.fromEcrRepository(backendRepo, 'latest'),
      portMappings: [{ containerPort: config.ports.backend }],
      environment: {
        NODE_ENV: config.nodeEnv,
        BACKEND_PORT: String(config.ports.backend),
        DATABASE_SSL: String(config.databaseSsl),
        TYPEORM_LOGGING: String(config.typeormLogging),
        AWS_REGION: config.env.region,
        S3_BUCKET_NAME: appBucket.bucketName,
        FRONTEND_URL: `https://${config.domain}`,
      },
      secrets: {
        JWT_SECRET: ecs.Secret.fromSecretsManager(appSecret, 'jwt_secret'),
        OPENAI_API_KEY: ecs.Secret.fromSecretsManager(appSecret, 'openai_api_key'),
        DATABASE_URL: ecs.Secret.fromSecretsManager(appSecret, 'database_url'),
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'backend' }),
    });

    // --- Migration Task Definition ---
    const migratorTask = new ecs.FargateTaskDefinition(this, 'MigratorTask', {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: taskExecutionRole,
      family: `${appName}-migrator-${envLower}`,
    });

    migratorTask.addContainer('migrator', {
      // CI（reusable-app-deploy.yml）がデプロイ時にSHAタグで register-task-definition を実行する。
      // このlatestはCDK初回デプロイ時のプレースホルダーであり、実運用では使われない。
      image: ecs.ContainerImage.fromEcrRepository(
        ecr.Repository.fromRepositoryName(this, 'MigratorRepoRef', `${appName}-backend-migrator`),
        'latest',
      ),
      essential: true,
      environment: {
        NODE_ENV: config.nodeEnv,
        DATABASE_SSL: String(config.databaseSsl),
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(appSecret, 'database_url'),
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'migrator' }),
    });

    // --- ECS Services ---
    const frontendFargate = new FargateService(this, 'FrontendService', {
      serviceName: `${appName}-frontend-${envLower}`,
      cluster,
      taskDefinition: frontendTask,
      securityGroup: fargateSecurityGroup,
      minCapacity: config.scaling.frontend.minCapacity,
      maxCapacity: config.scaling.frontend.maxCapacity,
      desiredCount: config.scaling.frontend.minCapacity,
    });

    const backendFargate = new FargateService(this, 'BackendService', {
      serviceName: `${appName}-backend-${envLower}`,
      cluster,
      taskDefinition: backendTask,
      securityGroup: fargateSecurityGroup,
      minCapacity: config.scaling.backend.minCapacity,
      maxCapacity: config.scaling.backend.maxCapacity,
      desiredCount: config.scaling.backend.minCapacity,
    });

    this.frontendService = frontendFargate.service;
    this.backendService = backendFargate.service;

    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
  }
}
