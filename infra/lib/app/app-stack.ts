import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config';
import { FargateService } from '../../constructs/fargate-service';
import { SecretSidecar } from '../../constructs/secret-sidecar';

interface AppStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  appSecret: secretsmanager.ISecret;
  fargateSecurityGroup: ec2.SecurityGroup;
}

export class AppStack extends cdk.Stack {
  readonly frontendService: ecs.FargateService;
  readonly backendService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const { config, vpc, appSecret, fargateSecurityGroup } = props;
    const envLower = config.envName.toLowerCase();

    // sidecar イメージは infra/constructs/sidecar/ をビルドして ECR にプッシュしておく
    const sidecarImageUri = `${config.env.account}.dkr.ecr.${config.env.region}.amazonaws.com/credit-checker-sidecar:latest`;

    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: `credit-checker-${envLower}`,
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
          `arn:aws:secretsmanager:${config.env.region}:${config.env.account}:secret:/credit-checker/${envLower}/*`,
        ],
      }),
    );

    // --- ECR リポジトリ ---
    const frontendRepo = new ecr.Repository(this, 'FrontendRepo', {
      repositoryName: 'credit-checker-frontend',
    });

    const backendRepo = new ecr.Repository(this, 'BackendRepo', {
      repositoryName: 'credit-checker-backend',
    });

    new ecr.Repository(this, 'MigratorRepo', {
      repositoryName: 'credit-checker-backend-migrator',
    });

    // --- Frontend Task Definition ---
    const frontendTask = new ecs.FargateTaskDefinition(this, 'FrontendTask', {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: taskExecutionRole,
      family: `credit-checker-frontend-${envLower}`,
    });

    new SecretSidecar(this, 'FrontendSidecar', {
      taskDefinition: frontendTask,
      appSecret,
      sidecarImageUri,
      secretKeys: ['auth_secret', 'auth_google_secret'],
    });

    const frontendContainer = frontendTask.addContainer('frontend', {
      image: ecs.ContainerImage.fromEcrRepository(frontendRepo, 'latest'),
      portMappings: [{ containerPort: 3000 }],
      environment: {
        AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID ?? '',
        BACKEND_URL: `https://${config.domain}/api/v1`,
        NEXT_PUBLIC_BACKEND_URL: `https://${config.domain}/api/v1`,
        AUTH_URL: `https://${config.domain}`,
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'frontend' }),
    });

    frontendContainer.addMountPoints({
      containerPath: '/run/secrets',
      sourceVolume: 'secrets-volume',
      readOnly: true,
    });

    // --- Backend Task Definition ---
    const backendTask = new ecs.FargateTaskDefinition(this, 'BackendTask', {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: taskExecutionRole,
      family: `credit-checker-backend-${envLower}`,
    });

    new SecretSidecar(this, 'BackendSidecar', {
      taskDefinition: backendTask,
      appSecret,
      sidecarImageUri,
      secretKeys: ['jwt_secret', 'auth_secret', 'auth_google_secret', 'openai_api_key', 'database_url'],
    });

    const backendContainer = backendTask.addContainer('backend', {
      image: ecs.ContainerImage.fromEcrRepository(backendRepo, 'latest'),
      portMappings: [{ containerPort: 3003 }],
      environment: {
        NODE_ENV: 'production',
        AWS_REGION: config.env.region,
        FRONTEND_URL: `https://${config.domain}`,
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'backend' }),
    });

    backendContainer.addMountPoints({
      containerPath: '/run/secrets',
      sourceVolume: 'secrets-volume',
      readOnly: true,
    });

    // --- Migration Task Definition ---
    const migratorTask = new ecs.FargateTaskDefinition(this, 'MigratorTask', {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: taskExecutionRole,
      family: `credit-checker-migrator-${envLower}`,
    });

    new SecretSidecar(this, 'MigratorSidecar', {
      taskDefinition: migratorTask,
      appSecret,
      sidecarImageUri,
      secretKeys: ['database_url'],
    });

    migratorTask.addContainer('migrator', {
      image: ecs.ContainerImage.fromEcrRepository(
        ecr.Repository.fromRepositoryName(this, 'MigratorRepoRef', 'credit-checker-backend-migrator'),
        'latest',
      ),
      essential: true,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'migrator' }),
    });

    // --- ECS Services ---
    const frontendFargate = new FargateService(this, 'FrontendService', {
      cluster,
      taskDefinition: frontendTask,
      securityGroup: fargateSecurityGroup,
      minCapacity: config.scaling.frontend.minCapacity,
      maxCapacity: config.scaling.frontend.maxCapacity,
      desiredCount: config.scaling.frontend.minCapacity,
    });

    const backendFargate = new FargateService(this, 'BackendService', {
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
