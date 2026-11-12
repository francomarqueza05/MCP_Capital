import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CallExperience } from "@/components/CallExperience";
import { LiveCall } from "@/components/LiveCall";
import { caseIds } from "@/lib/cases/load";

export function generateStaticParams() {
  return caseIds().map((slug) => ({ slug }));
}

async function Screen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!caseIds().includes(slug)) notFound();
  // The live agent when it is configured; otherwise the scripted guide over the same engine.
  const live = Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID);
  return live ? <LiveCall slug={slug} /> : <CallExperience slug={slug} />;
}

// Not async: the page hands the params promise down so the shell renders at once.
export default function Page({ params }: PageProps<"/call/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Screen params={params} />
    </Suspense>
  );
}
