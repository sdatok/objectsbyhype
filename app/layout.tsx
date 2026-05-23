import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

// Retro pixel display font — used for the home-page mini-game.
const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
  display: "swap",
});

// Slightly more readable retro font for longer game copy.
const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
  display: "swap",
});

const siteUrl = "https://objectsbyhype.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "OBJECTSBYHYPE",
  description: "Designer furniture and hype home objects.",
  openGraph: {
    title: "OBJECTSBYHYPE",
    description: "Designer furniture and hype home objects.",
    type: "website",
    url: siteUrl,
    siteName: "OBJECTSBYHYPE",
    locale: "en_US",
    images: [
      {
        url: "/og.jpeg",
        width: 1200,
        height: 630,
        alt: "OBJECTSBYHYPE",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OBJECTSBYHYPE",
    description: "Designer furniture and hype home objects.",
    images: ["/og.jpeg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${pressStart.variable} ${vt323.variable}`}>
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
