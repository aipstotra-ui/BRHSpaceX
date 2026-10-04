import type { Metadata } from "next";

export const metadata: Metadata = { title: "Testing" };

export default function TestLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
