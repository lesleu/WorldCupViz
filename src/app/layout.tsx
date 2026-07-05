import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const interExtraBold = Inter({
  subsets: ["latin"],
  weight: "800",
  variable: "--font-inter-extrabold",
});

const interSemiBold = Inter({
  subsets: ["latin"],
  weight: "600",
  variable: "--font-inter-semibold",
});

export const metadata: Metadata = {
  title: "World Cup Vizi",
  description: "Generative art visualization from football match data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${interExtraBold.variable} ${interSemiBold.variable} antialiased`}
      >
        <GoogleAnalytics />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
