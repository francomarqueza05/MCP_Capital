import Link from "next/link";
import { Suspense } from "react";
import { API_URL } from "@/lib/backend";
import { caseSlugs } from "@/mock/data";

type Household = { id: string; family: string; place: string; score: number; members: { id: string; name: string; token: string }[] };

// Demo launcher. In the product, each person arrives from the personal link their advisor
// sends; here the API hands out those links for the four Sherpas cases so the jury can try them.
export default function Page() {
  return (
    <main className="start">
      <div className="aura is-soft" aria-hidden="true" />
      <span className="wordmark">cordada</span>
      <h1>A financial plan you can talk to.</h1>
      <p>Pick a person to hear the plan the way they would. Every figure comes from their Sherpas plan.</p>
      <Suspense fallback={null}>
        <Families />
      </Suspense>
      <section className="start-blocks">
        <h2>Every block, family by family</h2>
        <p>The full Sherpas analysis of each family as visual blocks, for the guide to choose from.</p>
        <div className="row">
          {[
            ["michael-carter", "Michael Carter"],
            ["timothy-melanie-weah", "Timothy & Melanie Weah"],
            ["daniel-emily-johnson", "Daniel & Emily Johnson"],
            ["samantha-lewis", "Samantha Lewis"],
          ].map(([slug, name]) => (
            <Link key={slug} className="btn btn-line" href={`/blocks/${slug}`}>
              {name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

/** The households come from the API, so they stream in after the page shell. */
async function Families() {
  const families: Household[] = await fetch(`${API_URL}/v1/demo/households`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
  return (
    <ul>
      {families.map((c) => (
        <li key={c.id} className="card">
          <div>
            <strong>{c.family}</strong>
            <span>
              {c.place}, health score {c.score}
            </span>
          </div>
          <div className="row">
            {c.members.map((m) => (
              <Link key={m.id} className="btn btn-ink" href={`/call/${c.id}?t=${m.token}`}>
                Talk as {m.name}
              </Link>
            ))}
            {caseSlugs.includes(c.id) && (
              <Link className="btn btn-line" href={`/home/${c.id}`}>
                See the steps
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
