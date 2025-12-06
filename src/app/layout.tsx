import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '自己進化型 社内QAシステム',
  description: 'GA x Vertex AI による自己進化型QAシステム',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
