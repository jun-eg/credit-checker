import Google from 'next-auth/providers/google';
import type { Provider } from 'next-auth/providers';

// Google OAuth プロバイダー設定
// 他プロバイダーに差し替える場合: next-auth/providers/<provider> をインポートして同様に export する
export const googleProvider: Provider = Google;
