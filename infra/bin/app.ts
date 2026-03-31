#!/usr/bin/env node
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as cdk from 'aws-cdk-lib';
import { devConfig } from '../config/dev';
import { prodConfig } from '../config/prod';
import { NetworkStack } from '../lib/network/network-stack';
import { DataStack } from '../lib/data/data-stack';
import { AppStack } from '../lib/app/app-stack';
import { EdgeStack } from '../lib/edge/edge-stack';

// プロジェクトルートの .env を読み込む（ローカル開発用）
// GitHub Actions では環境変数が直接注入されるため影響なし
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = new cdk.App();
const targetEnv = app.node.tryGetContext('env') ?? 'dev';
const config = targetEnv === 'prod' ? prodConfig : devConfig;

// -c appName=<name> を優先し、未指定時は .env の APP_NAME にフォールバック
const appName =
  (app.node.tryGetContext('appName') as string | undefined) ??
  process.env.APP_NAME;
if (!appName) throw new Error('appName が未設定です。.env に APP_NAME を定義するか -c appName=<name> で渡してください');

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
