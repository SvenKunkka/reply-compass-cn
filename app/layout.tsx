import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '回得刚刚好｜催促回复助手',
  description: '粘贴聊天记录或截图，获得兼顾关系与推进效果的回复建议。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
