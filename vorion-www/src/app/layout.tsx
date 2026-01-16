import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
  title: "VORION | Governance for the Autonomous Age",
  description: "VORION is the commercial steward of the BASIS standard. Infrastructure to bind AI to verifiable human intent.",
  icons: {
    icon: "/vorion.png",
    apple: "/vorion.png",
  },
  openGraph: {
    title: "VORION | Governance for the Autonomous Age",
    description: "Infrastructure to bind AI to verifiable human intent.",
    images: ["/vorion.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
