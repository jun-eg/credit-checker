#!/usr/bin/env node
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as cdk from 'aws-cdk-lib';

// .env.infra を読み込む（ローカルから CDK を実行する際に使用）
// .env（LocalStack 用ダミー認証情報）とは分離し、実 AWS 認証情報を汚染しない
// GitHub Actions では環境変数が直接注入されるため影響なし
// import より先に dotenv を実行しないと process.env が config に反映されないため require を使用
dotenv.config({ path: path.resolve(__dirname, '../../.env.infra') });

// dotenv 実行後に require することで process.env の値が正しく反映される
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { devConfig } = require('../config/dev');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prodConfig } = require('../config/prod');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BootstrapStack } = require('../lib/bootstrap/bootstrap-stack');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NetworkStack } = require('../lib/network/network-stack');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DataStack } = require('../lib/data/data-stack');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AppStack } = require('../lib/app/app-stack');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CertificateStack } = require('../lib/edge/certificate-stack');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EdgeStack } = require('../lib/edge/edge-stack');

const app = new cdk.App();
const targetEnv = app.node.tryGetContext('env') ?? 'dev';
const config = targetEnv === 'prod' ? prodConfig : devConfig;

// -c appName=<name> を優先し、未指定時は .env.infra の APP_NAME にフォールバック
const appName =
  (app.node.tryGetContext('appName') as string | undefined) ??
  process.env.APP_NAME;
if (!appName) throw new Error('appName が未設定です。.env.infra に APP_NAME を定義するか -c appName=<name> で渡してください');

// GitHub Actions OIDC プロバイダーと deploy ロールを管理するスタック
// 初回のみローカルの AWS 認証情報で手動実行が必要:
//   npx cdk deploy Bootstrap -c env=dev -c appName=<name>
new BootstrapStack(app, 'Bootstrap', {
  githubRepo: 'jun-eg/credit-checker',
  env: config.env,
});

const network = new NetworkStack(app, `${config.envName}Network`, {
  appName,
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

// CloudFront は us-east-1 の証明書が必須のため専用スタックで作成
const certStack = new CertificateStack(app, `${config.envName}Certificate`, {
  domain: config.domain,
  env: { account: config.env.account, region: 'us-east-1' },
  crossRegionReferences: true,
});

new EdgeStack(app, `${config.envName}Edge`, {
  config,
  certificate: certStack.certificate,
  env: config.env,
  crossRegionReferences: true,
  albSecurityGroup: network.albSecurityGroup,
  frontendService: appStack.frontendService,
  backendService: appStack.backendService,
});
