import { EnvironmentConfig } from './index';

export const devConfig: EnvironmentConfig = {
  envName: 'Dev',
  env: {
    account: process.env.DEV_AWS_ACCOUNT_ID!,
    region: process.env.AWS_REGION!,
  },
  domain: 'dev.jun-eg.site',
  frontendDomain: 'credit-checker.dev.jun-eg.site',
  scaling: {
    frontend: { minCapacity: 0, maxCapacity: 2 },
    backend: { minCapacity: 0, maxCapacity: 2 },
  },
  rds: {
    instanceType: 't4g.micro',
    multiAz: false,
    databaseName: 'credit_checker',
  },
  vpc: {
    maxAzs: 2,
  },
  ports: {
    frontend: 3000,
    backend: 3003,
  },
  authGoogleId: process.env.AUTH_GOOGLE_ID!,
  nodeEnv: process.env.NODE_ENV!,
  databaseSsl: true,
  typeormLogging: true,
};
