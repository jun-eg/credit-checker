import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { devConfig } from '../config/dev';
import { NetworkStack } from '../lib/network/network-stack';

describe('NetworkStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new NetworkStack(app, 'TestNetwork', {
      config: devConfig,
      env: devConfig.env,
    });
    template = Template.fromStack(stack);
  });

  it('VPC が作成されていること', () => {
    template.hasResourceProperties('AWS::EC2::VPC', {});
  });

  it('S3 Gateway Endpoint が作成されていること', () => {
    template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
      ServiceName: {
        'Fn::Join': ['', ['com.amazonaws.', { Ref: 'AWS::Region' }, '.s3']],
      },
      VpcEndpointType: 'Gateway',
    });
  });

  it('ALB SG が HTTP(80) と HTTPS(443) の inbound を持つこと', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'ALB security group',
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({ IpProtocol: 'tcp', FromPort: 80, ToPort: 80 }),
        Match.objectLike({ IpProtocol: 'tcp', FromPort: 443, ToPort: 443 }),
      ]),
    });
  });

  it('Fargate SG が作成されていること', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Fargate tasks security group',
    });
  });

  it('RDS SG が作成されていること', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'RDS security group',
    });
  });

  it('Fargate SG が ALB SG からの inbound を持つこと', () => {
    // Fargate SG への ALB SG からの ingress（frontend / backend の各アプリポートに限定）
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Fargate tasks security group',
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({ IpProtocol: 'tcp', FromPort: 3000, ToPort: 3000 }),
        Match.objectLike({ IpProtocol: 'tcp', FromPort: 3003, ToPort: 3003 }),
      ]),
    });
  });

  it('Fargate SG が 443 アウトバウンドを持つこと', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Fargate tasks security group',
      SecurityGroupEgress: Match.arrayWith([
        Match.objectLike({ IpProtocol: 'tcp', FromPort: 443, ToPort: 443 }),
      ]),
    });
  });
});
