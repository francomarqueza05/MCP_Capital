"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { downloadIcs, nextSaturday } from "@/lib/calendar";
import type { Johnson, PersonId } from "@/lib/johnson";
import { rise, short, spring, usd } from "./kit";

export type Depth = "plain" | "detailed";

/* ---------- A term, at two depths ---------- */

export function TermCard({ data, term, depth }: { data: Johnson; term: "529" | "match" | "umbrella"; depth: Depth }) {
  const college = data.ownership.accounts.find((a) => a.name.startsWith("529")) ?? { balance: 0, yearly: 0 };
  const t = {
    "529": {
      name: "529 plan",
      plain: `A savings account just for school. Money in it grows without tax, as long as it's spent on education. Yours holds ${short(college.balance)}, and ${short(college.yearly)} goes in each year.`,
      detailed: `A state-sponsored education account. Contributions aren't federally deductible, but growth and qualified withdrawals (tuition, fees, books, room and board) are tax-free. Yours holds ${usd(college.balance)} with ${usd(college.yearly)} a year going in${data.tension.collegeGap ? `, against a ${usd(data.tension.collegeGap)} funding gap` : ""}.`,
    },
    match: {
      name: "401(k) match",
      plain: "Money your employer adds when you save for retirement at work. If yours offers one and you save nothing, that part of your pay is left on the table.",
      detailed: `An employer contribution tied to your own deferrals, often a percentage of salary. Your plan records no match${data.retirement.contributing === 0 ? " and no deferrals" : ""}; you can defer up to ${usd(data.retirement.limitEach ?? 24500)} a year each, which also lowers taxable income at a ${Math.round(data.taxes.rate * 100)}% marginal rate.`,
    },
    umbrella: {
      name: "Umbrella policy",
      plain: "Extra liability cover that starts where your home and car insurance stop. It protects your savings if someone sues you after an accident.",
      detailed: `Excess liability cover above home and auto limits, usually sold in $1M layers. The plan recommends ${short(data.protection.umbrella.recommended)}; you have ${data.protection.umbrella.has ? short(data.protection.umbrella.has) : "none"}, with ${usd(data.protection.exposed.liquid)} of liquid assets and ${usd(data.protection.exposed.incomes)} of yearly income exposed to a claim.`,
    },
  }[term];
  return (
    <div className="plate b-term">
      <h3>{t.name}</h3>
      <AnimatePresence mode="wait">
        <motion.p
          key={depth}
          initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
          transition={{ duration: 0.3 }}
        >
          {depth === "plain" ? t.plain : t.detailed}
        </motion.p>
      </AnimatePresence>
      <span className="term-depth">{depth === "plain" ? "In plain words" : "In detail"}</span>
    </div>
  );
}

/* ---------- The first step, for both of you ---------- */

export function FirstStep({ data, who }: { data: Johnson; who: PersonId }) {
  const [done, setDone] = useState<string[]>([]);
  const when = nextSaturday();
  const both = done.length === data.household.adults.length;
  const order = [...data.household.adults].sort((a) => (a.id === who ? -1 : 1));
  return (
    <div className={`b-first ${both ? "is-both" : ""}`}>
      <span className="pill is-blue">This week</span>
      <h3>{data.firstStep.title}</h3>
      <p>{data.firstStep.detail}</p>
      <div className="first-people">
        {order.map((a) => {
          const on = done.includes(a.id);
          return (
            <motion.button
              key={a.id}
              aria-pressed={on}
              whileTap={{ scale: 0.96 }}
              onClick={() => setDone((d) => (on ? d.filter((x) => x !== a.id) : [...d, a.id]))}
            >
              <span className="tick">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <motion.path d="M6.5 12.5l3.6 3.6 7.4-8" initial={false} animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ duration: 0.35 }} />
                </svg>
              </span>
              {on ? `${a.name} is on it` : `${a.name} takes it on`}
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        {both ? (
          <motion.p key="both" className="first-next" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring}>
            {data.household.couple ? "You're both on it." : "You're on it."} Your guide will check back in a week.
          </motion.p>
        ) : (
          <motion.div key="cal" className="row" {...rise(0.2)} exit={{ opacity: 0 }}>
            <button
              className="btn btn-ink"
              onClick={() => downloadIcs({ title: data.firstStep.title, description: data.firstStep.detail, start: when })}
            >
              Add to calendar for {when.toLocaleDateString("en-US", { weekday: "long" })}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
