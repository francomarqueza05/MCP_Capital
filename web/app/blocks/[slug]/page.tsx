import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Library } from "@/components/blocks/Library";
import { buildPlan, caseIds } from "@/lib/plan";

export function generateStaticParams() {
  return caseIds.map((slug) => ({ slug }));
}

// Each family's plan is read on the server; only the fields the blocks use reach the browser.
async function Screen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(caseIds as readonly string[]).includes(slug)) notFound();
  const families = caseIds.map((id) => {
    const p = buildPlan(id);
    return { slug: id, name: p.household.family, score: p.score.value };
  });
  return <Library key={slug} data={buildPlan(slug)} families={families} />;
}

export default function Page({ params }: PageProps<"/blocks/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Screen params={params} />
    </Suspense>
  );
}
