import { EnvironmentConfig } from './index';

export const prodConfig: EnvironmentConfig = {
  envName: 'Prod',
  env: {
    account: process.env.PROD_AWS_ACCOUNT_ID!,
    region: process.env.AWS_REGION!,
  },
  domain: 'jun-eg.site',
  scaling: {
    frontend: { minCapacity: 1, maxCapacity: 3 },
    backend: { minCapacity: 1, maxCapacity: 3 },
  },
  rds: {
    instanceType: 'db.t4g.micro',
    multiAz: true,
    databaseName: 'credit_checker',
  },
  vpc: {
    maxAzs: 2,
  },
  ports: {
    frontend: 3000,
    backend: 3003,
  },
  s3BucketName: process.env.S3_BUCKET_NAME!,
  authGoogleId: process.env.AUTH_GOOGLE_ID!,
};
