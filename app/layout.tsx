import type { Metadata } from "next";

import "../3rok-design-system/tokens.css";
import "../3rok-design-system/components/bundle.css";
import { ScrollFades } from "@/components/ui/ScrollFades";

import { inter, jetbrainsMono, spaceGrotesk } from "./fonts";

export const metadata: Metadata = {
  title: { default: "3rok", template: "%s · 3rok" },
  description: "Find the orbit that minimizes impact on a chosen chip and maximizes its lifetime.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>
        {children}
        <ScrollFades />
      </body>
    </html>
  );
}
