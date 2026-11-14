"use client";

import { motion } from "motion/react";
import type { Johnson } from "@/lib/johnson";
import { cents, Count, ease, Note, pct, rise, usd } from "./kit";

/* ---------- Debts by what they cost ---------- */

export function DebtLadder({ debt }: { debt: Johnson["debt"] }) {
  const top = debt.list[0].rate;
  return (
    <div className="plate b-ladder">
      <div className="ladder-head">
        <span>What each $100 owed costs you a year</span>
      </div>
      {debt.list.map((d, i) => (
        <div key={d.name} className={`ladder-row ${i === 0 ? "is-hot" : ""}`}>
          <div className="ladder-name">
            <strong>{d.kind}</strong>
            <span>{usd(d.balance)} owed</span>
          </div>
          <div className="ladder-track">
            <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: d.rate / top }} transition={{ duration: 1, delay: 0.3 + i * 0.18, ease }} />
          </div>
          <b>
            <Count to={d.rate * 100} format={(n) => `$${n.toFixed(2)}`} delay={0.3 + i * 0.18} seconds={1} />
          </b>
        </div>
      ))}
      <Note>
        {debt.list.length > 1
          ? `Your ${debt.list[0].kind.toLowerCase()} costs ${(top / debt.list[debt.list.length - 1].rate).toFixed(1)} times as much per dollar as your ${debt.list[debt.list.length - 1].kind.toLowerCase()}.`
          : `Your only debt costs ${pct(top, 1)} a year.`}
      </Note>
    </div>
  );
}

/* ---------- Where a card payment goes ---------- */

export function CardBite({ debt }: { debt: Johnson["debt"] }) {
  const c = debt.card!;
  const coin = 25;
  const coins = Math.round(c.monthly / coin);
  const bitten = c.interest / coin;
  return (
    <div className="b-bite">
      <div className="bite-head">
        <strong>{usd(c.monthly)}</strong>
        <span>paid to the card each month</span>
      </div>
      <div className="bite-coins" aria-hidden="true">
        {Array.from({ length: coins }, (_, i) => {
          const f = Math.max(0, Math.min(1, bitten - i));
          return (
            <motion.span key={i} initial={{ opacity: 0, y: -18, rotate: -30 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: i * 0.05, type: "spring", stiffness: 380, damping: 16 }}>
              <motion.i initial={{ scaleY: 0 }} animate={{ scaleY: f }} transition={{ delay: 1.1 + i * 0.07, duration: 0.3 }} />
            </motion.span>
          );
        })}
      </div>
      <div className="bite-split">
        <motion.div className="is-interest" {...rise(1.4)}>
          <b>{cents(c.interest)}</b>
          <span>goes to interest</span>
        </motion.div>
        <motion.div {...rise(1.6)}>
          <b>{cents(c.monthly - c.interest)}</b>
          <span>pays down the {usd(c.balance)}</span>
        </motion.div>
      </div>
      <motion.p className="bite-line" {...rise(2)}>
        At {pct(c.rate, 1)} and {usd(c.monthly)} a month{c.payoff ? `, it is paid off in ${c.payoff}` : ""}.
      </motion.p>
    </div>
  );
}
