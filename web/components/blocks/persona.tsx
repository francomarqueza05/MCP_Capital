"use client";

// The persona Sherpas wrote for the family: who they are as clients (D0–D6), the
// concerns the data shows (O1…), and where those concerns pull against each other (T1…).
import { motion } from "motion/react";
import { useState } from "react";
import type { Johnson } from "@/lib/johnson";
import { Rich } from "./report";
import { ease, rise } from "./kit";

const level: Record<string, number> = { MINOR: 1, LOW: 1, MODERATE: 2, MEDIUM: 2, SIGNIFICANT: 3, HIGH: 3, CRITICAL: 3, SEVERE: 3 };

export function ProfileDims({ persona }: { persona: Johnson["persona"] }) {
  const [open, setOpen] = useState<string | null>("D6");
  return (
    <div className="b-dims">
      {persona.dims.map((d, i) => {
        const on = open === d.code;
        return (
          <motion.button key={d.code} className={`dim ${on ? "is-open" : ""}`} onClick={() => setOpen(on ? null : d.code)} aria-expanded={on} layout {...rise(0.05 * i)}>
            <span className="dim-code">{d.code}</span>
            <span className="dim-name">{d.name}</span>
            <strong>{d.value.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</strong>
            {on && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                <Rich text={d.text.replace(/\n- /g, " ").replace(/^- /, "")} />
              </motion.p>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

export function Concerns({ persona }: { persona: Johnson["persona"] }) {
  const sorted = [...persona.concerns].sort((a, b) => level[b.level] - level[a.level]);
  return (
    <div className="plate b-concerns">
      {sorted.map((c, i) => (
        <motion.div key={c.code} className={`concern is-l${level[c.level]}`} {...rise(0.06 * i)}>
          <div className="concern-head">
            <span className="concern-code">{c.code}</span>
            <strong>{c.title}</strong>
            <span className="concern-level">
              {[1, 2, 3].map((n) => (
                <motion.i key={n} className={n <= level[c.level] ? "is-on" : ""} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.3 + i * 0.06 + n * 0.05, ease }} />
              ))}
              <small>{c.level.toLowerCase()}</small>
            </span>
          </div>
          <p>
            <Rich text={c.text} />
          </p>
        </motion.div>
      ))}
    </div>
  );
}

export function Tensions({ persona }: { persona: Johnson["persona"] }) {
  const title = (code: string) => persona.concerns.find((c) => c.code === code)?.title ?? code;
  return (
    <div className="plate b-tensions">
      {persona.tensions.map((t, i) => {
        const refs = [...new Set(t.text.match(/\b(O\d|D4[a-c])\b/g) ?? [])].slice(0, 4);
        return (
          <motion.div key={t.code} className={`tension is-l${level[t.level]}`} {...rise(0.1 * i)}>
            <div className="tension-head">
              <span className="concern-code">{t.code}</span>
              <span className="tension-level">{t.level.toLowerCase()}</span>
            </div>
            <div className="tension-pull">
              {refs.map((r, k) => (
                <span key={r}>
                  {k > 0 && <i aria-hidden="true">⟷</i>}
                  <b>{r.startsWith("O") ? title(r) : r === "D4a" ? "What they say about risk" : r === "D4c" ? "Risk their picture adds up to" : r}</b>
                </span>
              ))}
            </div>
            <p>
              <Rich text={t.text} />
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

export function Unknowns({ persona }: { persona: Johnson["persona"] }) {
  const lowConfidence = persona.dims.filter((d) => /confidence is low|Confidence is low/.test(d.text));
  return (
    <div className="b-unknown">
      <motion.p className="unknown-lead" {...rise(0.1)}>
        <Rich text={persona.unknown} />
      </motion.p>
      <div className="unknown-list">
        {lowConfidence.map((d, i) => (
          <motion.div key={d.code} {...rise(0.3 + i * 0.15)}>
            <span className="dim-code">{d.code}</span>
            <strong>{d.name}</strong>
            <small>Read from the plan&apos;s structure, low confidence</small>
          </motion.div>
        ))}
        <motion.div {...rise(0.3 + lowConfidence.length * 0.15)}>
          <span className="dim-code">Alerts</span>
          <strong>Life changes ahead</strong>
          <small>
            <Rich text={persona.alerts} />
          </small>
        </motion.div>
      </div>
    </div>
  );
}
