"use client";

import Link from "next/link";
import { MotionConfig, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Johnson, PersonId } from "@/lib/johnson";
import { Orb } from "../Orb";
import type { Depth } from "./act";
import { OnView, spring } from "./kit";
import { applicable, type Block, type Ctx } from "./registry";
import "./blocks.css";

function Segmented<T extends string>({ label, value, options, onChange, id }: { label: string; value: T; options: { v: T; t: string }[]; onChange: (v: T) => void; id: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} aria-pressed={o.v === value} onClick={() => onChange(o.v)}>
          {o.v === value && <motion.i layoutId={id} transition={spring} />}
          <span>{o.t}</span>
        </button>
      ))}
    </div>
  );
}

function Frame({ block, ctx }: { block: Block; ctx: Ctx }) {
  const [run, setRun] = useState(0);
  return (
    <article id={block.id} className={`frame ${block.wide || !block.says ? "is-wide" : ""} ${block.says ? "" : "is-quiet"}`}>
      <div className="frame-copy">
        <div className="frame-title">
          <h3>{block.name}</h3>
          <code>{block.id}</code>
        </div>
        {block.says && (
          <blockquote>
            <span className="frame-voice" aria-hidden="true" />
            {block.says(ctx)}
          </blockquote>
        )}
        <div className="frame-foot">
          <ul className="frame-picks" aria-label="Picked when">
            {block.picks.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <button className="frame-replay" onClick={() => setRun((r) => r + 1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.7h3.7" />
            </svg>
            Play again
          </button>
        </div>
      </div>
      <OnView className="frame-stage">
        {(seen) =>
          seen && (
            <div key={`${run}-${ctx.who}`} className="frame-visual">
              {block.render(ctx)}
            </div>
          )
        }
      </OnView>
    </article>
  );
}

const h0slug = (d: Johnson) => d.household.slug;

export type FamilyLink = { slug: string; name: string; score: number };

export function Library({ data, families }: { data: Johnson; families: FamilyLink[] }) {
  const [who, setWho] = useState<PersonId>(data.household.adults[0].id);
  const [depth, setDepth] = useState<Depth>("plain");
  const ctx: Ctx = { data, who, depth };
  const sections = applicable(ctx);
  const blockCount = sections.reduce((n, s) => n + s.blocks.length, 0);
  const [active, setActive] = useState(sections[0].id);
  const level = useRef(0);

  // Which section is in view, for the index.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id.replace("s-", ""));
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    document.querySelectorAll(".lib-section").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [h0slug(data)]);

  // A slow breathing level so the orb in the header feels alive.
  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      level.current = 0.18 + Math.max(0, Math.sin(t / 900)) * 0.22;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { household: h } = data;

  return (
    <MotionConfig reducedMotion="user">
    <main className="lib">
      <div className="aura is-soft" aria-hidden="true" />
      <header className="lib-top">
        <Link href="/" className="wordmark">
          cordada
        </Link>
        <nav className="lib-families" aria-label="Families">
          {families.map((f) => (
            <Link key={f.slug} href={`/blocks/${f.slug}`} className={f.slug === h.slug ? "is-on" : ""} aria-current={f.slug === h.slug ? "page" : undefined}>
              {f.name}
              <small>{f.score}</small>
            </Link>
          ))}
        </nav>
        <div className="lib-controls">
          {h.couple && <Segmented id="seg-who" label="Who is watching" value={who} onChange={setWho} options={h.adults.map((a) => ({ v: a.id, t: a.name }))} />}
          <Segmented
            id="seg-depth"
            label="How much detail"
            value={depth}
            onChange={setDepth}
            options={[
              { v: "plain", t: "Plain" },
              { v: "detailed", t: "Detailed" },
            ]}
          />
        </div>
      </header>

      <section className="lib-hero">
        <div className="lib-hero-copy">
          <h1>{h.family}: the whole plan, every block.</h1>
          <p>
            Sherpas&apos; full analysis of {h.couple ? "the family" : h.adults[0].name}, from the plan data and the persona, as {blockCount} blocks in the report&apos;s order. Every block that
            applies is shown; which ones play, when and for whom comes later.{h.couple ? ` Switch between ${h.adults[0].name} and ${h.adults[1].name} to see the blocks that speak to one person.` : ""}
          </p>
        </div>
        <div className="lib-family">
          <span className="lib-orb">
            <Orb state="idle" level={level} />
          </span>
          <ul>
            {[...h.adults, ...h.kids].map((p) => (
              <li key={p.name} className={"id" in p && p.id === who ? "is-me" : ""}>
                <b>{p.name}</b>
                <span>{p.age}</span>
              </li>
            ))}
          </ul>
          <p>
            {h.place}, health score {data.score.value}
          </p>
        </div>
      </section>

      <nav className="lib-index" aria-label="Sections">
        {sections.map((s) => (
          <a key={s.id} href={`#s-${s.id}`} className={active === s.id ? "is-active" : ""}>
            <span>{s.name}</span>
            <small>{s.blocks.length}</small>
            {active === s.id && <motion.i layoutId="index-mark" transition={spring} />}
          </a>
        ))}
      </nav>

      <div className="lib-body">
        {sections.map((s) => (
          <section key={s.id} id={`s-${s.id}`} className="lib-section">
            <div className="lib-section-head">
              <h2>{s.name}</h2>
              <p>{s.about}</p>
            </div>
            {s.blocks.map((b) => (
              <Frame key={b.id} block={b} ctx={ctx} />
            ))}
          </section>
        ))}
      </div>
    </main>
    </MotionConfig>
  );
}
