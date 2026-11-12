import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CallExperience } from "@/components/CallExperience";
import { caseIds } from "@/lib/cases/load";

export function generateStaticParams() {
  return caseIds().map((slug) => ({ slug }));
}

async function Screen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!caseIds().includes(slug)) notFound();
  return <CallExperience slug={slug} />;
}

// Not async: the page hands the params promise down so the shell renders at once.
export default function Page({ params }: PageProps<"/call/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Screen params={params} />
    </Suspense>
  );
}
