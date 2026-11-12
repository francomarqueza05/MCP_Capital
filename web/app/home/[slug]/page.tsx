import { Suspense } from "react";
import { notFound } from "next/navigation";
import { HomeRoute } from "@/components/HomeRoute";
import { caseSlugs } from "@/mock/data";

export function generateStaticParams() {
  return caseSlugs.map((slug) => ({ slug }));
}

async function Screen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!caseSlugs.includes(slug)) notFound();
  return <HomeRoute slug={slug} />;
}

// Not async: the page hands the params promise down so the shell renders at once.
export default function Page({ params }: PageProps<"/home/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Screen params={params} />
    </Suspense>
  );
}
