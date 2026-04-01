import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config';

interface NetworkStackProps extends cdk.StackProps {
  appName: string;
  config: EnvironmentConfig;
}

export class NetworkStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;
  readonly albSecurityGroup: ec2.SecurityGroup;
  readonly fargateSecurityGroup: ec2.SecurityGroup;
  readonly rdsSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { appName, config } = props;

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: config.vpc.maxAzs,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      // S3 Gateway Endpoint（無料、S3 通信をインターネットに出さない）
      gatewayEndpoints: {
        S3: {
          service: ec2.GatewayVpcEndpointAwsService.S3,
        },
      },
    });

    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc: this.vpc,
      description: 'ALB security group',
    });
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));

    this.fargateSecurityGroup = new ec2.SecurityGroup(this, 'FargateSg', {
      vpc: this.vpc,
      description: 'Fargate tasks security group',
      // 最小権限：明示的に許可したアウトバウンドのみ許可
      allowAllOutbound: false,
    });
    // CDKはSGにNameタグを自動付与しないため明示的に設定する
    // 同一アカウントに複数アプリが共存する構成のためappNameで識別する
    cdk.Tags.of(this.fargateSecurityGroup).add('Name', `${appName}-FargateSg-${config.envName.toLowerCase()}`);
    // ALB からのトラフィックのみ受け入れる（frontend / backend のアプリポートに限定）
    this.fargateSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(this.albSecurityGroup.securityGroupId),
      ec2.Port.tcp(config.ports.frontend),
      'Allow frontend traffic from ALB',
    );
    this.fargateSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(this.albSecurityGroup.securityGroupId),
      ec2.Port.tcp(config.ports.backend),
      'Allow backend traffic from ALB',
    );
    // HTTPS アウトバウンド（ECR / Secrets Manager / AWS API）
    this.fargateSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS outbound',
    );

    this.rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSg', {
      vpc: this.vpc,
      description: 'RDS security group',
    });

    // connections API で Fargate → RDS の双方向ルールを設定
    // （CDK が SecurityGroupIngress/Egress を別リソースとして生成し循環依存を回避）
    this.fargateSecurityGroup.connections.allowTo(
      this.rdsSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Fargate to connect to RDS',
    );

    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId });
  }
}
