"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { Johnson, PersonId } from "@/lib/johnson";
import { Dial } from "./standing";
import { Count, ease, Note, pct, rise, short, spring, usd } from "./kit";

/* ---------- One leftover, four needs ---------- */

export function CompetingNeeds({ tension }: { tension: Johnson["tension"] }) {
  const corners = ["tl", "tr", "bl", "br"];
  return (
    <div className="b-needs">
      <svg className="needs-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {[
          [31, 30],
          [69, 30],
          [31, 70],
          [69, 70],
        ].map(([x, y], i) => (
          <motion.line
            key={i}
            x1="50"
            y1="50"
            x2={x}
            y2={y}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.6 + i * 0.15, duration: 0.8, ease }}
          />
        ))}
      </svg>
      <motion.div className="needs-pot" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring, delay: 0.1 }}>
        <strong>
          <Count to={Math.abs(tension.free)} />
        </strong>
        <span>{tension.free >= 0 ? "left over each year" : "short each year"}</span>
      </motion.div>
      {tension.needs.map((n, i) => (
        <motion.div key={n.key} className={`need is-${corners[i]}`} {...rise(1 + i * 0.18)}>
          <span>{n.label}</span>
          <b>{n.amount === null ? "Cost not known yet" : usd(n.amount)}</b>
          <small>{n.unit}</small>
          {n.amount !== null && n.unit.startsWith("a year") && tension.free > 0 && (
            <em className={n.amount > tension.free ? "is-over" : ""}>
              {n.amount > tension.free ? `${(n.amount / tension.free).toFixed(1)}× what's left` : `${pct(n.amount / tension.free)} of what's left`}
            </em>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ---------- Try the plan's moves ---------- */

const plain: Record<string, string> = {
  "Raise mortality coverage": "More life cover",
  "Add umbrella cover": "Add an umbrella policy",
  "Raise annual savings": "Save the leftover",
};

export function MoveSimulator({ score }: { score: Johnson["score"] }) {
  const [on, setOn] = useState<string[]>([]);
  const result = (() => {
    if (on.length === 0) return score.value;
    if (on.length === 1) return score.moves.find((m) => m.title === on[0])!.after;
    const hit = score.combos.find((c) => c.moves.length === on.length && on.every((t) => c.moves.includes(t)));
    return hit?.after ?? Math.max(...on.map((t) => score.moves.find((m) => m.title === t)!.after));
  })();
  const toggle = (t: string) => setOn((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]));

  return (
    <div className="plate b-sim">
      <div className="sim-moves">
        {score.moves.map((m, i) => {
          const active = on.includes(m.title);
          return (
            <motion.button key={m.title} className={`sim-move ${active ? "is-on" : ""}`} aria-pressed={active} onClick={() => toggle(m.title)} whileTap={{ scale: 0.97 }} {...rise(0.2 + i * 0.12)}>
              <span className="sim-check" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <motion.path d="M6.5 12.5l3.6 3.6 7.4-8" initial={false} animate={{ pathLength: active ? 1 : 0 }} transition={{ duration: 0.3 }} />
                </svg>
              </span>
              <span className="sim-text">
                <strong>{plain[m.title] ?? m.title}</strong>
                <small>{m.action.split(" to ")[0]}</small>
              </span>
              <span className={`sim-effort is-${m.effort}`}>{m.effort === "low" ? "Quick to do" : "Takes more"}</span>
              <b>+{m.after - score.value}</b>
            </motion.button>
          );
        })}
      </div>
      <div className="sim-out">
        <Dial value={result} bands={score.bands} size="sm" />
        <AnimatePresence mode="wait">
          <motion.p key={result} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            {on.length === 0
              ? "Tap a move to see where it takes your score."
              : result === score.value
                ? "No change."
                : `From ${score.value} to ${result}${on.length > 1 ? ", together" : ""}.`}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------- What each of you says, and what the money says ---------- */

export function RiskSpectrum({ risk, who }: { risk: Johnson["risk"]; who: PersonId }) {
  const stop = (name: string) => risk.scale.indexOf(name);
  const x = (i: number) => `${(i / (risk.scale.length - 1)) * 100}%`;
  const marks = [
    ...risk.people.map((p) => ({ key: p.who, label: p.name, at: stop(p.says), kind: p.who === who ? "is-me" : "is-person" })),
    { key: "hold", label: "Your portfolio", at: stop(risk.readings[1].value), kind: "is-hold" },
    { key: "whole", label: "Your whole picture", at: stop(risk.readings[2].value), kind: "is-whole" },
  ].filter((m) => m.at >= 0);
  return (
    <div className="plate b-risk">
      <div className="risk-scale">
        <motion.i className="risk-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, ease }} />
        {risk.scale.map((s, i) => (
          <span key={s} className="risk-stop" style={{ left: x(i) }}>
            <i />
            <em>{s}</em>
          </span>
        ))}
        {marks.map((m, i) => {
          // Each reading gets its own row, with a stem down to its stop.
          const lv = marks.length - 1 - i;
          const edge = m.at === 0 ? 14 : m.at === risk.scale.length - 1 ? 86 : 50;
          return (
            <motion.span
              key={m.key}
              className={`risk-mark ${m.kind}`}
              style={
                {
                  left: x(m.at),
                  bottom: `${58 + lv * 38}px`,
                  x: `-${edge}%`,
                  "--stem": `${16 + lv * 38}px`,
                  "--edge": `${edge}%`,
                } as React.CSSProperties
              }
              initial={{ opacity: 0, y: -30, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...spring, delay: 0.6 + i * 0.4 }}
            >
              {m.label}
            </motion.span>
          );
        })}
      </div>
      <motion.ul className="risk-why" {...rise(2.4)}>
        {risk.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </motion.ul>
      <div className="risk-accounts">
        {risk.people.map((p, i) => (
          <div key={p.who} className={p.who === who ? "is-me" : ""}>
            <span>
              {p.name}&apos;s 401(k): <b>{pct(p.stocks, 1)}</b> in stocks
            </span>
            <div className="risk-bar">
              <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: p.stocks }} transition={{ duration: 1, delay: 2.6 + i * 0.2, ease }} />
              <em style={{ left: pct(p.benchmark, 1) }}>
                <small>
                  {pct(p.benchmark)} for {p.says}
                </small>
              </em>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Whose name is on what ---------- */

export function WhoHolds({ data, who }: { data: Johnson; who: PersonId }) {
  const names = data.household.adults.map((a) => a.name);
  const cols = names.length > 1 ? [names[1], "Both of you", names[0]] : [names[0]];
  const items = [
    ...data.ownership.accounts.map((a) => ({ ...a, debt: false })),
    ...data.ownership.liabilities.map((l) => ({ ...l, yearly: 0, debt: true })),
  ];
  const col = (o: string[]) => (names.length < 2 ? names[0] : o.length > 1 ? "Both of you" : o[0] ?? "Both of you");
  const allSaving = data.ownership.accounts.reduce((s, a) => s + a.yearly, 0);
  const saver = names.find((n) => data.ownership.accounts.filter((a) => a.owner.length === 1 && a.owner[0] === n).reduce((s, a) => s + a.yearly, 0) === allSaving);
  return (
    <div className="plate b-who">
      <div className={`who-cols is-${cols.length}`}>
        {cols.map((c, ci) => (
          <div key={c} className={`who-col ${c.toLowerCase() === who ? "is-me" : ""}`}>
            <h3>{c}</h3>
            {items
              .filter((it) => col(it.owner) === c)
              .map((it, i) => (
                <motion.div key={it.name} className={`who-item ${it.debt ? "is-debt" : ""}`} {...rise(0.2 + ci * 0.2 + i * 0.08)}>
                  <span>{it.name.replace(` - ${c}`, "")}</span>
                  <b>{it.debt ? `−${short(it.balance)}` : short(it.balance)}</b>
                  {it.yearly > 0 && <small>+{short(it.yearly)} a year</small>}
                </motion.div>
              ))}
          </div>
        ))}
      </div>
      {names.length > 1 && saver && allSaving > 0 && (
        <Note>
          All {usd(allSaving)} saved each year goes into accounts in {saver}&apos;s name. Read from how the plan is set up, not from anything you told us.
        </Note>
      )}
    </div>
  );
}
