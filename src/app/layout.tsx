import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PAPER TRAIL // Multiplayer Tactical FPS",
  description:
    "Fast-paced browser tactical FPS. 5v5 team deathmatch and co-op hostage rescue. Built with Three.js, Socket.io, and Next.js.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0d12] text-[#edf1f7] antialiased select-none overflow-hidden">{children}</body>
    </html>
  );
}
