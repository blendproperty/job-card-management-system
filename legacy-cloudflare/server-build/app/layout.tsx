import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blend Job Cards",
  description: "Maintenance requests and job cards for Blend Property Management.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

