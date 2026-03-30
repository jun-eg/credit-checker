import { EnvironmentConfig } from './index';

export const devConfig: EnvironmentConfig = {
  envName: 'Dev',
  env: {
    account: process.env.DEV_AWS_ACCOUNT_ID!,
    region: 'ap-northeast-1',
  },
  domain: 'dev.jun-eg.site',
  scaling: {
    frontend: { minCapacity: 0, maxCapacity: 2 },
    backend: { minCapacity: 0, maxCapacity: 2 },
  },
  rds: {
    instanceType: 'db.t4g.micro',
    multiAz: false,
  },
  vpc: {
    maxAzs: 1,
  },
};
