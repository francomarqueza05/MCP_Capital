"use client";

import { motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ease, short } from "./kit";

export type Pt = { x: number; y: number; label?: string };
export type Mark = { x: number; label: string; tone?: "attention" | "good" };

/** A responsive line drawn in real pixels, with a readout that follows the pointer. */
export function LineChart({
  points,
  marks = [],
  format = short,
  xLabel = (x) => String(x),
  height = 300,
  tone = "brand",
  caption,
}: {
  points: Pt[];
  marks?: Mark[];
  format?: (n: number) => string;
  xLabel?: (x: number) => string;
  height?: number;
  tone?: "brand" | "debt";
  caption?: string;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e.contentRect.width > 0 && setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = height;
  const P = { l: 52, r: 14, t: 18, b: 34 };
  const g = useMemo(() => {
    const x0 = points[0].x;
    const x1 = points[points.length - 1].x;
    const max = Math.max(...points.map((p) => p.y)) * 1.08;
    const x = (v: number) => P.l + ((v - x0) / (x1 - x0)) * (W - P.l - P.r);
    const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
    const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.x).toFixed(1)} ${y(p.y).toFixed(1)}`).join("");
    const area = `${line}L${x(x1)} ${y(0)}L${x(x0)} ${y(0)}Z`;
    const step = [100_000, 250_000, 500_000, 1_000_000].find((s) => max / s <= 4.5) ?? 1_000_000;
    const yTicks: number[] = [];
    for (let v = 0; v <= max; v += step) yTicks.push(v);
    const every = W < 480 ? 10 : 5;
    const xTicks = points.filter((p) => p.x % every === 0).map((p) => p.x);
    return { x, y, line, area, yTicks, xTicks, x0, x1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, W, H]);

  const near = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    const px = clientX - r.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(g.x(p.x) - px) < Math.abs(g.x(points[best].x) - px)) best = i;
    });
    setHover(best);
  };

  const h = hover === null ? null : points[hover];
  const c1 = tone === "debt" ? "#f08a7e" : "#4565d6";
  const c2 = tone === "debt" ? "#d9534a" : "#c46bf2";

  return (
    <figure className="lc">
      <div
        ref={box}
        className="lc-plot"
        onPointerMove={(e) => near(e.clientX)}
        onPointerDown={(e) => near(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} style={{ height: H }} role="img" aria-label={caption}>
          <defs>
            <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c1} stopOpacity="0.28" />
              <stop offset="1" stopColor={c1} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${id}s`} x1="0" x2="1">
              <stop offset="0" stopColor={c1} />
              <stop offset="1" stopColor={c2} />
            </linearGradient>
            <clipPath id={`${id}c`}>
              <motion.rect x="0" y="0" height={H} initial={{ width: 0 }} animate={{ width: W }} transition={{ duration: 2.2, ease: [0.45, 0.05, 0.25, 1] }} />
            </clipPath>
          </defs>
          {g.yTicks.map((v) => (
            <g key={v}>
              <line className="lc-grid" x1={P.l} x2={W - P.r} y1={g.y(v)} y2={g.y(v)} />
              <text className="lc-tick" x={P.l - 8} y={g.y(v) + 4} textAnchor="end">
                {format(v)}
              </text>
            </g>
          ))}
          {g.xTicks.map((v) => (
            <text key={v} className="lc-tick" x={g.x(v)} y={H - 10} textAnchor="middle">
              {xLabel(v)}
            </text>
          ))}
          <g clipPath={`url(#${id}c)`}>
            <path d={g.area} fill={`url(#${id}a)`} />
            <path d={g.line} fill="none" stroke={`url(#${id}s)`} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          </g>
          {marks.map((m, i) => {
            const p = points.find((q) => q.x >= m.x) ?? points[points.length - 1];
            const px = g.x(p.x);
            const end = px > W * 0.78;
            return (
              <motion.g
                key={m.label}
                className={`lc-mark ${m.tone ? `is-${m.tone}` : ""}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 + i * 0.25, duration: 0.5 }}
              >
                <line x1={px} x2={px} y1={g.y(p.y)} y2={g.y(0)} />
                <circle cx={px} cy={g.y(p.y)} r="5" />
                <text x={end ? px - 9 : px + 9} y={Math.max(14, g.y(p.y) - 12)} textAnchor={end ? "end" : "start"}>
                  {m.label}
                </text>
              </motion.g>
            );
          })}
          {h && (
            <g className="lc-hover">
              <line x1={g.x(h.x)} x2={g.x(h.x)} y1={P.t} y2={g.y(0)} />
              <circle cx={g.x(h.x)} cy={g.y(h.y)} r="6" />
            </g>
          )}
        </svg>
        {h && (
          <span className="lc-read" style={{ left: `clamp(70px, ${(g.x(h.x) / W) * 100}%, calc(100% - 70px))`, top: g.y(h.y) - 14 }}>
            <b>{format(h.y)}</b> {h.label ?? xLabel(h.x)}
          </span>
        )}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export const moveIn = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease },
});
