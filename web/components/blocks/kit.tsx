"use client";

import { animate, motion, useInView } from "motion/react";
import { useEffect, useRef } from "react";

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const short = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`
    : Math.abs(n) >= 1000
      ? `$${Math.round(n / 1000)}K`
      : usd(n);
export const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;

export const ease = [0.22, 0.8, 0.24, 1] as const;
export const spring = { type: "spring", stiffness: 260, damping: 26 } as const;

// One colour per kind of money, used the same way in every block.
export const tone: Record<string, string> = {
  taxes: "#b4b8cc",
  living: "#7a5cf0",
  housing: "#4565d6",
  saving: "#40c8eb",
  debt: "#f08a7e",
  free: "#c46bf2",
  stocks: "#4565d6",
  bonds: "#9a8cf6",
  cash: "#40c8eb",
};

/** A number that counts up from zero when it first appears. */
export function Count({
  to,
  format = usd,
  seconds = 1.4,
  delay = 0,
  from = 0,
}: {
  to: number;
  format?: (n: number) => string;
  seconds?: number;
  delay?: number;
  from?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef(from);
  useEffect(() => {
    const c = animate(last.current, to, {
      duration: seconds,
      delay,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => {
        last.current = v;
        if (ref.current) ref.current.textContent = format(v);
      },
    });
    return () => c.stop();
  }, [to, seconds, delay, format]);
  return <span ref={ref}>{format(from)}</span>;
}

/** Plays its children once they scroll into view. */
export function OnView({ children, className }: { children: (seen: boolean) => React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.35 });
  return (
    <div ref={ref} className={className}>
      {children(seen)}
    </div>
  );
}

export const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 16, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.6, delay, ease },
});

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <motion.p className="b-note" {...rise(0.9)}>
      {children}
    </motion.p>
  );
}

/** Largest-remainder rounding: whole numbers that still add up to `total`. */
export function toWhole(values: number[], total: number) {
  const sum = values.reduce((a, b) => a + b, 0);
  const raw = values.map((v) => (v / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  raw
    .map((r, i) => ({ i, f: r - Math.floor(r) }))
    .sort((a, b) => b.f - a.f)
    .forEach(({ i }) => {
      if (left-- > 0) out[i]++;
    });
  return out;
}

export const cents = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
