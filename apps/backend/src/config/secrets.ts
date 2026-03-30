import { readFileSync } from 'fs';

function readSecret(name: string): string {
  const filePath = `/run/secrets/${name}`;
  try {
    return readFileSync(filePath, 'utf8').trim();
  } catch {
    // ローカル開発で secrets/ が未作成の場合のフォールバック
    const envValue = process.env[name.toUpperCase()];
    if (!envValue) throw new Error(`Secret ${name} not found`);
    return envValue;
  }
}

export const secrets = {
  jwtSecret: () => readSecret('jwt_secret'),
  authSecret: () => readSecret('auth_secret'),
  googleSecret: () => readSecret('auth_google_secret'),
  openaiApiKey: () => readSecret('openai_api_key'),
  databaseUrl: () => readSecret('database_url'),
};
