import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "vault-publish",
  description: "Open-source Obsidian publishing. Deploy your own instance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
