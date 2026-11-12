import Link from "next/link";
import { cases } from "@/mock/data";

// Demo launcher. In the product, a family arrives from a personal link their advisor sends.
export default function Page() {
  return (
    <main className="start">
      <div className="aura is-soft" aria-hidden="true" />
      <span className="wordmark">cordada</span>
      <h1>A financial plan you can talk to.</h1>
      <p>Pick a family to see what they would receive from their advisor. Every figure comes from their Sherpas plan.</p>
      <ul>
        {Object.values(cases).map((c) => (
          <li key={c.slug} className="card">
            <div>
              <strong>{c.family}</strong>
              <span>
                {c.place}, health score {c.score}
              </span>
            </div>
            <div className="row">
              <Link className="btn btn-ink" href={`/call/${c.slug}`}>
                Start the conversation
              </Link>
              <Link className="btn btn-line" href={`/home/${c.slug}`}>
                See the steps
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
