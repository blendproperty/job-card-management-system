import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "Blend Field", template: "%s · Blend Field" },
  description: "Job tracking for Blend Property maintenance teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA" className={figtree.variable}>
      <body>{children}</body>
    </html>
  );
}
