import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ONSIA Tracker - 분양현장 방문자 추적 시스템',
  description: '부정클릭 방지 및 방문자 분석 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
