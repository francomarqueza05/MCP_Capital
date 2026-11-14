"use client";

import { motion } from "motion/react";
import type { Johnson, PersonId } from "@/lib/johnson";
import { Count, ease, Note, pct, rise, short, usd } from "./kit";

/* ---------- Four layers between a bad day and the plan ---------- */

export function ShieldRings({ data }: { data: Johnson }) {
  const { protection: p, cushion } = data;
  const lifeHas = p.life.reduce((a, l) => a + l.has, 0);
  const lifeMin = p.life.reduce((a, l) => a + l.min, 0);
  const layers = [
    ...(p.disability > 0
      ? [{ key: "disability", label: "Disability cover", fill: 1, read: p.disability > 1 ? "In place for both" : "In place", note: "amount not on record", dashed: true }]
      : [{ key: "disability", label: "Disability cover", fill: 0, read: "Not on record" }]),
    { key: "cash", label: "Cash cushion", fill: Math.min(1, cushion.months / cushion.minMonths), read: `${cushion.months} of ${cushion.minMonths} months` },
    { key: "life", label: "Life cover", fill: lifeMin > 0 ? Math.min(1, lifeHas / lifeMin) : 1, read: lifeHas >= lifeMin ? `${short(lifeHas)}, within range` : `${short(lifeHas)} of ${short(lifeMin)}` },
    { key: "umbrella", label: "Umbrella cover", fill: p.umbrella.recommended ? Math.min(1, p.umbrella.has / p.umbrella.recommended) : 1, read: p.umbrella.has ? `${short(p.umbrella.has)} of ${short(p.umbrella.recommended)}` : `None of ${short(p.umbrella.recommended)}` },
  ];
  const size = 300;
  return (
    <div className="b-shield">
      <svg className="shield-rings" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="shield-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8fa6ff" />
            <stop offset="1" stopColor="#c46bf2" />
          </linearGradient>
        </defs>
        {layers.map((l, i) => {
          const r = 136 - i * 30;
          return (
            <g key={l.key} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              <circle cx={size / 2} cy={size / 2} r={r} className="shield-track" />
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                className={`shield-fill ${l.dashed ? "is-dashed" : ""} ${l.fill < 0.25 ? "is-low" : ""}`}
                stroke={l.fill < 0.25 ? undefined : "url(#shield-g)"}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: Math.max(l.fill, 0.002) }}
                transition={{ duration: 1.4, delay: 0.3 + i * 0.35, ease }}
              />
            </g>
          );
        })}
        <g className="shield-home" transform={`translate(${size / 2 - 22} ${size / 2 - 22}) scale(1.85)`}>
          <path d="M4 11.5 12 5l8 6.5M6.5 10v8.5h11V10" />
        </g>
      </svg>
      <ul className="shield-key">
        {layers.map((l, i) => (
          <motion.li key={l.key} className={l.fill < 0.25 ? "is-low" : ""} {...rise(0.4 + i * 0.35)}>
            <span>{l.label}</span>
            <b>{l.read}</b>
            {l.note && <small>{l.note}</small>}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Life cover against the recommended range ---------- */

export function LifeCover({ protection, who }: { protection: Johnson["protection"]; who: PersonId }) {
  const top = Math.max(...protection.life.map((l) => l.max)) * 1.04;
  const x = (v: number) => pct(v / top, 3);
  const rows = [...protection.life].sort((a) => (a.who === who ? -1 : 1));
  return (
    <div className="plate b-life">
      {rows.map((l, i) => (
        <div key={l.who} className={`life-row ${l.who === who ? "is-me" : ""}`}>
          <div className="life-head">
            <span>{l.name}</span>
            <b>
              <Count to={l.has} format={short} delay={0.3 + i * 0.5} seconds={1} /> today
            </b>
          </div>
          <div className="life-track">
            <motion.div className="life-band" style={{ left: x(l.min), width: x(l.max - l.min) }} {...rise(0.5 + i * 0.5)}>
              <span>
                Recommended {short(l.min)} to {short(l.max)}
              </span>
            </motion.div>
            <motion.i className="life-has" style={{ width: x(l.has) }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, delay: 0.3 + i * 0.5, ease }} />
            {l.min > l.has && (
            <motion.div
              className="life-gap"
              style={{ left: x(l.has), width: x(l.min - l.has) }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.9, delay: 1.3 + i * 0.5, ease }}
            >
              <span>{short(l.min - l.has)} short</span>
            </motion.div>
            )}
          </div>
        </div>
      ))}
      <Note>
        The range is {protection.life[0].multiple[0]} to {protection.life[0].multiple[1]} times {protection.life.length > 1 ? "each salary" : "your salary"}, sized to cover {short(protection.owes)} of debts
        {protection.college ? ` and ${short(protection.college)} of college` : ""} if an income stopped.
      </Note>
    </div>
  );
}

/* ---------- What one large claim could reach ---------- */

export function Umbrella({ protection }: { protection: Johnson["protection"] }) {
  const reach = [
    { label: "Savings and investments", amount: protection.exposed.liquid },
    { label: "Equity in your home and car", amount: protection.exposed.property },
    { label: "A year of both salaries", amount: protection.exposed.incomes },
  ];
  return (
    <div className="b-umbrella">
      <svg className="umbrella-art" viewBox="0 0 320 150" aria-hidden="true">
        <motion.path
          className="umbrella-canopy"
          d="M20 110 C 40 30, 280 30, 300 110 C 280 96, 250 96, 233 110 C 216 96, 186 96, 160 110 C 134 96, 104 96, 87 110 C 70 96, 40 96, 20 110 Z"
          initial={{ pathLength: 0, opacity: 0.2 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease }}
        />
        <motion.text x="160" y="80" textAnchor="middle" {...rise(1.2)}>
          {protection.umbrella.has ? `${short(protection.umbrella.has)} in place` : "Not in place"}
        </motion.text>
      </svg>
      <div className="umbrella-under">
        {reach.map((r, i) => (
          <motion.div key={r.label} {...rise(0.8 + i * 0.25)}>
            <b>{usd(r.amount)}</b>
            <span>{r.label}</span>
          </motion.div>
        ))}
      </div>
      <motion.p className="umbrella-line" {...rise(1.8)}>
        An umbrella policy of {short(protection.umbrella.recommended)} sits over home and car cover, so one large claim stops before it reaches these.
      </motion.p>
    </div>
  );
}
