"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useId, useMemo } from "react";
import type { RidgeFlag, YearPoint } from "@/mock/data";

const W = 640;
const H = 360;
const PAD = { l: 8, r: 8, t: 44, b: 44 };
const IW = W - PAD.l - PAD.r;

const money = (v: number) =>
  v < 500 ? "$0" : Math.abs(v) >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M` : `$${Math.round(v / 1000)}K`;

function ticks(max: number) {
  const step = [250_000, 500_000, 1_000_000, 2_000_000, 5_000_000].find((s) => max / s <= 3.2) ?? 5_000_000;
  const out: number[] = [];
  for (let v = step; v < max; v += step) out.push(v);
  return out;
}

const icons: Record<string, string> = {
  home: "M4 11.5 12 5l8 6.5M6.5 10v8.5h11V10",
  rest: "M4 16h16M7 16a5 5 0 0 1 10 0M12 6v2M5.5 9l1.4 1.4M18.5 9l-1.4 1.4",
  alert: "M12 5 4 18.5h16L12 5Zm0 5.5v4M12 16.6v.4",
  cap: "M3 10l9-4 9 4-9 4-9-4Zm4 2.5V16c2.5 2 7.5 2 10 0v-3.5",
};

const iconFor = (label: string, tone?: string) =>
  tone === "attention" ? "alert" : /stop work|retire/i.test(label) ? "rest" : /college|school/i.test(label) ? "cap" : "home";

// The plan drawn live: the line advances while the guide talks about those years,
// with a glowing head that reads out the age and the amount it is passing through.
export function Ridge({
  yearly,
  toAge,
  flags,
  seconds,
}: {
  yearly: YearPoint[];
  toAge: number;
  flags: RidgeFlag[];
  seconds: number;
}) {
  const id = useId();
  const g = useMemo(() => {
    const a0 = yearly[0].age;
    const a1 = yearly[yearly.length - 1].age;
    const max = Math.max(...yearly.map((p) => p.investable)) * 1.08;
    const min = Math.min(0, ...yearly.map((p) => p.investable));
    const x = (age: number) => PAD.l + ((age - a0) / (a1 - a0)) * IW;
    const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
    const line = yearly.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)} ${y(Math.max(p.investable, 0)).toFixed(1)}`).join("");
    const area = `${line}L${x(a1)} ${y(0)}L${x(a0)} ${y(0)}Z`;
    // Value at any fractional position along the age axis.
    const sample = (f: number) => {
      const pos = Math.min(Math.max(f, 0), 1) * (yearly.length - 1);
      const i = Math.floor(pos);
      const k = pos - i;
      const p = yearly[i];
      const n = yearly[Math.min(i + 1, yearly.length - 1)];
      return { age: p.age + k * (n.age - p.age), v: p.investable + k * (n.investable - p.investable) };
    };
    return { a0, a1, max, x, y, line, area, sample };
  }, [yearly]);

  const reach = Math.min(Math.max(toAge, g.a0), g.a1);
  const target = (reach - g.a0) / (g.a1 - g.a0);
  const f = useMotionValue(0);

  useEffect(() => {
    const controls = animate(f, target, { duration: Math.max(1.2, seconds * 0.86), ease: [0.33, 0.1, 0.25, 1] });
    return () => controls.stop();
  }, [f, target, seconds]);

  const clipW = useTransform(f, (v) => Math.max(1, v * IW));
  const left = useTransform(f, (v) => `${((PAD.l + v * IW) / W) * 100}%`);
  // The readout follows the dot but stays inside the card at both ends.
  const leftSafe = useTransform(f, (v) => `clamp(52px, ${((PAD.l + v * IW) / W) * 100}%, calc(100% - 52px))`);
  const top = useTransform(f, (v) => `${(g.y(Math.max(g.sample(v).v, 0)) / H) * 100}%`);
  const readout = useTransform(f, (v) => {
    const s = g.sample(v);
    return `${money(Math.max(0, s.v))} at ${Math.round(s.age)}`;
  });

  return (
    <figure className="ridge">
      <div className="ridge-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your savings and investments by age">
          <defs>
            <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4565d6" stopOpacity="0.34" />
              <stop offset="1" stopColor="#4565d6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#4565d6" />
              <stop offset="0.6" stopColor="#7a5cf0" />
              <stop offset="1" stopColor="#c46bf2" />
            </linearGradient>
            <clipPath id={`${id}c`}>
              <motion.rect x={PAD.l} y="0" height={H} style={{ width: clipW }} />
            </clipPath>
          </defs>

          {ticks(g.max).map((v) => (
            <g key={v}>
              <line className="ridge-grid" x1={PAD.l} x2={W - PAD.r} y1={g.y(v)} y2={g.y(v)} />
              <text className="ridge-tick" x={PAD.l} y={g.y(v) - 7}>
                {money(v)}
              </text>
            </g>
          ))}
          <line className="ridge-base" x1={PAD.l} x2={W - PAD.r} y1={g.y(0)} y2={g.y(0)} />

          <g clipPath={`url(#${id}c)`}>
            <path d={g.area} fill={`url(#${id}f)`} />
            <path d={g.line} className="ridge-line" stroke={`url(#${id}s)`} />
          </g>

          {flags.map((flag) => {
            const p = yearly.find((q) => q.age >= flag.age) ?? yearly[yearly.length - 1];
            const px = g.x(p.age);
            return (
              <motion.g
                key={flag.label}
                className={`ridge-flag ${flag.tone === "attention" ? "is-attention" : ""}`}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18, delay: Math.max(0, seconds * 0.7 - 0.2) }}
                style={{ transformOrigin: `${px}px ${g.y(0)}px` }}
              >
                <line x1={px} x2={px} y1={g.y(Math.max(p.investable, 0))} y2={g.y(0)} />
                <circle cx={px} cy={g.y(0)} r="15" />
                <path d={icons[flag.icon ?? iconFor(flag.label, flag.tone)]} transform={`translate(${px - 12} ${g.y(0) - 12})`} />
                <text x={px} y={H - 8} textAnchor={px > W * 0.8 ? "end" : px < W * 0.15 ? "start" : "middle"}>
                  {flag.label}
                </text>
              </motion.g>
            );
          })}
        </svg>

        <motion.i className="ridge-dot" style={{ left, top }} />
        <motion.span className="ridge-read" style={{ left: leftSafe, top }}>
          {readout}
        </motion.span>
      </div>
      <figcaption>Savings and investments by age</figcaption>
    </figure>
  );
}
