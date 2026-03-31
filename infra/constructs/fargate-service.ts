import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

interface FargateServiceProps {
  serviceName: string;
  cluster: ecs.Cluster;
  taskDefinition: ecs.FargateTaskDefinition;
  securityGroup: ec2.SecurityGroup;
  minCapacity: number;
  maxCapacity: number;
  desiredCount: number;
}

export class FargateService extends Construct {
  readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: FargateServiceProps) {
    super(scope, id);

    const { serviceName, cluster, taskDefinition, securityGroup, minCapacity, maxCapacity, desiredCount } =
      props;

    this.service = new ecs.FargateService(this, 'Service', {
      serviceName,
      cluster,
      taskDefinition,
      desiredCount,
      assignPublicIp: true,
      securityGroups: [securityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      enableExecuteCommand: true,
    });

    const scaling = this.service.autoScaleTaskCount({
      minCapacity,
      maxCapacity,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });
  }
}
