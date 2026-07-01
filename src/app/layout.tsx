import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
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
        className={`${geistSans.variable} ${geistMono.variable} ${interExtraBold.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
