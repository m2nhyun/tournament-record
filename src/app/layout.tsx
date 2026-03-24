import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tournament Record",
  description: "아마추어 테니스 모임/클럽 경기 기록 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-dvh overflow-hidden">
      <body className="h-dvh overflow-hidden antialiased">{children}</body>
    </html>
  );
}
