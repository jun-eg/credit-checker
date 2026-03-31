import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { devConfig } from '../config/dev';
import { prodConfig } from '../config/prod';
import { NetworkStack } from '../lib/network/network-stack';
import { DataStack } from '../lib/data/data-stack';
import { AppStack } from '../lib/app/app-stack';

const TEST_APP_NAME = 'test-app';

function buildAppTemplate(config: typeof devConfig) {
  const app = new cdk.App();
  const network = new NetworkStack(app, `${config.envName}Network`, {
    config,
    env: config.env,
  });
  const data = new DataStack(app, `${config.envName}Data`, {
    config,
    env: config.env,
    vpc: network.vpc,
    rdsSecurityGroup: network.rdsSecurityGroup,
  });
  const appStack = new AppStack(app, `${config.envName}App`, {
    appName: TEST_APP_NAME,
    config,
    env: config.env,
    vpc: network.vpc,
    appSecret: data.appSecret,
    fargateSecurityGroup: network.fargateSecurityGroup,
    receiptsBucket: data.receiptsBucket,
  });
  return Template.fromStack(appStack);
}

describe('AppStack - dev', () => {
  let template: Template;

  beforeAll(() => {
    template = buildAppTemplate(devConfig);
  });

  it('dev: ECS Service の desiredCount が 0 であること', () => {
    template.hasResourceProperties('AWS::ECS::Service', {
      DesiredCount: 0,
    });
  });

  it('Fargate の assignPublicIp が ENABLED であること', () => {
    template.hasResourceProperties('AWS::ECS::Service', {
      NetworkConfiguration: {
        AwsvpcConfiguration: {
          AssignPublicIp: 'ENABLED',
        },
      },
    });
  });

  it('backend コンテナに DATABASE_URL secret が設定されていること', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: 'backend',
          Secrets: Match.arrayWith([
            Match.objectLike({ Name: 'DATABASE_URL' }),
          ]),
        }),
      ]),
    });
  });

  it('backend コンテナに JWT_SECRET secret が設定されていること', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: 'backend',
          Secrets: Match.arrayWith([
            Match.objectLike({ Name: 'JWT_SECRET' }),
          ]),
        }),
      ]),
    });
  });

  it('frontend コンテナに AUTH_SECRET secret が設定されていること', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: 'frontend',
          Secrets: Match.arrayWith([
            Match.objectLike({ Name: 'AUTH_SECRET' }),
          ]),
        }),
      ]),
    });
  });

  it('migrator コンテナに DATABASE_URL secret が設定されていること', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: 'migrator',
          Secrets: Match.arrayWith([
            Match.objectLike({ Name: 'DATABASE_URL' }),
          ]),
        }),
      ]),
    });
  });

  it('frontend ECS Service の ServiceName が appName と env から生成されること', () => {
    template.hasResourceProperties('AWS::ECS::Service', {
      ServiceName: `${TEST_APP_NAME}-frontend-dev`,
    });
  });

  it('backend ECS Service の ServiceName が appName と env から生成されること', () => {
    template.hasResourceProperties('AWS::ECS::Service', {
      ServiceName: `${TEST_APP_NAME}-backend-dev`,
    });
  });
});

describe('AppStack - prod', () => {
  let template: Template;

  beforeAll(() => {
    template = buildAppTemplate(prodConfig);
  });

  it('prod: ECS Service の desiredCount が 1 であること', () => {
    template.hasResourceProperties('AWS::ECS::Service', {
      DesiredCount: 1,
    });
  });
});
