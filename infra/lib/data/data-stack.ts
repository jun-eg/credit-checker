import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config';
import { SecureRds } from '../../constructs/secure-rds';

interface DataStackProps extends cdk.StackProps {
  appName: string;
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  rdsSecurityGroup: ec2.SecurityGroup;
}

export class DataStack extends cdk.Stack {
  readonly appSecret: secretsmanager.ISecret;
  readonly appBucket: s3.Bucket;
  /** RDS が自動生成した認証情報シークレット（username / password / host / port / dbname） */
  readonly rdsSecret: secretsmanager.ISecret;
  /** CDK デプロイ時に自動生成される JWT 署名シークレット */
  readonly jwtSecret: secretsmanager.Secret;
  /** CDK デプロイ時に自動生成される NextAuth シークレット */
  readonly authSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { appName, config, vpc, rdsSecurityGroup } = props;
    const envLower = config.envName.toLowerCase();

    const rdsConstruct = new SecureRds(this, 'Postgres', {
      vpc,
      securityGroup: rdsSecurityGroup,
      instanceType: config.rds.instanceType,
      multiAz: config.rds.multiAz,
      databaseName: config.rds.databaseName,
    });

    this.rdsSecret = rdsConstruct.instance.secret!;

    // デプロイ時に自動生成。以降の再デプロイでは上書きされない
    this.jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: `/${appName}/${envLower}/jwt-secret`,
      description: `JWT signing secret for ${appName} (auto-generated)`,
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 64,
      },
    });

    this.authSecret = new secretsmanager.Secret(this, 'AuthSecret', {
      secretName: `/${appName}/${envLower}/auth-secret`,
      description: `NextAuth secret for ${appName} (auto-generated)`,
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 64,
      },
    });

    // 外部サービス依存のシークレット（初回デプロイ後に手動で REPLACE_ME を更新すること）
    this.appSecret = new secretsmanager.Secret(this, 'AppSecret', {
      secretName: `/${appName}/${envLower}/app-secrets`,
      description: `External service secrets for ${appName}`,
      secretObjectValue: {
        auth_google_secret: cdk.SecretValue.unsafePlainText('REPLACE_ME'),
        openai_api_key: cdk.SecretValue.unsafePlainText('REPLACE_ME'),
      },
    });

    this.appBucket = new s3.Bucket(this, 'AppBucket', {
      bucketName: `${appName}-${envLower}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: rdsConstruct.instance.instanceEndpoint.hostname,
    });
    new cdk.CfnOutput(this, 'AppSecretArn', {
      value: this.appSecret.secretArn,
    });
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.appBucket.bucketName,
    });
  }
}
