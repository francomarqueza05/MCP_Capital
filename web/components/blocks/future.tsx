"use client";

import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Johnson, PersonId } from "@/lib/johnson";
import type { RidgeFlag } from "@/mock/data";
import { Ridge } from "../Ridge";
import { Count, ease, Note, pct, rise, short, usd } from "./kit";

/* ---------- The savings line, in the chosen person's ages ---------- */

export function SavingsLine({ data, who }: { data: Johnson; who: PersonId }) {
  const person = data.household.adults.find((a) => a.id === who)!;
  const yearly = useMemo(() => data.yearly.map((r, i) => ({ ...r, age: person.age + i })), [data.yearly, person.age]);
  const ageIn = (y: number) => person.age + (y - data.timeline.from);
  const ev = data.timeline.events;
  const college = ev.find((e) => e.kind === "college");
  const purchase = ev.find((e) => e.kind === "purchase");
  const alert = ev.find((e) => e.kind === "alert");
  const flags: RidgeFlag[] = [
    ...(purchase ? [{ age: ageIn(purchase.year), label: purchase.label.replace("Purchase a", "The"), icon: "home" as const }] : []),
    ...(college ? [{ age: ageIn(college.year), label: "College starts", icon: "cap" as const }] : []),
    { age: ageIn(data.timeline.retireYear), label: data.household.couple ? "You both stop working" : "You stop working", icon: "rest" },
    ...(alert ? [{ age: ageIn(alert.year), label: "Savings run out", icon: "alert" as const, tone: "attention" as const }] : []),
  ];
  return <Ridge yearly={yearly} toAge={yearly[yearly.length - 1].age} flags={flags} seconds={5} />;
}

/* ---------- Four lives on one calendar ---------- */

const kindIcon: Record<string, string> = {
  college: "M3 10l9-4 9 4-9 4-9-4Zm4 2.5V16c2.5 2 7.5 2 10 0v-3.5",
  retire: "M4 16h16M7 16a5 5 0 0 1 10 0M12 6v2M5.5 9l1.4 1.4M18.5 9l-1.4 1.4",
  debt: "M6.5 12.5l3.6 3.6 7.4-8",
  purchase: "M4 11.5 12 5l8 6.5M6.5 10v8.5h11V10",
  alert: "M12 5 4 18.5h16L12 5Zm0 5.5v4M12 16.6v.4",
  income: "M12 5v14M8.5 8.5c0-1.6 1.6-2.5 3.5-2.5s3.5.9 3.5 2.5-1.6 2.2-3.5 2.5-3.5 1-3.5 2.6 1.6 2.4 3.5 2.4 3.5-.8 3.5-2.4",
};

export function FamilyLanes({ data, who }: { data: Johnson; who: PersonId }) {
  const { from, to } = data.timeline;
  const span = to - from;
  const people = [
    ...data.household.adults.map((a) => ({ name: a.name, age: a.age, id: a.id as string })),
    ...data.household.kids.map((k) => ({ name: k.name, age: k.age, id: k.name.toLowerCase() })),
  ];
  const focusYear = data.timeline.retireYear;
  const yr = useMotionValue(from);
  const [now, setNow] = useState(from);
  const scrubbing = useRef(false);
  const plot = useRef<HTMLDivElement>(null);

  useMotionValueEvent(yr, "change", (v) => setNow(Math.round(v)));
  useEffect(() => {
    const c = animate(yr, focusYear, { duration: 4.2, delay: 0.6, ease: [0.4, 0.05, 0.3, 1] });
    return () => c.stop();
  }, [yr, focusYear]);

  const left = useTransform(yr, (v) => `${((v - from) / span) * 100}%`);
  const x = (y: number) => `${((y - from) / span) * 100}%`;

  const scrub = (e: React.PointerEvent) => {
    if (!plot.current || (e.type === "pointermove" && !scrubbing.current && e.pointerType !== "mouse")) return;
    const r = plot.current.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    yr.stop();
    yr.set(from + f * span);
  };

  const onLane = (p: (typeof people)[number]) =>
    data.timeline.events.filter(
      (e) => e.who === p.name || e.who === "all" || (e.who === "adults" && data.household.adults.some((a) => a.name === p.name)),
    );

  const ticks = Array.from({ length: span + 1 }, (_, i) => from + i).filter((y) => y % 2 === 0);

  return (
    <div className="b-lanes">
      <div className="lanes-names">
        {people.map((p) => (
          <span key={p.id} className={p.id === who ? "is-me" : ""}>
            {p.name}
          </span>
        ))}
      </div>
      <div
        ref={plot}
        className="lanes-plot"
        onPointerDown={(e) => {
          scrubbing.current = true;
          scrub(e);
        }}
        onPointerMove={scrub}
        onPointerUp={() => (scrubbing.current = false)}
        onPointerLeave={() => (scrubbing.current = false)}
      >
        {people.map((p, row) => (
          <div key={p.id} className={`lane ${p.id === who ? "is-me" : ""}`}>
            <motion.i className="lane-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.1 + row * 0.08, duration: 0.9, ease }} />
            {onLane(p).map((e) => (
              <span
                key={e.label + e.year}
                className={`lane-ev is-${e.kind} ${now >= e.year ? "is-past" : ""}`}
                style={{ left: x(e.year), width: e.until ? x(from + (e.until - e.year)) : undefined }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={kindIcon[e.kind]} />
                </svg>
                <em>{e.kind === "college" ? "College" : e.kind === "retire" ? "Stops working" : e.label}</em>
              </span>
            ))}
            <motion.b className="lane-age" style={{ left }}>
              {p.age + (now - from)}
            </motion.b>
          </div>
        ))}
        <motion.div className="lanes-cursor" style={{ left }}>
          <span>{now}</span>
        </motion.div>
        <div className="lanes-axis" aria-hidden="true">
          {ticks.map((y) => (
            <span key={y} style={{ left: x(y) }} className={y % 10 === 0 ? "is-decade" : ""}>
              {y}
            </span>
          ))}
        </div>
      </div>
      <ul className="lanes-key">
        {[
          ["college", "College"],
          ["retire", "Stops working"],
          ["purchase", "A purchase"],
          ["debt", "Debt paid off"],
          ["income", "Social Security starts"],
          ["alert", "Savings run out"],
        ]
          .filter(([k]) => data.timeline.events.some((e) => e.kind === k))
          .map(([k, t]) => (
          <li key={k} className={`is-${k}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={kindIcon[k]} />
            </svg>
            {t}
          </li>
        ))}
        <li className="lanes-hint">Drag across the years to see everyone&apos;s age</li>
      </ul>
    </div>
  );
}

/* ---------- Paying for a year of retirement ---------- */

export function RetirementMix({ retirement }: { retirement: Johnson["retirement"] }) {
  const need = retirement.need ?? 0;
  const share = need ? Math.min(1, (retirement.fromIncome ?? 0) / need) : 0;
  const lasts = retirement.runsOutAt ?? retirement.endAge;
  return (
    <div className="plate b-mix">
      <div className="mix-head">
        <strong>
          <Count to={need} seconds={1.4} />
        </strong>
        <span>for each year of retirement, in today&apos;s dollars</span>
      </div>
      <div className="mix-bar">
        <motion.div className="mix-ss" initial={{ width: 0 }} animate={{ width: pct(share, 2) }} transition={{ duration: 1.1, delay: 0.5, ease }}>
          <b>{pct(share)}</b>
          <span>Guaranteed income</span>
        </motion.div>
        <motion.div className="mix-sv" initial={{ width: 0 }} animate={{ width: pct(1 - share, 2) }} transition={{ duration: 1.1, delay: 1.3, ease }}>
          <b>{usd(retirement.fromSavings ?? 0)}</b>
          <span>From your savings</span>
        </motion.div>
      </div>
      <div className="mix-facts">
        <motion.div className={retirement.runsOutAt ? "is-alert" : ""} {...rise(2.2)}>
          <b>{lasts}</b>
          <span>{retirement.runsOutAt ? "The age savings run out" : "The age the money lasts to"}</span>
        </motion.div>
        <motion.div {...rise(2.35)}>
          <b>{retirement.leftAtEnd < 0 ? `−${short(-retirement.leftAtEnd)}` : short(retirement.leftAtEnd)}</b>
          <span>{retirement.leftAtEnd < 0 ? "Short at the end of the plan" : "Left at the end, in today's dollars"}</span>
        </motion.div>
        {retirement.drawRate !== null && (
          <motion.div {...rise(2.5)}>
            <b>{pct(retirement.drawRate, 1)}</b>
            <span>Taken out of savings each year at first</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ---------- Needed against what's left ---------- */

export function GapVsRoom({ retirement }: { retirement: Johnson["retirement"] }) {
  const ratio = retirement.extraPerYear / retirement.free;
  return (
    <div className="plate b-gap">
      <div className="gap-row">
        <span>Extra saving retirement needs, every year</span>
        <motion.i className="gap-need" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.2, delay: 0.3, ease }} />
        <b>
          <Count to={retirement.extraPerYear} delay={0.3} />
        </b>
      </div>
      <div className="gap-row">
        <span>What&apos;s left over each year</span>
        <div className="gap-track">
          <motion.i
            className="gap-free"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            style={{ width: pct(1 / ratio, 2) }}
            transition={{ duration: 1, delay: 1, ease }}
          />
          <motion.em className="gap-miss" style={{ left: pct(1 / ratio, 2) }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.1, duration: 0.6 }}>
            {usd(retirement.extraPerYear - retirement.free)} still missing
          </motion.em>
        </div>
        <b>
          <Count to={retirement.free} delay={1} />
        </b>
      </div>
      <motion.p className="gap-ratio" {...rise(2.4)}>
        <strong>{ratio.toFixed(1)}×</strong> more than what&apos;s left, so the gap can&apos;t close from this year&apos;s cash flow alone.
      </motion.p>
      <Note>The full gap at retirement is {short(retirement.gap)} in today&apos;s dollars.</Note>
    </div>
  );
}
