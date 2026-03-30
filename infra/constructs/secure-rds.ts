import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

interface SecureRdsProps {
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
  instanceType: string;
  multiAz: boolean;
  databaseName: string;
}

export class SecureRds extends Construct {
  readonly instance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: SecureRdsProps) {
    super(scope, id);

    this.instance = new rds.DatabaseInstance(this, 'Instance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: new ec2.InstanceType(props.instanceType),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.securityGroup],
      multiAz: props.multiAz,
      databaseName: props.databaseName,
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });
  }
}
