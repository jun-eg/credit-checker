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
  };
  vpc: {
    maxAzs: number;
  };
}
