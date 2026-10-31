import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#110e08",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://serenitystudio.app"),
  title: "Serenity Studio — End-to-End YouTube Channel Automation Platform",
  description:
    "Automate the repetitive operational workflow of running high-performing YouTube channels. From structured scripting and voiceover synthesis to 1080p scene rendering, automated Shorts distribution, and autonomous audience engagement.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", sizes: "640x640", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
  keywords: [
    "YouTube Automation",
    "YouTube Channel Automation",
    "Faceless YouTube Channel",
    "Content Production Pipeline",
    "Automated Shorts",
    "AI Video Production",
    "YouTube Operations",
    "Serenity Studio",
  ],
  authors: [{ name: "Serenity Studio Team" }],
  openGraph: {
    title: "Serenity Studio — Your YouTube Channel. Running on Autopilot.",
    description:
      "From Video Idea to Published Content. One Connected Automated Workflow for serious creators and automation operators.",
    url: "https://serenitystudio.app",
    siteName: "Serenity Studio",
    images: [
      {
        url: "/screenshots/pipeline-telemetry.jpg",
        width: 1200,
        height: 630,
        alt: "Serenity Studio Connected Execution Pipeline Telemetry",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Serenity Studio — End-to-End YouTube Channel Automation Platform",
    description:
      "Run your YouTube channel without manually managing every production step. Connected pipeline from ideation to publishing.",
    images: ["/screenshots/pipeline-telemetry.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#110e08] text-[#f7f3ee] antialiased selection:bg-[#c8b29b]/25 selection:text-[#f7f3ee]">
        {children}
      </body>
    </html>
  );
}
