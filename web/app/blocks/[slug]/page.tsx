import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Library } from "@/components/blocks/Library";
import { API_URL, demoHouseholds } from "@/lib/backend";
import type { Plan } from "@/lib/plan";

// Each family's plan comes from the API (GET /v1/plan), using the demo link of its first member.
async function Screen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const households = await demoHouseholds();
  const h = households.find((x) => x.id === slug);
  if (!h) notFound();
  const data: Plan | null = await fetch(`${API_URL}/v1/plan`, { headers: { authorization: `Bearer ${h.members[0].token}` }, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (!data) notFound();
  const families = households.map((x) => ({ slug: x.id, name: x.family, score: x.score }));
  return <Library key={slug} data={data} families={families} />;
}

export default function Page({ params }: PageProps<"/blocks/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Screen params={params} />
    </Suspense>
  );
}
