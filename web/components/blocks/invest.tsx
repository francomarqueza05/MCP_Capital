"use client";

import { motion } from "motion/react";
import type { Johnson } from "@/lib/johnson";
import { Count, ease, Note, pct, rise, short, tone, usd } from "./kit";

/* ---------- The mix today against the target ---------- */

const parts = ["stocks", "bonds", "cash"] as const;
const partName = { stocks: "Stocks", bonds: "Bonds", cash: "Cash" };

export function MixShift({ portfolio }: { portfolio: Johnson["portfolio"] }) {
  const rows = [
    { key: "now", label: "Today", mix: portfolio.now, delay: 0.2 },
    { key: "target", label: "Your target", mix: portfolio.target, delay: 1 },
  ];
  return (
    <div className="plate b-mixshift">
      {rows.map((r) => (
        <div key={r.key} className="shift-row">
          <span className="shift-label">{r.label}</span>
          <div className="shift-bar">
            {parts.map((p, i) => (
              <motion.i
                key={p}
                style={{ background: tone[p] }}
                initial={{ flexGrow: 0.0001 }}
                animate={{ flexGrow: r.mix[p] }}
                transition={{ duration: 0.9, delay: r.delay + i * 0.12, ease }}
              >
                <span>{pct(r.mix[p])}</span>
              </motion.i>
            ))}
          </div>
        </div>
      ))}
      <div className="shift-key">
        {parts.map((p) => (
          <span key={p}>
            <i style={{ background: tone[p] }} />
            {partName[p]}
          </span>
        ))}
      </div>
      <div className="shift-facts">
        <motion.div {...rise(1.8)}>
          <b>
            <Count to={portfolio.return3y * 100} format={(n) => `${n.toFixed(1)}%`} delay={1.8} />
          </b>
          <span>a year, over the last three years</span>
        </motion.div>
        <motion.div {...rise(1.95)}>
          <b>{pct(portfolio.worstFall)}</b>
          <span>the worst fall, back up in {portfolio.recoveryDays} days</span>
        </motion.div>
        <motion.div {...rise(2.1)}>
          <b>{pct(portfolio.tech, 1)}</b>
          <span>of your stocks are in technology</span>
        </motion.div>
      </div>
    </div>
  );
}

/* ---------- Every holding, by account ---------- */

export function HoldingsMap({ portfolio }: { portfolio: Johnson["portfolio"] }) {
  const accounts = [...new Set(portfolio.holdings.map((h) => h.account))]
    .map((a) => {
      const hs = portfolio.holdings.filter((h) => h.account === a).sort((x, y) => y.value - x.value);
      return { name: a, holdings: hs, total: hs.reduce((s, h) => s + h.value, 0) };
    })
    .sort((x, y) => y.total - x.total);
  const kind = (c: string) => (c.includes("Money Market") ? "cash" : /Bond/.test(c) ? "bonds" : c.includes("Allocation") ? "mixed" : "stocks");
  let n = 0;
  return (
    <div className="plate b-holdings">
      <div className="holdings-map">
        {accounts.map((a) => (
          <div key={a.name} className="holdings-acct" style={{ flexGrow: a.total }}>
            <div className="holdings-name">
              <span>{a.name}</span>
              <b>{short(a.total)}</b>
            </div>
            <div className="holdings-tiles">
              {a.holdings.map((h) => (
                <motion.div
                  key={`${h.ticker}-${h.name}-${h.value}`}
                  className={`tile is-${kind(h.category)}`}
                  style={{ flexGrow: h.value }}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + n++ * 0.06, type: "spring", stiffness: 260, damping: 22 }}
                  title={`${h.name}: ${usd(h.value)}`}
                >
                  <b>{h.ticker}</b>
                  <span>{usd(h.value)}</span>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="shift-key">
        <span>
          <i style={{ background: tone.stocks }} />
          Stock funds
        </span>
        <span>
          <i className="is-mixed" />
          Stocks and bonds in one fund
        </span>
        <span>
          <i style={{ background: tone.bonds }} />
          Bond funds
        </span>
        <span>
          <i style={{ background: tone.cash }} />
          Cash
        </span>
      </div>
      <Note>
        {portfolio.holdings.length} holdings and no single company shares. {pct(portfolio.us)} of it is in the United States.
      </Note>
    </div>
  );
}

/* ---------- What saving in a 401(k) gives back ---------- */

export function TaxBack({ retirement }: { retirement: Johnson["retirement"] }) {
  const cut = retirement.taxCut ?? 0;
  const on = retirement.taxCutOn ?? 1;
  const rate = cut / on;
  return (
    <div className="b-taxback">
      <div className="taxback-bar">
        <motion.div className="taxback-in" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1, ease }}>
          <span>
            {usd(on)} more a year into your 401(k){retirement.contributing === 0 && on > (retirement.limitEach ?? on) ? "s" : ""}, up to the limit
          </span>
        </motion.div>
        <motion.div
          className="taxback-out"
          style={{ width: pct(rate, 2) }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: 64, opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.9, ease }}
        >
          <b>
            <Count to={cut} delay={1.4} />
          </b>
        </motion.div>
      </div>
      <motion.p className="taxback-line" {...rise(2.2)}>
        comes back as lower tax every year, at your {pct(rate)} rate. Any employer match would be on top, and isn&apos;t confirmed yet.
      </motion.p>
    </div>
  );
}
