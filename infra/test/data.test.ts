import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { devConfig } from '../config/dev';
import { prodConfig } from '../config/prod';
import { NetworkStack } from '../lib/network/network-stack';
import { DataStack } from '../lib/data/data-stack';

const TEST_APP_NAME = 'test-app';

function buildDataTemplate(config: typeof devConfig) {
  const app = new cdk.App();
  const network = new NetworkStack(app, `${config.envName}Network`, {
    appName: TEST_APP_NAME,
    config,
    env: config.env,
  });
  const data = new DataStack(app, `${config.envName}Data`, {
    appName: TEST_APP_NAME,
    config,
    env: config.env,
    vpc: network.vpc,
    rdsSecurityGroup: network.rdsSecurityGroup,
  });
  return Template.fromStack(data);
}

describe('DataStack - dev', () => {
  let template: Template;

  beforeAll(() => {
    template = buildDataTemplate(devConfig);
  });

  it('dev: RDS が Single-AZ であること（multiAz: false）', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      MultiAZ: false,
    });
  });

  it('app-secrets のシークレット名が正しいこと', () => {
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: `/${TEST_APP_NAME}/dev/app-secrets`,
    });
  });

  it('jwt-secret が自動生成設定で作成されること', () => {
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: `/${TEST_APP_NAME}/dev/jwt-secret`,
      GenerateSecretString: Match.objectLike({ ExcludePunctuation: true }),
    });
  });

  it('auth-secret が自動生成設定で作成されること', () => {
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: `/${TEST_APP_NAME}/dev/auth-secret`,
      GenerateSecretString: Match.objectLike({ ExcludePunctuation: true }),
    });
  });
});

describe('DataStack - prod', () => {
  let template: Template;

  beforeAll(() => {
    template = buildDataTemplate(prodConfig);
  });

  it('prod: RDS が Multi-AZ であること（multiAz: true）', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      MultiAZ: true,
    });
  });

  it('app-secrets のシークレット名が正しいこと', () => {
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: `/${TEST_APP_NAME}/prod/app-secrets`,
    });
  });
});
