import Link from "next/link";
import { issueToken } from "@/lib/auth/token";
import { caseIds, getCase } from "@/lib/cases/load";
import { caseSlugs } from "@/mock/data";

// Demo launcher. In the product, each person arrives from the personal link their advisor
// sends; here we hand out those links for the four Sherpas cases so the jury can try them.
export default function Page() {
  const families = caseIds().map((id) => getCase(id)!);
  return (
    <main className="start">
      <div className="aura is-soft" aria-hidden="true" />
      <span className="wordmark">cordada</span>
      <h1>A financial plan you can talk to.</h1>
      <p>Pick a person to hear the plan the way they would. Every figure comes from their Sherpas plan.</p>
      <ul>
        {families.map((c) => (
          <li key={c.id} className="card">
            <div>
              <strong>{c.family}</strong>
              <span>
                {c.place}, health score {c.score.value}
              </span>
            </div>
            <div className="row">
              {c.members.map((m) => (
                <Link key={m.id} className="btn btn-ink" href={`/call/${c.id}?t=${issueToken({ caseId: c.id, memberId: m.id })}`}>
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
    </main>
  );
}
