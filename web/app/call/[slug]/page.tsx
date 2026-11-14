import { Suspense } from "react";
import { CallExperience } from "@/components/CallExperience";
import { LiveCall } from "@/components/LiveCall";

// The family and the person come from the personal link (?t=), checked by the API.
async function Screen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // The live agent unless it is switched off; otherwise the scripted guide over the same API.
  const live = process.env.NEXT_PUBLIC_SCRIPTED !== "1";
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
