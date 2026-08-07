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

export const metadata: Metadata = {
  title: "MatTrace｜材料文献数据提取与核验 Agent",
  description: "让每一条材料数据都有出处、有条件、可复查。",
  openGraph: {
    title: "MatTrace｜材料文献数据提取与核验 Agent",
    description: "让每一条材料数据都有出处、有条件、可复查。",
    images: [{ url: "/og.png", width: 1733, height: 909, alt: "MatTrace 材料证据 Agent" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MatTrace｜材料文献数据提取与核验 Agent",
    description: "让每一条材料数据都有出处、有条件、可复查。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
