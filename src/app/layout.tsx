import type { Metadata, Viewport } from "next";
import { AccountGate } from "@/components/AccountGate";
import { StandaloneMode } from "@/components/StandaloneMode";
import "./globals.css";

export const metadata: Metadata = {
  title: "Odyssey Lite",
  description: "Friend-sourced travel discovery prototype",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Odyssey Lite",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#18231f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <StandaloneMode />
        <AccountGate>{children}</AccountGate>
      </body>
    </html>
  );
}
