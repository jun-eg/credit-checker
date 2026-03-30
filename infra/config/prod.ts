import { EnvironmentConfig } from './index';

export const prodConfig: EnvironmentConfig = {
  envName: 'Prod',
  env: {
    account: process.env.PROD_AWS_ACCOUNT_ID!,
    region: 'ap-northeast-1',
  },
  domain: 'jun-eg.site',
  scaling: {
    frontend: { minCapacity: 1, maxCapacity: 3 },
    backend: { minCapacity: 1, maxCapacity: 3 },
  },
  rds: {
    instanceType: 'db.t4g.micro',
    multiAz: true,
  },
  vpc: {
    maxAzs: 2,
  },
};
