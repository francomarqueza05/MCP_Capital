"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useMemo } from "react";
import type { Johnson } from "@/lib/johnson";
import { Count, ease, Note, rise, tone, toWhole, usd } from "./kit";

/* ---------- Score dial ---------- */

const R = 150;
const CX = 180;
const CY = 170;
const at = (v: number, r = R) => {
  const a = Math.PI * (1 - v / 100);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)] as const;
};
const arc = (a: number, b: number, r = R) => {
  const [x0, y0] = at(a, r);
  const [x1, y1] = at(b, r);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

export function Dial({ value, bands, size = "lg" }: { value: number; bands: Johnson["score"]["bands"]; size?: "lg" | "sm" }) {
  const band = bands.find((b) => value < b.to) ?? bands[bands.length - 1];
  const next = bands.find((b) => b.to > value);
  const v = useMotionValue(0);
  useEffect(() => {
    const c = animate(v, value, { duration: 1.8, ease });
    return () => c.stop();
  }, [v, value]);
  const hx = useTransform(v, (n) => at(n)[0]);
  const hy = useTransform(v, (n) => at(n)[1]);
  return (
    <div className={`dial is-${size}`}>
      <svg viewBox="0 0 360 190" aria-hidden="true">
        <defs>
          <linearGradient id="dial-g" x1="0" x2="1">
            <stop offset="0" stopColor="#4565d6" />
            <stop offset="0.6" stopColor="#7a5cf0" />
            <stop offset="1" stopColor="#c46bf2" />
          </linearGradient>
        </defs>
        {bands.map((b, i) => (
          <path key={b.name} className="dial-track" d={arc(i ? bands[i - 1].to + 0.8 : 0, b.to - 0.8)} />
        ))}
        <motion.path
          className="dial-fill"
          d={arc(0, 100)}
          stroke="url(#dial-g)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.max(value, 0.5) / 100 }}
          transition={{ duration: 1.8, ease }}
        />
        {next && (
          <g className="dial-next">
            <line x1={at(next.to, R - 22)[0]} y1={at(next.to, R - 22)[1]} x2={at(next.to, R + 14)[0]} y2={at(next.to, R + 14)[1]} />
          </g>
        )}
        <motion.circle className="dial-head" r="9" style={{ cx: hx, cy: hy }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      </svg>
      <div className="dial-read">
        <strong>
          <Count to={value} format={(n) => String(Math.round(n))} seconds={1.8} />
        </strong>
        <span>out of 100</span>
      </div>
      <motion.span key={band.name} className={`dial-band is-${band.name}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: size === "lg" ? 1.5 : 0.1 }}>
        {band.name[0].toUpperCase() + band.name.slice(1)}
      </motion.span>
    </div>
  );
}

export function ScoreDial({ score }: { score: Johnson["score"] }) {
  const next = score.bands.find((b) => b.to > score.value)!;
  return (
    <div className="b-score">
      <Dial value={score.value} bands={score.bands} />
      <motion.p className="b-score-next" {...rise(1.9)}>
        {next.to - score.value} points from <b>{score.bands[score.bands.indexOf(next) + 1]?.name ?? "the top"}</b>
      </motion.p>
    </div>
  );
}

/* ---------- Five pillars, one cell per point ---------- */

export function Pillars({ score }: { score: Johnson["score"] }) {
  const widest = Math.max(...score.pillars.map((p) => p.max));
  return (
    <div className="plate b-pillars">
      {score.pillars.map((p, row) => (
        <div key={p.key} className={`pillar ${p.got === 0 ? "is-empty" : ""}`}>
          <div className="pillar-head">
            <span>{p.name}</span>
            <b>
              {p.got}
              <small> of {p.max}</small>
            </b>
          </div>
          <div className="pillar-cells" style={{ gridTemplateColumns: `repeat(${widest}, 1fr)` }}>
            {Array.from({ length: p.max }, (_, i) => (
              <motion.i
                key={i}
                className={i < p.got ? "is-on" : ""}
                initial={{ scaleY: 0.2, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ delay: 0.15 + row * 0.12 + i * 0.022, duration: 0.35, ease }}
              />
            ))}
          </div>
        </div>
      ))}
      <Note>Each cell is one point of the 100. The longer the row, the more that area counts.</Note>
    </div>
  );
}

/* ---------- Where a year of income goes ---------- */

const RW = 1000;
const RH = 420;
const GAP = 16;

export function MoneyRiver({ cashflow, focus = "free" }: { cashflow: Johnson["cashflow"]; focus?: string }) {
  const g = useMemo(() => {
    // When outflows exceed income, the gap shows as its own source on the left.
    const spent = cashflow.flows.reduce((s, f) => s + f.amount, 0);
    const total = Math.max(cashflow.income, spent);
    const k = (RH - GAP * (cashflow.flows.length - 1)) / total;
    const srcK = RH / total;
    let left = 0;
    let right = 0;
    const ribbons = cashflow.flows.map((f) => {
      const h = f.amount * k;
      const sh = f.amount * srcK;
      const r = { ...f, y0: left, y1: left + sh, t0: right, t1: right + h };
      left += sh;
      right += h + GAP;
      return r;
    });
    let e = 0;
    const sources = cashflow.free < 0 ? [...cashflow.earners, { name: "Short each year", amount: -cashflow.free }] : cashflow.earners;
    const earners = sources.map((p) => {
      const r = { ...p, y0: e, y1: e + p.amount * srcK };
      e = r.y1;
      return r;
    });
    return { ribbons, earners };
  }, [cashflow]);

  const x0 = 26;
  const x1 = RW - 26;
  const m = (x0 + x1) / 2;
  const path = (r: (typeof g.ribbons)[number]) =>
    `M${x0} ${r.y0}C${m} ${r.y0} ${m} ${r.t0} ${x1} ${r.t0}L${x1} ${r.t1}C${m} ${r.t1} ${m} ${r.y1} ${x0} ${r.y1}Z`;

  return (
    <div className="plate b-river">
      <div className="river-earners">
        {g.earners.map((p, i) => (
          <motion.div key={p.name} className={p.name === "Short each year" ? "is-short" : ""} style={{ top: `${((p.y0 + p.y1) / 2 / RH) * 100}%` }} {...rise(0.1 + i * 0.1)}>
            <span>{p.name}</span>
            <b>{usd(p.amount)}</b>
          </motion.div>
        ))}
      </div>
      <div className="river-plot">
        <svg viewBox={`0 0 ${RW} ${RH}`} preserveAspectRatio="none" aria-label="Where a year of income goes">
          <defs>
            <clipPath id="river-clip">
              <motion.rect x="0" y="0" height={RH} initial={{ width: 0 }} animate={{ width: RW }} transition={{ duration: 2.2, ease: [0.45, 0.05, 0.25, 1] }} />
            </clipPath>
            <linearGradient id="river-free" x1="0" x2="1">
              <stop offset="0" stopColor="#7a5cf0" />
              <stop offset="1" stopColor="#c46bf2" />
            </linearGradient>
          </defs>
          {g.earners.map((p, i) => (
            <motion.rect
              key={p.name}
              x="0"
              width="22"
              y={p.y0 + (i ? 2 : 0)}
              height={p.y1 - p.y0 - 2}
              rx="4"
              className={`river-src ${p.name === "Short each year" ? "is-short" : ""}`}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              style={{ transformOrigin: `0 ${p.y0}px` }}
              transition={{ duration: 0.6, delay: i * 0.12, ease }}
            />
          ))}
          <g clipPath="url(#river-clip)">
            {g.ribbons.map((r) => (
              <motion.path
                key={r.key}
                d={path(r)}
                fill={r.key === "free" ? "url(#river-free)" : tone[r.key]}
                initial={{ opacity: 0.55 }}
                animate={{ opacity: focus && r.key !== focus ? 0.38 : 0.92 }}
                transition={{ delay: 2.4, duration: 0.8 }}
              />
            ))}
            {g.ribbons.map((r) => (
              <rect key={r.key} x={x1} width="26" y={r.t0} height={r.t1 - r.t0} rx="4" fill={r.key === "free" ? "#c46bf2" : tone[r.key]} />
            ))}
          </g>
        </svg>
      </div>
      <div className="river-labels">
        {g.ribbons.map((r, i) => (
          <motion.div
            key={r.key}
            className={r.key === focus ? "is-focus" : ""}
            style={{ top: `${((r.t0 + r.t1) / 2 / RH) * 100}%` }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: focus && r.key !== focus ? 0.55 : 1, x: 0 }}
            transition={{ delay: 1.2 + i * 0.12, duration: 0.5, ease }}
          >
            <i style={{ background: r.key === "free" ? "#c46bf2" : tone[r.key] }} />
            <span>{r.label}</span>
            <b>{usd(r.amount)}</b>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Of every $100 ---------- */

export function HundredDollars({ cashflow }: { cashflow: Johnson["cashflow"] }) {
  const whole = toWhole(
    cashflow.flows.map((f) => f.amount),
    100,
  );
  const dots = whole.flatMap((n, i) => Array.from({ length: n }, () => cashflow.flows[i].key));
  let start = 0;
  const groups = cashflow.flows.map((f, i) => {
    const r = { ...f, n: whole[i], start };
    start += whole[i];
    return r;
  });
  return (
    <div className="b-hundred">
      <div className="hundred-grid" aria-hidden="true">
        {dots.map((key, i) => {
          const gi = groups.findIndex((gr) => gr.key === key);
          return (
            <motion.i
              key={i}
              className={key === "free" ? "is-free" : ""}
              initial={{ opacity: 0, scale: 0.3, backgroundColor: "rgba(255,255,255,0.18)" }}
              animate={{ opacity: 1, scale: 1, backgroundColor: key === "free" ? "#c46bf2" : tone[key] }}
              transition={{
                opacity: { delay: (i % 10) * 0.025 + Math.floor(i / 10) * 0.025, duration: 0.3 },
                scale: { delay: (i % 10) * 0.025 + Math.floor(i / 10) * 0.025, type: "spring", stiffness: 400, damping: 18 },
                backgroundColor: { delay: 1 + gi * 0.45 + (i - groups[gi].start) * 0.012, duration: 0.3 },
              }}
            />
          );
        })}
      </div>
      <ul className="hundred-key">
        {groups.map((gr, i) => (
          <motion.li key={gr.key} className={gr.key === "free" ? "is-free" : ""} {...rise(1 + i * 0.45)}>
            <b>${gr.n}</b>
            <i style={{ background: gr.key === "free" ? "#c46bf2" : tone[gr.key] }} />
            <span>{gr.label}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- How long the cash would last ---------- */

export function Cushion({ cushion }: { cushion: Johnson["cushion"] }) {
  return (
    <div className="plate b-cushion">
      <div className="cushion-read">
        <strong>
          <Count to={cushion.months} format={(n) => n.toFixed(1)} seconds={1.6} delay={0.3} />
          <small> months</small>
        </strong>
        <p>
          Your {usd(cushion.cash)} of cash would cover {cushion.months} months of essentials, at about {usd(cushion.monthly)} a month.
        </p>
      </div>
      <div className="cushion-months" style={{ gridTemplateColumns: `repeat(${cushion.maxMonths}, 1fr)` }}>
        {Array.from({ length: cushion.maxMonths }, (_, i) => {
          const fill = Math.max(0, Math.min(1, cushion.months - i));
          const goal = i >= cushion.minMonths - 1;
          return (
            <div key={i} className={`month ${goal ? "is-goal" : ""}`}>
              <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: fill }} transition={{ delay: 0.3 + i * 0.5, duration: 0.5 * Math.max(fill, 0.01), ease: "linear" }} />
              <span>{i + 1}</span>
            </div>
          );
        })}
        <motion.div
          className="cushion-goal"
          style={{ gridColumn: `${cushion.minMonths} / span ${cushion.maxMonths - cushion.minMonths + 1}` }}
          {...rise(1.4)}
        >
          Recommended {cushion.minMonths} to {cushion.maxMonths} months
        </motion.div>
      </div>
      <Note>
        Reaching {cushion.minMonths} months, with January&apos;s holiday money set aside, means {usd(cushion.gap)} more in cash.
      </Note>
    </div>
  );
}
