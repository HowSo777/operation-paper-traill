import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0d12",
};

export const metadata: Metadata = {
  title: "PAPER TRAIL // Multiplayer Tactical FPS",
  description:
    "Fast-paced browser tactical FPS. 5v5 team deathmatch and co-op hostage rescue. Built with Three.js, Socket.io, and Next.js.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PaperTrail",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0d12] text-[#edf1f7] antialiased select-none overflow-hidden">{children}</body>
    </html>
  );
}
