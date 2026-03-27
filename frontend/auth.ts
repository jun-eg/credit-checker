import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

declare module 'next-auth' {
  interface Session {
    backendToken: string;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    backendToken?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    async jwt({ token, account, profile }) {
      // 初回サインイン時のみバックエンドにupsertしてトークンを取得
      if (account?.provider === 'google' && profile) {
        const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3003';
        const res = await fetch(`${backendUrl}/auth/upsert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googleId: profile.sub,
            email: profile.email,
            displayName: profile.name ?? null,
            avatarUrl: profile.picture ?? null,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { accessToken: string };
          token.backendToken = data.accessToken;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.backendToken = token.backendToken ?? '';
      return session;
    },
  },
});
