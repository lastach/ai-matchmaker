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
  title: "AI Matchmaker",
  description: "One match. One memo. One date.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FBF9F7]">{children}
        <footer className="py-6 text-center text-xs text-gray-500">
          <a href="/privacy" className="hover:underline">Privacy</a>
          <span className="mx-2">·</span>
          <a href="/terms" className="hover:underline">Terms</a>
        </footer>
      </body>
    </html>
  );
}
