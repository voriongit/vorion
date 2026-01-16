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
  metadataBase: new URL("https://vorion.org"),
  title: "VORION | Governance for the Autonomous Age",
  description: "VORION is the commercial steward of the BASIS standard. Infrastructure to bind AI to verifiable human intent.",
  keywords: ["AI governance", "BASIS standard", "AI safety", "autonomous systems", "AI compliance", "agent governance", "VORION"],
  authors: [{ name: "VORION" }],
  icons: {
    icon: "/vorion.png",
    apple: "/vorion.png",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "VORION | Governance for the Autonomous Age",
    description: "Infrastructure to bind AI to verifiable human intent.",
    url: "https://vorion.org",
    siteName: "VORION",
    type: "website",
    images: ["/vorion.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "VORION | Governance for the Autonomous Age",
    description: "Infrastructure to bind AI to verifiable human intent.",
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
