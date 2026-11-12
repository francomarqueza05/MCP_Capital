"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cases } from "@/mock/data";
import { Orb } from "./Orb";

const spring = { type: "spring", stiffness: 300, damping: 28 } as const;

// The days after: one next step, the rest of the plan's recommendations in order,
// and the guide one tap away.
export function HomeRoute({ slug }: { slug: string }) {
  const data = cases[slug];
  const key = `cordada:${slug}:done`;
  const [done, setDone] = useState(0);
  const [member, setMember] = useState(data.members[0]);
  const level = useRef(0);
  const n = data.camps.length;

  useEffect(() => {
    try {
      setDone(Math.min(Number(localStorage.getItem(key)) || 0, n));
    } catch {}
  }, [key, n]);

  const mark = (v: number) => {
    setDone(v);
    try {
      localStorage.setItem(key, String(v));
    } catch {}
  };

  const current = data.camps[done];

  return (
    <main className="home">
      <div className="aura is-soft" aria-hidden="true" />
      <header className="home-top">
        <span className="wordmark">cordada</span>
        {data.members.length > 1 && (
          <div className="segmented" role="group" aria-label="Whose view">
            {data.members.map((m) => (
              <button key={m.id} aria-pressed={m.id === member.id} onClick={() => setMember(m)}>
                {m.id === member.id && <motion.i layoutId="seg-home" transition={spring} />}
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <section className="hero">
        <div className="hero-copy">
          <AnimatePresence mode="wait">
            <motion.div
              key={current?.title ?? "top"}
              initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -14, filter: "blur(8px)" }}
              transition={{ duration: 0.4 }}
            >
              <span className="pill is-blue">{current ? `Step ${done + 1} of ${n}` : "All done"}</span>
              <h1>{current ? current.title : `Every step is done, ${member.name}.`}</h1>
              <p>{current ? current.why : "Your advisor will bring the next ones. Until then, ask anything about your plan."}</p>
            </motion.div>
          </AnimatePresence>
          <div className="row">
            {current ? (
              <motion.button whileTap={{ scale: 0.96 }} className="btn btn-ink" onClick={() => mark(done + 1)}>
                Mark as done
              </motion.button>
            ) : (
              <button className="btn btn-line" onClick={() => mark(0)}>
                Start over
              </button>
            )}
          </div>
        </div>
        <Link className="talk" href={`/call/${slug}`}>
          <span className="talk-orb">
            <Orb state="idle" level={level} />
          </span>
          <span>
            <strong>Talk it through</strong>
            <small>Ask your guide about this step</small>
          </span>
        </Link>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Your plan, in order</h2>
          <span>
            {done} of {n} done
          </span>
        </div>
        <div className="meter" aria-hidden="true">
          <motion.i animate={{ scaleX: done / n }} transition={{ type: "spring", stiffness: 90, damping: 18 }} />
        </div>
        <ol className="steps">
          {data.camps.map((c, i) => {
            const st = i < done ? "is-done" : i === done ? "is-now" : "";
            return (
              <motion.li key={c.title} layout className={st} transition={spring}>
                <span className="tick">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <motion.path
                      d="M6.5 12.5l3.6 3.6 7.4-8"
                      initial={false}
                      animate={{ pathLength: i < done ? 1 : 0, opacity: i < done ? 1 : 0 }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                    />
                  </svg>
                </span>
                <div>
                  <strong>{c.title}</strong>
                  <AnimatePresence initial={false}>
                    {i === done && (
                      <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        {c.why}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Coming up in your plan</h2>
        </div>
        <ul className="dates">
          {data.comingUp.map((g) => (
            <li key={g.year + g.name}>
              <strong>{g.year}</strong>
              {g.name}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
