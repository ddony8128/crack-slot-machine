import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "RULE SLOT | 규칙을 조작하고 레버를 당겨라",
  description: "규칙을 선택하고 배치해 슬롯의 작동 방식을 바꾸는 슬롯 로그라이크 게임.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "RULE SLOT",
    description: "규칙을 조작하고 레버를 당겨라",
    images: [
      { url: "/og_image.png", width: 1200, height: 630, alt: "RULE SLOT" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RULE SLOT",
    description: "규칙을 조작하고 레버를 당겨라",
    images: ["/og_image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
