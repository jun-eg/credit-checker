import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ModeProvider } from '../contexts/ModeContext';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Credit Checker',
  description:
    'レシートの写真を保存・解析し、LLMとの対話形式で支出状況を確認できるWebアプリケーション',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Credit Checker',
    description:
      'レシートの写真を保存・解析し、LLMとの対話形式で支出状況を確認できるWebアプリケーション',
    images: [{ url: '/og-image.png', width: 1536, height: 1024 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Credit Checker',
    description:
      'レシートの写真を保存・解析し、LLMとの対話形式で支出状況を確認できるWebアプリケーション',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
          <ModeProvider>{children}</ModeProvider>
        </body>
    </html>
  );
}
