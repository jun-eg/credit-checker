#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { devConfig } from '../config/dev';
import { prodConfig } from '../config/prod';
import { BootstrapStack } from '../lib/bootstrap/bootstrap-stack';
import { NetworkStack } from '../lib/network/network-stack';
import { DataStack } from '../lib/data/data-stack';
import { AppStack } from '../lib/app/app-stack';
import { EdgeStack } from '../lib/edge/edge-stack';

const app = new cdk.App();
const targetEnv = app.node.tryGetContext('env') ?? 'dev';
const config = targetEnv === 'prod' ? prodConfig : devConfig;

const appName = app.node.tryGetContext('appName') as string | undefined;
if (!appName) throw new Error('CDK context "appName" is required. Pass -c appName=<name>');

// GitHub Actions OIDC プロバイダーと deploy ロールを管理するスタック
// 初回のみローカルの AWS 認証情報で手動実行が必要:
//   npx cdk deploy Bootstrap -c env=dev -c appName=<name>
new BootstrapStack(app, 'Bootstrap', {
  githubRepo: 'jun-eg/credit-checker',
  env: config.env,
});

const network = new NetworkStack(app, `${config.envName}Network`, {
  config,
  env: config.env,
});

const data = new DataStack(app, `${config.envName}Data`, {
  appName,
  config,
  env: config.env,
  vpc: network.vpc,
  rdsSecurityGroup: network.rdsSecurityGroup,
});

const appStack = new AppStack(app, `${config.envName}App`, {
  appName,
  config,
  env: config.env,
  vpc: network.vpc,
  appSecret: data.appSecret,
  rdsSecret: data.rdsSecret,
  jwtSecret: data.jwtSecret,
  authSecret: data.authSecret,
  fargateSecurityGroup: network.fargateSecurityGroup,
  appBucket: data.appBucket,
});

new EdgeStack(app, `${config.envName}Edge`, {
  config,
  env: config.env,
  albSecurityGroup: network.albSecurityGroup,
  frontendService: appStack.frontendService,
  backendService: appStack.backendService,
});
