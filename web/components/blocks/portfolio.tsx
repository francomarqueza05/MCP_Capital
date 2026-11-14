"use client";

// Blocks for the investment half of the report: the proposal, how the money is held,
// how it performed, through which market events, and what it costs in tax.
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { Johnson } from "@/lib/johnson";
import { Count, ease, Note, pct, rise, short, tone, usd } from "./kit";

const sign = (n: number, d = 1) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(d)}%`;

/* ---------- Today against the proposal ---------- */

export function Proposal({ proposal }: { proposal: Johnson["proposal"] }) {
  const fmt = (v: number | string, kind: string) => (typeof v === "string" ? v : kind === "num" ? v.toFixed(2) : pct(v, 2));
  return (
    <div className="plate b-proposal">
      <div className="proposal-head">
        <span />
        <span>Today</span>
        <span>Proposed</span>
      </div>
      {proposal.rows.map((r, i) => (
        <motion.div key={r.label} className="proposal-row" {...rise(0.1 + i * 0.1)}>
          <span>{r.label}</span>
          <b>{fmt(r.now, r.kind)}</b>
          <b className="is-next">{fmt(r.next, r.kind)}</b>
          {r.kind === "share" && (
            <div className="proposal-split">
              {[r.a!, r.b!].map((v, k) => (
                <div key={k}>
                  <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: v }} transition={{ delay: 0.3 + k * 0.3, duration: 0.8, ease }} />
                </div>
              ))}
            </div>
          )}
        </motion.div>
      ))}
      <Note>Past returns come from a three-year backtest of each mix, not actual results. More stocks earned more in this window, with a slightly deeper fall.</Note>
    </div>
  );
}

/* ---------- Asset classes, today and proposed ---------- */

export function ClassShift({ proposal }: { proposal: Johnson["proposal"] }) {
  const top = Math.max(...proposal.classes.flatMap((c) => [c.now, c.next]));
  return (
    <div className="plate b-classes">
      <div className="shift-key">
        <span>
          <i style={{ background: "#c9cde0" }} />
          Today
        </span>
        <span>
          <i style={{ background: tone.housing }} />
          Proposed
        </span>
      </div>
      {proposal.classes.map((c, i) => (
        <div key={c.label} className="class-row">
          <span>{c.label.replace("U.S.", "US").replace("Non-US", "International").replace("Non-U.S.", "International")}</span>
          <div className="class-bars">
            <motion.i className="is-now" initial={{ scaleX: 0 }} animate={{ scaleX: c.now / top }} transition={{ delay: 0.2 + i * 0.1, duration: 0.7, ease }} />
            <motion.i className="is-next" initial={{ scaleX: 0 }} animate={{ scaleX: c.next / top }} transition={{ delay: 0.5 + i * 0.1, duration: 0.7, ease }} />
          </div>
          <b>
            {pct(c.now)} <em>to</em> {pct(c.next)}
          </b>
        </div>
      ))}
      <div className="class-bench">
        <h3>What the proposed mix is measured against</h3>
        <div className="bench-bar">
          {proposal.benchmark.map((b, i) => (
            <motion.i key={b.ticker} initial={{ flexGrow: 0.0001 }} animate={{ flexGrow: b.weight }} transition={{ delay: 1 + i * 0.1, duration: 0.7, ease }} title={b.name}>
              <span>
                {b.ticker} {pct(b.weight)}
              </span>
            </motion.i>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Accounts by how they are taxed ---------- */

export function Buckets({ buckets }: { buckets: Johnson["buckets"] }) {
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  return (
    <div className="plate b-buckets">
      <div className="buckets-head">
        <strong>
          <Count to={total} />
        </strong>
        <span>across {buckets.reduce((s, b) => s + b.count, 0)} accounts, by how each one is taxed</span>
      </div>
      <div className="buckets-grid">
        {buckets.map((b, i) => (
          <motion.div key={b.label} className={`bucket ${b.amount === 0 ? "is-empty" : ""}`} {...rise(0.2 + i * 0.08)}>
            <div className="bucket-fill">
              <motion.i initial={{ scaleY: 0 }} animate={{ scaleY: b.amount / total }} transition={{ delay: 0.5 + i * 0.08, duration: 0.9, ease }} />
            </div>
            <strong>{b.amount === 0 ? "None" : short(b.amount)}</strong>
            <span>{b.label}</span>
            <small>{b.note}</small>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Three years of results against a fair comparison ---------- */

export function Performance({ performance: p }: { performance: Johnson["performance"] }) {
  const rows = [
    { label: "Grew in three years", you: p.you.cumulative, same: p.same.cumulative, f: (n: number) => sign(n, 2) },
    { label: "A year, on average", you: p.you.yearly, same: p.same.yearly, f: (n: number) => pct(n, 1) },
    { label: "How much it swings", you: p.you.swing, same: p.same.swing, f: (n: number) => pct(n, 1) },
    { label: "Worst fall", you: p.you.worst, same: p.same.worst, f: (n: number) => pct(n, 1) },
    { label: "Return for each unit of risk", you: p.you.sharpe, same: p.same.sharpe, f: (n: number) => n.toFixed(2) },
  ];
  return (
    <div className="plate b-perf">
      <div className="perf-race">
        {[
          { k: "you", label: "Your portfolio", v: p.you.cumulative },
          { k: "same", label: "Same-risk diversified mix", v: p.same.cumulative },
        ].map((r, i) => (
          <div key={r.k} className={`perf-lane is-${r.k}`}>
            <span>{r.label}</span>
            <div>
              <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: r.v / Math.max(p.you.cumulative, p.same.cumulative) }} transition={{ delay: 0.2 + i * 0.2, duration: 1.6, ease }} />
            </div>
            <b>
              <Count to={r.v * 100} format={(n) => `+${n.toFixed(1)}%`} delay={0.2 + i * 0.2} seconds={1.6} />
            </b>
          </div>
        ))}
      </div>
      <div className="perf-table">
        <div className="perf-th">
          <span />
          <span>You</span>
          <span>Comparison</span>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="perf-tr">
            <span>{r.label}</span>
            <b>{r.f(r.you)}</b>
            <b>{r.f(r.same)}</b>
          </div>
        ))}
      </div>
      <div className="perf-capture">
        {[
          { label: "of the market's gains you caught", v: p.up },
          { label: "of the market's losses you took", v: p.down },
        ].map((c, i) => (
          <div key={c.label}>
            <svg viewBox="0 0 44 44" aria-hidden="true">
              <circle cx="22" cy="22" r="18" className="cap-track" />
              <motion.circle cx="22" cy="22" r="18" className={`cap-fill ${i ? "is-down" : ""}`} initial={{ pathLength: 0 }} animate={{ pathLength: c.v }} transition={{ delay: 1 + i * 0.2, duration: 1.2, ease }} />
            </svg>
            <b>{pct(c.v)}</b>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
      <Note>
        {p.window.from.slice(0, 7)} to {p.window.to.slice(0, 7)}. The worst fall was recovered in {p.recovery} days. Against the comparison, {short(Math.abs(p.gap.mix))} a year of the gap comes from
        the mix and {short(Math.abs(p.gap.funds))} from the funds chosen.
      </Note>
    </div>
  );
}

/* ---------- Each account's results ---------- */

export function AccountReturns({ performance }: { performance: Johnson["performance"] }) {
  const top = Math.max(...performance.accounts.map((a) => a.yearly));
  return (
    <div className="plate b-accts">
      {performance.accounts.map((a, i) => (
        <div key={a.name} className="acct-row">
          <div className="acct-name">
            <strong>{a.name}</strong>
            <small>
              {short(a.balance)}, swings {pct(a.swing, 1)}
            </small>
          </div>
          <div className="acct-track">
            <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: a.yearly / top }} transition={{ delay: 0.2 + i * 0.12, duration: 0.9, ease }} />
          </div>
          <b>{pct(a.yearly, 1)}</b>
        </div>
      ))}
      <Note>A year, over three years. Bonds sit inside the 401(k)s, the right kind of account for their tax treatment.</Note>
    </div>
  );
}

/* ---------- Market events and regimes, on one timeline ---------- */

export function MarketTimeline({ market }: { market: Johnson["market"] }) {
  const t0 = new Date("2023-07-01").getTime();
  const t1 = new Date("2026-11-30").getTime();
  const x = (d: string) => ((new Date(d).getTime() - t0) / (t1 - t0)) * 100;
  const [pick, setPick] = useState(6);
  const ev = market.events[pick];
  return (
    <div className="plate b-market">
      <div className="market-track">
        {market.periods.map((p, i) => (
          <motion.span
            key={p.name}
            className={`market-period is-${p.theme.split(" ")[0].toLowerCase()}`}
            style={{ left: `${x(p.from)}%`, width: `${x(p.to) - x(p.from)}%`, top: `${(i % 2) * 14}px` }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.6, ease }}
            title={`${p.name}: ${p.text}`}
          />
        ))}
        <div className="market-events">
          {market.events.map((e, i) => (
            <motion.button
              key={e.name}
              className={`market-ev is-${e.impact.toLowerCase()} ${i === pick ? "is-on" : ""}`}
              style={{ left: `${x(e.date)}%` }}
              onClick={() => setPick(i)}
              aria-pressed={i === pick}
              aria-label={e.name}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6 + i * 0.07, type: "spring", stiffness: 400, damping: 18 }}
            />
          ))}
        </div>
        <div className="market-axis">
          {["2024", "2025", "2026"].map((y) => (
            <span key={y} style={{ left: `${x(`${y}-01-01`)}%` }}>
              {y}
            </span>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={ev.name} className="market-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
          <div className="market-card-head">
            <span className={`market-impact is-${ev.impact.toLowerCase()}`}>{ev.impact}</span>
            <small>
              {new Date(ev.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}, {ev.type}
            </small>
          </div>
          <h4>{ev.name}</h4>
          <p>{ev.text}</p>
          {ev.you !== null && ev.same !== null && (
            <div className="market-vs">
              <span>
                Your portfolio <b>{sign(ev.you)}</b>
              </span>
              <span>
                Comparison <b>{sign(ev.same)}</b>
              </span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="market-step">
        <button className="btn btn-line" onClick={() => setPick((p) => Math.max(0, p - 1))} disabled={pick === 0}>
          Earlier event
        </button>
        <span>
          {pick + 1} of {market.events.length}
        </span>
        <button className="btn btn-line" onClick={() => setPick((p) => Math.min(market.events.length - 1, p + 1))} disabled={pick === market.events.length - 1}>
          Later event
        </button>
      </div>
      <Note>Tap a dot or step through the events. The bands behind are the market regimes the report describes.</Note>
    </div>
  );
}

/* ---------- Historical scenarios ---------- */

export function Scenarios({ market }: { market: Johnson["market"] }) {
  const top = Math.max(...market.scenarios.flatMap((s) => [Math.abs(s.now), Math.abs(s.next)]));
  return (
    <div className="plate b-scen">
      <div className="shift-key">
        <span>
          <i style={{ background: "#9aa3c7" }} />
          Today&apos;s mix, 54 / 46
        </span>
        <span>
          <i style={{ background: tone.housing }} />
          Proposed, 66 / 34
        </span>
      </div>
      <div className="scen-grid">
        {market.scenarios.map((s, i) => (
          <div key={s.name} className="scen">
            <div className="scen-bars">
              {[s.now, s.next].map((v, k) => (
                <div key={k} className={`scen-col ${k ? "is-next" : ""}`}>
                  <motion.i
                    className={v < 0 ? "is-down" : "is-up"}
                    style={{ height: pct(Math.abs(v) / top / 2, 2) }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.2 + i * 0.15 + k * 0.1, duration: 0.8, ease }}
                  >
                    <b>{sign(v)}</b>
                  </motion.i>
                </div>
              ))}
            </div>
            <strong>{s.name}</strong>
            <small>{s.when}</small>
          </div>
        ))}
      </div>
      <Note>Read from the chart on page 17 of the report. Backtests of each mix, not actual results.</Note>
    </div>
  );
}

/* ---------- Sectors and regions ---------- */

export function Exposure({ exposure }: { exposure: Johnson["exposure"] }) {
  const sTop = exposure.sectors[0].weight;
  const regions = exposure.regions.filter((r) => r.weight >= 0.004);
  return (
    <div className="plate b-expo">
      <div className="expo-col">
        <h3>Your stocks, by sector</h3>
        {exposure.sectors.slice(0, 8).map((s, i) => (
          <div key={s.name} className={`expo-row ${s.flag === "Significant" ? "is-flag" : ""}`}>
            <span>{s.name}</span>
            <div>
              <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: s.weight / Math.max(sTop, 0.4) }} transition={{ delay: 0.1 + i * 0.06, duration: 0.7, ease }} />
              <em style={{ left: pct(0.35 / Math.max(sTop, 0.4), 2) }} />
            </div>
            <b>{pct(s.weight, 1)}</b>
          </div>
        ))}
        <small className="expo-hint">The line marks 35%, where one sector starts to dominate.</small>
      </div>
      <div className="expo-col">
        <h3>Everything, by region</h3>
        <div className="expo-world">
          {regions.map((r, i) => (
            <motion.div key={r.name} style={{ flexGrow: r.weight }} className={i === 0 ? "is-us" : ""} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.06 }}>
              <b>{pct(r.weight, r.weight < 0.1 ? 1 : 0)}</b>
              <span>{r.name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Money left on the table each year ---------- */

export function OnTable({ taxes }: { taxes: Johnson["taxes"] }) {
  const total = taxes.onTable.reduce((s, t) => s + t.amount, 0);
  return (
    <div className="b-table">
      <div className="table-head">
        <strong>
          <Count to={total} seconds={1.8} />
        </strong>
        <span>a year the plan says you may be leaving on the table</span>
      </div>
      <div className="table-stack">
        {taxes.onTable.map((t, i) => (
          <motion.div key={t.label} className={`table-chip ${t.sure ? "is-sure" : ""}`} style={{ flexGrow: t.amount }} initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.25, type: "spring", stiffness: 220, damping: 18 }}>
            <b>{usd(t.amount)}</b>
            <span>{t.label}</span>
            {!t.sure && <small>To confirm</small>}
          </motion.div>
        ))}
      </div>
      <motion.p className="table-line" {...rise(1.6)}>
        Match formulas and HSA eligibility aren&apos;t in the data, so those amounts are estimates to check with each employer. Taxes on the brokerage cost about {usd(taxes.dragCost)} a year.
      </motion.p>
    </div>
  );
}

/* ---------- The plan's order for each saved dollar ---------- */

export function Waterfall({ waterfall }: { waterfall: Johnson["waterfall"] }) {
  const [all, setAll] = useState(false);
  const rows = all ? waterfall : waterfall.filter((w) => w.status !== "Not for you");
  return (
    <div className="plate b-fall">
      <ol>
        {rows.map((w, i) => {
          const fill = w.now !== null && w.target ? Math.min(1, w.now / w.target) : w.status === "Filled" ? 1 : 0;
          return (
            <motion.li key={w.step} className={`fall-row is-${w.status.toLowerCase().replace(/ /g, "-")}`} {...rise(0.05 * i)}>
              <span className="fall-n">{w.step}</span>
              <div className="fall-text">
                <strong>{w.name}</strong>
                <small>
                  {w.status}
                  {w.target !== null && w.now !== null ? `, ${short(w.now)} of ${short(w.target)}` : ""}
                  {w.estimated ? ", estimated" : ""}
                </small>
              </div>
              <div className="fall-meter">
                <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: fill }} transition={{ delay: 0.3 + 0.05 * i, duration: 0.6, ease }} />
              </div>
            </motion.li>
          );
        })}
      </ol>
      <button className="frame-replay fall-toggle" onClick={() => setAll((v) => !v)}>
        {all ? "Hide the steps that don't apply" : `Show all ${waterfall.length} steps`}
      </button>
    </div>
  );
}
