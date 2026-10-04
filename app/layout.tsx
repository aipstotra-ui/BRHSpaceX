import type { Metadata } from "next";

import "./globals.css";
import "../3rok-design-system/tokens.css";
import "../3rok-design-system/components/bundle.css";

export const metadata: Metadata = {
  title: "StarMind Nav",
  description: "Find the orbit that minimizes impact on a chosen chip and maximizes its lifetime.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="demo" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
