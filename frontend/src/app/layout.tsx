import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwRegistrar from "../components/SwRegistrar";

export const metadata: Metadata = {
  title: "CyberSOC — Security Operations Center",
  description: "AI-Powered Real-Time Threat Intelligence Dashboard",
  manifest: "/manifest.webmanifest",
  applicationName: "CyberSOC",
  appleWebApp: {
    capable: true,
    title: "CyberSOC",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ff1a1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SwRegistrar />
        {children}
      </body>
    </html>
  );
}
