function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is not set`);
  return value;
}

export const secrets = {
  jwtSecret:    () => requireEnv('JWT_SECRET'),
  openaiApiKey: () => requireEnv('OPENAI_API_KEY'),
  databaseUrl:  () => requireEnv('DATABASE_URL'),
};
