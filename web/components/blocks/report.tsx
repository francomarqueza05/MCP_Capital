"use client";

// Blocks for the financial-health half of the Sherpas report: summary, goals,
// assets, debt, savings and college. Every figure comes from the plan data.
import { motion } from "motion/react";
import { Fragment } from "react";
import type { Johnson } from "@/lib/johnson";
import { LineChart, moveIn } from "./chart";
import { Count, ease, Note, pct, rise, short, tone, usd } from "./kit";

/* ---------- The written analysis, as Sherpas wrote it ---------- */

const FIG = /(\$[\d,]+(?:\.\d+)?(?:\s?(?:million|M|K))?|-?\d+(?:\.\d+)?%|\b\d{1,2} to \d{1,2} months\b|\b(?:19|20)\d{2}\b)/g;

/** Plain text with the figures picked out, and **bold** honoured. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <Fragment key={i}>
            {p.split(FIG).map((s, k) => (k % 2 ? <b key={k}>{s}</b> : s))}
          </Fragment>
        ),
      )}
    </>
  );
}

export function Reading({ text, look, title }: { text: string; look?: string; title?: string }) {
  const bullets = text.trim().startsWith("- ");
  const items = bullets
    ? text
        .trim()
        .split(/\n+- |\n\n- /)
        .map((s) => s.replace(/^- /, "").trim())
    : text.trim().split(/\n\n+/);
  return (
    <div className="plate b-reading">
      {title && <h3>{title}</h3>}
      <div className={bullets ? "reading-list" : "reading-prose"}>
        {items.map((it, i) => {
          const m = it.match(/^\*\*([^*]+)\*\*\s*[—-]\s*([\s\S]*)$/);
          return (
            <motion.div key={i} className="reading-item" {...moveIn(0.08 * i)}>
              {m ? (
                <>
                  <h4>{m[1]}</h4>
                  <p>
                    <Rich text={m[2]} />
                  </p>
                </>
              ) : (
                <p>
                  <Rich text={it} />
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
      {look && (
        <motion.p className="reading-look" {...moveIn(0.1 * items.length)}>
          <Rich text={look.replace("**We should look into**:", "**Worth looking into:**")} />
        </motion.p>
      )}
    </div>
  );
}

/* ---------- The family at a glance ---------- */

export function FamilySnapshot({ data }: { data: Johnson }) {
  const s = data.snapshot;
  const h = data.household;
  const facts = [
    { label: "Income a year", value: s.income, sub: data.cashflow.earners.map((e) => `${e.name} ${short(e.amount)}`).join(", ") },
    { label: "Net worth", value: s.netWorth, sub: `${short(s.investable)} of it invested` },
    { label: "Debt", value: s.debt, sub: `${usd(s.monthly)} a month in payments` },
  ];
  return (
    <div className="plate b-snap">
      <div className="snap-people">
        {[...h.adults.map((a) => ({ name: a.name, age: a.age, note: `Retires at ${a.retireAge}, ${a.risk.toLowerCase()} risk` })), ...h.kids.map((k) => ({ name: k.name, age: k.age, note: "At home" }))].map((p, i) => (
          <motion.div key={p.name} className="snap-person" {...rise(0.1 + i * 0.08)}>
            <span className="snap-avatar" aria-hidden="true">
              {p.name[0]}
            </span>
            <div>
              <strong>
                {p.name}, {p.age}
              </strong>
              <small>{p.note}</small>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="snap-facts">
        {facts.map((f, i) => (
          <motion.div key={f.label} {...rise(0.5 + i * 0.1)}>
            <span>{f.label}</span>
            <b>
              <Count to={f.value} delay={0.5 + i * 0.1} />
            </b>
            <small>{f.sub}</small>
          </motion.div>
        ))}
      </div>
      <Note>
        {h.place}, filing {s.filing}.{" "}
        {s.salaryShare > 0.4 ? `A year of ${data.cashflow.earners.length > 1 ? "both salaries" : "salary"} equals ${pct(s.salaryShare)} of net worth, so the household leans on its paychecks.` : ""}
      </Note>
    </div>
  );
}

/* ---------- The plan's recommendations, in its order ---------- */

export function Recommendations({ text }: { text: string }) {
  const items = text
    .trim()
    .split(/\n+- /)
    .map((s) => s.replace(/^- /, ""));
  return (
    <ol className="plate b-recs">
      {items.map((it, i) => {
        const cut = it.search(/[,:] /);
        const head = cut > 0 ? it.slice(0, cut + 1) : it;
        const rest = cut > 0 ? [it.slice(cut + 2)] : [];
        return (
          <motion.li key={i} {...rise(0.15 + i * 0.12)}>
            <span className="recs-n">{i + 1}</span>
            <p>
              <strong>{head}</strong> <Rich text={rest.join(" ")} />
            </p>
          </motion.li>
        );
      })}
    </ol>
  );
}

/* ---------- Goals ---------- */

const goalIcon: Record<string, string> = {
  RETIREMENT: "M4 16h16M7 16a5 5 0 0 1 10 0M12 6v2M5.5 9l1.4 1.4M18.5 9l-1.4 1.4",
  VACATION: "M3 20h18M6 20c1-6 4-10 6-10s5 4 6 10M12 10V4m0 0 4 2m-4-2-4 2",
  COLLEGE: "M3 10l9-4 9 4-9 4-9-4Zm4 2.5V16c2.5 2 7.5 2 10 0v-3.5",
  PURCHASE: "M4 11.5 12 5l8 6.5M6.5 10v8.5h11V10",
};

export function Goals({ data }: { data: Johnson }) {
  const from = data.timeline.from;
  const retire = data.timeline.retireYear;
  const to = Math.max(retire + 1, ...data.goals.chart.filter((g) => g.type !== "RETIREMENT").map((g) => Math.min(g.to ?? g.from, retire + 1) + 1));
  const x = (y: number) => `${((y - from) / (to - from)) * 100}%`;
  return (
    <div className="b-goals">
      <div className="goals-cards">
        {data.goals.list.map((g, i) => (
          <motion.div key={`${g.type}-${i}`} className={`goal is-${g.type.toLowerCase()}`} {...rise(0.1 + i * 0.12)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={goalIcon[g.type]} />
            </svg>
            <p>
              <Rich text={g.text} />
            </p>
          </motion.div>
        ))}
      </div>
      <div className="goals-track" style={{ height: `${Math.max(3, data.goals.chart.filter((g) => g.type !== "RETIREMENT").length) * 34 + 30}px` }}>
        {data.goals.chart
          .filter((g) => g.type !== "RETIREMENT")
          .map((g, i) => (
            <motion.div
              key={g.name}
              className={`goals-bar is-${g.type.toLowerCase()}`}
              style={{ left: x(g.from), width: `max(110px, ${x(from + Math.min(g.to ?? g.from + 1, to) - g.from)})`, top: `${i * 34}px` }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.6 + i * 0.15, duration: 0.8, ease }}
            >
              <span>
                {g.name.replace(/Take a vacation|Go on vacation/, "A holiday every year")}, {g.from}
                {g.to && g.to !== g.from ? `–${g.to >= to ? "" : g.to}` : ""}
              </span>
            </motion.div>
          ))}
        <motion.div className="goals-retire" style={{ left: x(retire) }} {...rise(1.2)}>
          <span>
            {data.household.couple ? "Both retire" : "You retire"}, {retire}
          </span>
        </motion.div>
        <div className="goals-axis">
          {Array.from({ length: to - from + 1 }, (_, i) => from + i)
            .filter((y) => y === from || y % 5 === 0)
            .map((y) => (
            <span key={y} style={{ left: x(y) }}>
              {y}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Net worth through life ---------- */

export function NetWorthPath({ data }: { data: Johnson }) {
  const pts = data.netWorthPath.map((r) => ({ x: r.age, y: r.value, label: `at ${r.age}, ${r.year}` }));
  const retireAge = data.household.adults[0].retireAge;
  const atRetire = data.netWorthPath.find((r) => r.age === retireAge)!;
  const end = data.netWorthPath[data.netWorthPath.length - 1];
  return (
    <div className="plate b-networth">
      <div className="networth-heads">
        <div>
          <span>Today</span>
          <b>{short(data.snapshot.netWorth)}</b>
        </div>
        <div>
          <span>When you retire</span>
          <b>{short(atRetire.value)}</b>
        </div>
        <div>
          <span>End of the plan</span>
          <b>{short(end.value)}</b>
        </div>
      </div>
      <LineChart
        points={pts}
        marks={[{ x: retireAge, label: data.household.couple ? "Both of you retire" : "You retire" }]}
        xLabel={(a) => `${a}`}
        caption={`Net worth by ${data.household.adults[0].name}'s age, in today's dollars`}
      />
    </div>
  );
}

/* ---------- Where retirement income comes from ---------- */

export function RetirementIncome({ data }: { data: Johnson }) {
  const r = data.retirementIncome;
  const from = data.timeline.retireYear;
  const to = Math.max(from + 10, ...r.streams.map((s) => s.to), ...r.health.map((h) => h.to)) + 1;
  const x = (y: number) => pct((y - from) / (to - from), 2);
  const rows = [
    ...(data.retirement.fromSavings ? [{ label: "Paid from your savings", sub: `About ${usd(data.retirement.fromSavings)} a year, ${short(r.totalDraw)} in all`, from, to: data.retirement.runsOutAt ? from + data.retirement.runsOutAt - data.household.adults[0].retireAge : to - 1, kind: "savings" }] : []),
    ...r.streams.map((s) => ({ label: s.name, sub: `${usd(s.yearly)} a year`, from: s.from, to: s.to, kind: "ss" })),
    ...r.health.map((h) => ({ label: `Health costs, ${h.who}`, sub: `${usd(h.yearly)} a year, rising 5%`, from: h.from, to: h.to, kind: "cost" })),
  ];
  return (
    <div className="plate b-income">
      {rows.map((row, i) => (
        <div key={row.label} className={`income-row is-${row.kind}`}>
          <div className="income-name">
            <strong>{row.label}</strong>
            <small>{row.sub}</small>
          </div>
          <div className="income-track">
            <motion.i
              style={{ left: x(row.from), width: x(from + row.to - row.from) }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.2 + i * 0.12, duration: 0.8, ease }}
            >
              <span>
                {row.from}–{row.to}
              </span>
            </motion.i>
          </div>
        </div>
      ))}
      <div className="income-axis">
        {Array.from({ length: to - from }, (_, i) => from + i)
          .filter((y) => y === from || y % 10 === 0)
          .map((y) => (
          <span key={y} style={{ left: x(y) }}>
            {y}
          </span>
        ))}
      </div>
      <Note>
        Social Security averages {usd(r.ssAverage)} a year over retirement.{data.retirement.runsOutAt ? ` Savings run out at ${data.retirement.runsOutAt}.` : ""} Long-term care is not in the plan.
      </Note>
    </div>
  );
}

/* ---------- What you own, and what's yours after debts ---------- */

const assetTone: Record<string, string> = {
  "Cash account": tone.cash,
  "Investment account": tone.housing,
  "Real estate": tone.living,
  Vehicle: tone.taxes,
};
const assetName: Record<string, string> = {
  "Cash account": "Cash",
  "Investment account": "Investments",
  "Real estate": "Home",
  Vehicle: "Car",
};

export function AssetsBlock({ assets }: { assets: Johnson["assets"] }) {
  const rows = [
    { key: "own", label: "What you own", total: assets.total, get: (r: Johnson["assets"]["rows"][number]) => r.value },
    { key: "yours", label: "Equity in each asset, after its own loan", total: assets.rows.reduce((s, r) => s + r.equity, 0), get: (r: Johnson["assets"]["rows"][number]) => r.equity },
  ];
  return (
    <div className="plate b-assets">
      {rows.map((row, ri) => (
        <div key={row.key} className="assets-row">
          <div className="assets-head">
            <span>{row.label}</span>
            <b>
              <Count to={row.total} delay={0.2 + ri * 0.8} />
            </b>
          </div>
          <div className="assets-bar" style={{ width: pct(row.total / assets.total, 2) }}>
            {assets.rows.map((r, i) => (
              <motion.i
                key={r.type}
                style={{ background: assetTone[r.type] }}
                initial={{ flexGrow: 0.0001 }}
                animate={{ flexGrow: row.get(r) }}
                transition={{ delay: 0.2 + ri * 0.8 + i * 0.1, duration: 0.8, ease }}
              >
                <span>{row.get(r) / row.total > 0.08 ? `${assetName[r.type]} ${short(row.get(r))}` : ""}</span>
              </motion.i>
            ))}
          </div>
        </div>
      ))}
      <div className="shift-key">
        {assets.rows.map((r) => (
          <span key={r.type}>
            <i style={{ background: assetTone[r.type] }} />
            {assetName[r.type]} {short(r.value)}
            {r.equity !== r.value ? `, ${short(r.equity)} yours` : ""}
          </span>
        ))}
      </div>
      <Note>
        Debts not tied to an asset, like cards and student loans, take it to {usd(assets.netWorth)} of net worth.
        {assets.home ? ` The home is ${pct(assets.home.value / assets.total, 1)} of what you own.` : ""}
      </Note>
    </div>
  );
}

export function HomeEquity({ assets }: { assets: Johnson["assets"] }) {
  const h = assets.home!;
  return (
    <div className="plate b-home">
      <div className="home-read">
        <strong>
          <Count to={h.share * 100} format={(n) => `${n.toFixed(1)}%`} />
        </strong>
        <span>
          of your {short(h.value)} home is yours. {short(h.equity)} of equity, {short(h.value - h.equity)} still owed.
        </span>
      </div>
      <div className="home-track">
        <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: h.share }} transition={{ duration: 1.2, delay: 0.3, ease }} />
        {[h.low, h.high].map((v) => (
          <em key={v} style={{ left: pct(v) }}>
            <small>{pct(v)}</small>
          </em>
        ))}
      </div>
      <Note>Lenders look for at least {pct(h.low)}. Above {pct(h.high)} the home becomes a real cushion.</Note>
    </div>
  );
}

/* ---------- Debt ratios against the lines lenders use ---------- */

export function DebtRatios({ ratios }: { ratios: Johnson["debtRatios"] }) {
  const top = 0.55;
  return (
    <div className="plate b-ratios">
      {ratios.ratios.map((r, i) => (
        <div key={r.sub} className="ratio-row">
          <div className="ratio-name">
            <strong>{r.label}</strong>
            <small>{r.sub}</small>
          </div>
          <div className="ratio-track">
            <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: r.value / top }} transition={{ duration: 1, delay: 0.2 + i * 0.15, ease }} />
            {ratios.lines.map((l) => (
              <em key={l} style={{ left: pct(l / top, 2) }} />
            ))}
          </div>
          <b>
            <Count to={r.value * 100} format={(n) => `${n.toFixed(1)}%`} delay={0.2 + i * 0.15} />
          </b>
        </div>
      ))}
      <div className="ratio-legend">
        {ratios.lines.map((l) => (
          <span key={l} style={{ left: pct(l / top, 2) }}>
            {pct(l)}
          </span>
        ))}
      </div>
      <Note>
        The dashed lines are the {ratios.lines.map((l) => pct(l)).join(", ")} levels lenders commonly use. You owe {pct(ratios.ofIncome)} of a year&apos;s income, but the payments fit.
      </Note>
    </div>
  );
}

/* ---------- When the debt is gone ---------- */

export function DebtPayoff({ data }: { data: Johnson }) {
  const df = data.debtRatios.debtFree!;
  const retireAge = data.household.adults[0].retireAge;
  const pts = data.netWorthPath.filter((r) => r.age <= Math.max(df.age + 4, data.household.adults[0].age + 8)).map((r) => ({ x: r.age, y: r.debts, label: `at ${r.age}, ${r.year}` }));
  return (
    <div className="plate b-payoff">
      <LineChart
        points={pts}
        tone="debt"
        marks={[...(retireAge <= df.age + 4 ? [{ x: retireAge, label: "You retire" }] : []), { x: df.age, label: `Debt-free at ${df.age}`, tone: "good" as const }]}
        caption={`Everything you owe, by ${data.household.adults[0].name}'s age`}
        height={260}
      />
      <Note>
        The last payment lands in {df.year}
        {df.age > retireAge ? `, ${df.age - retireAge} years into retirement, so retirement starts with payments still going out.` : `, ${retireAge - df.age} years before you stop working.`}
      </Note>
    </div>
  );
}

/* ---------- Where the monthly payments go ---------- */

export function MonthlyDebt({ debt }: { debt: Johnson["debt"] }) {
  const total = debt.list.reduce((s, d) => s + d.monthly, 0);
  const byPay = [...debt.list].sort((a, b) => b.monthly - a.monthly);
  return (
    <div className="plate b-monthly">
      <div className="monthly-head">
        <strong>
          <Count to={total} />
        </strong>
        <span>in debt payments every month</span>
      </div>
      <div className="monthly-bar">
        {byPay.map((d, i) => (
          <motion.div
            key={d.name}
            className={d.kind === "Credit card" ? "is-hot" : ""}
            initial={{ flexGrow: 0.0001 }}
            animate={{ flexGrow: d.monthly }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.8, ease }}
          >
            <i style={{ height: pct(d.interest / d.monthly, 1) }} />
          </motion.div>
        ))}
      </div>
      <ul className="monthly-list">
        {byPay.map((d, i) => (
          <motion.li key={d.name} className={d.kind === "Credit card" ? "is-hot" : ""} {...rise(0.8 + i * 0.1)}>
            <span>{d.name}</span>
            <b>{usd(d.monthly)}</b>
            <small>
              {usd(d.interest)} interest, {pct(d.rate, 1)}
            </small>
          </motion.li>
        ))}
      </ul>
      <Note>
        The darker part of each column is interest
        {debt.list.some((d) => d.kind === "Mortgage") ? ". Most of the mortgage payment is still interest." : ", the rest pays down what you owe."}
      </Note>
    </div>
  );
}

/* ---------- Every outflow, line by line ---------- */

const groupName: Record<string, string> = {
  Expenses: "Living costs",
  Taxes: "Taxes",
  "Housing Expenses": "Home",
  Savings: "Already saving",
  "Debt Payments": "Debt payments",
};
const groupTone: Record<string, string> = {
  Expenses: tone.living,
  Taxes: tone.taxes,
  "Housing Expenses": tone.housing,
  Savings: tone.saving,
  "Debt Payments": tone.debt,
};

export function OutflowDetail({ data }: { data: Johnson }) {
  const top = Math.max(...data.outflowDetail.flatMap((g) => g.items.map((i) => i.total)));
  let n = 0;
  return (
    <div className="plate b-outflow">
      {data.outflowDetail.map((g) => (
        <div key={g.name} className="outflow-group">
          <div className="outflow-head">
            <i style={{ background: groupTone[g.name] }} />
            <strong>{groupName[g.name] ?? g.name}</strong>
            <b>{usd(g.total)}</b>
          </div>
          {g.items.map((it) => (
            <div key={it.name} className="outflow-item">
              <span>{it.name.replace(" savings", "").replace("Living Expenses", "Everyday living")}</span>
              <div>
                <motion.i
                  style={{ background: groupTone[g.name] }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: it.total / top }}
                  transition={{ delay: 0.1 + n++ * 0.05, duration: 0.7, ease }}
                />
              </div>
              <b>{usd(it.total)}</b>
            </div>
          ))}
        </div>
      ))}
      <div className="outflow-free">
        <span>Left over</span>
        <b>{usd(data.retirement.free)}</b>
      </div>
    </div>
  );
}

/* ---------- Where today's saving goes ---------- */

export function SavingNow({ data }: { data: Johnson }) {
  const s = data.savingNow;
  const rows = [...s.split, { label: "401(k)s", amount: s.retirement }];
  const top = Math.max(...rows.map((r) => r.amount));
  return (
    <div className="plate b-savenow">
      <div className="savenow-head">
        <strong>
          <Count to={s.total} />
        </strong>
        <span>saved a year, {pct(s.rate, 1)} of income</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.label} className={`savenow-row ${r.amount === 0 ? "is-zero" : ""}`}>
          <span>{r.label.replace("529 - College Savings Plan", "529 college plan").replace("Brokerage account", "Brokerage account")}</span>
          <div>
            <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(r.amount / top, 0) }} transition={{ delay: 0.3 + i * 0.12, duration: 0.8, ease }} />
          </div>
          <b>{r.amount === 0 ? "Nothing" : usd(r.amount)}</b>
        </div>
      ))}
      {data.retirement.limitEach && (
        <Note>
          You can put up to {usd(data.retirement.limitEach)} a year {data.household.couple ? "each " : ""}into a 401(k).{" "}
          {s.retirement === 0 ? "Today nothing goes in." : `Today ${usd(data.retirement.contributing)} a year goes in.`}
        </Note>
      )}
    </div>
  );
}

/* ---------- College, child by child ---------- */

export function College({ data }: { data: Johnson }) {
  const c = data.college!;
  const need = c.kids.length * c.perChild;
  return (
    <div className="plate b-college">
      <div className="college-kids">
        {c.kids.map((k, i) => (
          <motion.div key={k.name} className="college-kid" {...rise(0.15 + i * 0.15)}>
            <strong>{k.name}</strong>
            <span>
              {k.age} today, college {k.span.replace(" - ", " to ")}
            </span>
            <div className="college-years">
              {Array.from({ length: 4 }, (_, y) => (
                <motion.i key={y} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.2 + y * 0.08, type: "spring", stiffness: 300, damping: 18 }}>
                  {short(k.perYear)}
                </motion.i>
              ))}
            </div>
            <small>
              {k.yearsTo > 0 ? `In ${k.yearsTo} years.` : "Starting now."}
              {k.stocks ? ` 529 mix for ${k.name}: ${pct(k.stocks)} stocks` : ""}
            </small>
          </motion.div>
        ))}
      </div>
      <div className="college-fund">
        <div className="college-bar">
          <motion.i className="is-have" initial={{ width: 0 }} animate={{ width: pct(c.balance / need, 2) }} transition={{ delay: 1, duration: 0.8, ease }} />
          {c.gap !== null && c.gap > 0 && <motion.i className="is-gap" initial={{ width: 0 }} animate={{ width: pct(Math.min(1, c.gap / need), 2) }} transition={{ delay: 1.5, duration: 0.8, ease }} />}
        </div>
        <div className="college-legend">
          <span>
            <i className="is-have" />
            In the 529 today {usd(c.balance)}, plus {usd(c.yearly)} a year
          </span>
          {c.gap !== null && c.gap > 0 && (
            <span>
              <i className="is-gap" />
              Still to find {usd(c.gap)}
            </span>
          )}
        </div>
      </div>
      <Note>
        {usd(need)} in all, before inflation.{c.extra ? ` About ${usd(c.extra)} more a year closes the gap, rising each year.` : ""}
      </Note>
    </div>
  );
}

/* ---------- The plan's assumptions ---------- */

export function Assumptions({ data }: { data: Johnson }) {
  const a = data.assumptions;
  const top = Math.max(...a.byProfile.map((p) => p.value));
  return (
    <div className="plate b-assume">
      <div className="assume-col">
        <h3>Prices rise each year by</h3>
        {a.inflation.map((r) => (
          <div key={r.label} className="assume-row">
            <span>{r.label}</span>
            <b>{pct(r.value)}</b>
          </div>
        ))}
        <div className="assume-row">
          <span>Both of you live to</span>
          <b>{a.lifeExpectancy}</b>
        </div>
      </div>
      <div className="assume-col">
        <h3>Expected return a year, by risk profile</h3>
        {a.byProfile.map((p, i) => (
          <div key={p.label} className="assume-bar">
            <span>{p.label}</span>
            <div>
              <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: p.value / top }} transition={{ delay: 0.2 + i * 0.08, duration: 0.7, ease }} />
            </div>
            <b>{pct(p.value, 2)}</b>
          </div>
        ))}
      </div>
      <Note>One scenario, month by month, with no Monte Carlo. A projection to plan around, not a forecast.</Note>
    </div>
  );
}
