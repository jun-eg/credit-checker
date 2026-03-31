export interface EnvironmentConfig {
  envName: 'Dev' | 'Prod';
  env: {
    account: string;
    region: string;
  };
  domain: string;
  scaling: {
    frontend: { minCapacity: number; maxCapacity: number };
    backend: { minCapacity: number; maxCapacity: number };
  };
  rds: {
    instanceType: string;
    multiAz: boolean;
    databaseName: string;
  };
  vpc: {
    maxAzs: number;
  };
  ports: {
    frontend: number;
    backend: number;
  };
  authGoogleId: string;
  nodeEnv: string;
  databaseSsl: boolean;
}
