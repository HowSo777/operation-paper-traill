import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./polish.css";

export const metadata: Metadata = {
  title: "Operation: Paper Trail — wireframe tactical FPS",
  description:
    "A minimalist wireframe first person shooter: rescue the hostage, reach the motorcycle, exfiltrate. Built with Three.js, Socket.io, Next.js and PostgreSQL.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-[#0a0a0a] antialiased">{children}</body>
    </html>
  );
}
