import type { Metadata } from "next";

import { CaseEditor } from "@/components/cases/CaseEditor";

export const metadata: Metadata = { title: "Case" };

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="app-main">
      <CaseEditor id={id} />
    </main>
  );
}
