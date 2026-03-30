import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config';
import { SecureRds } from '../../constructs/secure-rds';

interface DataStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  rdsSecurityGroup: ec2.SecurityGroup;
}

export class DataStack extends cdk.Stack {
  readonly appSecret: secretsmanager.ISecret;
  readonly receiptsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { config, vpc, rdsSecurityGroup } = props;
    const envLower = config.envName.toLowerCase();

    const rdsConstruct = new SecureRds(this, 'Postgres', {
      vpc,
      securityGroup: rdsSecurityGroup,
      instanceType: config.rds.instanceType,
      multiAz: config.rds.multiAz,
      databaseName: config.rds.databaseName,
    });

    // アプリ用 Secrets Manager（strong secrets）
    // 初回デプロイ後、Secrets Manager コンソールで REPLACE_ME を実際の値に更新すること
    this.appSecret = new secretsmanager.Secret(this, 'AppSecret', {
      secretName: `/credit-checker/${envLower}/app-secrets`,
      description: 'Application secrets for credit-checker',
      secretObjectValue: {
        jwt_secret: cdk.SecretValue.unsafePlainText('REPLACE_ME'),
        auth_secret: cdk.SecretValue.unsafePlainText('REPLACE_ME'),
        auth_google_secret: cdk.SecretValue.unsafePlainText('REPLACE_ME'),
        openai_api_key: cdk.SecretValue.unsafePlainText('REPLACE_ME'),
        // RDS 接続文字列。初回デプロイ後に RDS エンドポイントを確認して設定する
        // 形式: postgresql://<user>:<password>@<host>:5432/<dbname>
        database_url: cdk.SecretValue.unsafePlainText('REPLACE_ME'),
      },
    });

    this.receiptsBucket = new s3.Bucket(this, 'ReceiptsBucket', {
      bucketName: config.s3BucketName,
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
      value: this.receiptsBucket.bucketName,
    });
  }
}
