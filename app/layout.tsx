import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

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
    <html lang="en">
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
