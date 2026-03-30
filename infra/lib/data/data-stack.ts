import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config';

interface DataStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  rdsSecurityGroup: ec2.SecurityGroup;
}

export class DataStack extends cdk.Stack {
  readonly appSecret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { config, vpc, rdsSecurityGroup } = props;
    const envLower = config.envName.toLowerCase();
    const region = config.env.region;
    const account = config.env.account;

    const dbInstance = new rds.DatabaseInstance(this, 'Postgres', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: new ec2.InstanceType(config.rds.instanceType),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSecurityGroup],
      multiAz: config.rds.multiAz,
      databaseName: 'credit_checker',
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    // アプリ用 Secrets Manager（strong secrets）
    this.appSecret = new secretsmanager.Secret(this, 'AppSecret', {
      secretName: `/credit-checker/${envLower}/app-secrets`,
      description: 'Application secrets for credit-checker',
      secretObjectValue: {
        jwt_secret: cdk.SecretValue.unsafePlainText('REPLACE_ME'),
        auth_secret: cdk.SecretValue.unsafePlainText('REPLACE_ME'),
        auth_google_secret: cdk.SecretValue.unsafePlainText('REPLACE_ME'),
        openai_api_key: cdk.SecretValue.unsafePlainText('REPLACE_ME'),
        // RDS 接続文字列は RDS シークレットから組み立てる
      },
    });

    // ECS Task Execution Role（Secrets Manager 読み取りに使用）
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy',
        ),
      ],
    });

    // Fargate sidecar が Secrets Manager を読めるように付与
    taskExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${region}:${account}:secret:/credit-checker/${envLower}/*`,
        ],
      }),
    );

    // RDS シークレットも読めるように
    if (dbInstance.secret) {
      dbInstance.secret.grantRead(taskExecutionRole);
    }

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: dbInstance.instanceEndpoint.hostname,
    });
    new cdk.CfnOutput(this, 'AppSecretArn', {
      value: this.appSecret.secretArn,
    });
  }
}
