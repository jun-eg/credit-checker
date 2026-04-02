import { EnvironmentConfig } from './index';

export const prodConfig: EnvironmentConfig = {
  envName: 'Prod',
  env: {
    account: process.env.PROD_AWS_ACCOUNT_ID!,
    region: process.env.AWS_REGION!,
  },
  domain: process.env.PROD_DOMAIN!,
  scaling: {
    frontend: { minCapacity: 1, maxCapacity: 3 },
    backend: { minCapacity: 1, maxCapacity: 3 },
  },
  rds: {
    instanceType: 't4g.micro',
    multiAz: true,
    databaseName: (process.env.APP_NAME ?? 'app').replace(/-/g, '_'),
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
  typeormLogging: false,
};
