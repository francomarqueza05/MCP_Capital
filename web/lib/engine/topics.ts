// The closed list of things a family can ask about. Each topic knows which of the plan's
// labelled facts and which written observations answer it, and which words point to it.
// Anything outside this list is not answered with numbers: the guide says so instead.
import type { CaseData, Fact } from "../cases/load";

export type TopicId =
  | "score"
  | "retirement"
  | "cash"
  | "cashflow"
  | "debt"
  | "protection"
  | "education"
  | "investments"
  | "home";

export type Topic = {
  id: TopicId;
  label: string;
  facts: string[];
  narrative: string[];
  words: RegExp;
  /** How to explain it to someone new to finance. */
  analogy: string;
};

export const TOPICS: Topic[] = [
  {
    id: "score",
    label: "How I'm doing overall",
    facts: ["score"],
    narrative: ["summary_main"],
    words: /\b(okay|ok|doing|overall|score|health|good|bad|fine)\b/i,
    analogy: "The score is like a check-up: it points at what to look at first, it is not a grade on you.",
  },
  {
    id: "retirement",
    label: "Retirement",
    facts: ["spendingNeed", "guaranteedIncome", "incomeShareOfNeed", "spendingGap", "savingsRunOut", "savingsLeftAtPlanEnd", "withdrawalRateAverage"],
    narrative: ["retirement_short_observations", "retirement_what_to_look_into"],
    words: /retir|stop work|old age|pension|social security|savings run out|withdraw|401|ira\b/i,
    analogy: "Think of retirement savings as a reservoir: you fill it while you work, and the plan checks it lasts as long as you do.",
  },
  {
    id: "cash",
    label: "Cash and safety net",
    facts: ["accessibleCash", "monthsCovered", "emergencyReserve", "cashAboveReserve", "totalCashNeeded", "monthsCoveredAfterNearTermGoals"],
    narrative: ["protection_emergency_fund_short_observations"],
    words: /cash|reserve|liquid|emergency|cushion|safety net|idle|down ?payment/i,
    analogy: "The reserve is the months you could keep living normally if income stopped tomorrow.",
  },
  {
    id: "cashflow",
    label: "Monthly cash flow",
    facts: ["netCashFlowThisYear"],
    narrative: ["savings_short_observations", "savings_what_to_look_into"],
    words: /cash ?flow|budget|spend|shortfall|month to month|savings rate|save more/i,
    analogy: "Cash flow is what is left of each paycheck after everything that goes out.",
  },
  {
    id: "debt",
    label: "Debt",
    facts: [],
    narrative: ["debt_short_observations", "debt_what_to_look_into"],
    words: /debt|card|loan|mortgage|interest|owe/i,
    analogy: "High-interest debt works like savings in reverse: it grows against you every month.",
  },
  {
    id: "protection",
    label: "Insurance and protection",
    facts: [],
    narrative: ["protection_intro", "protection_life_insurance_short_observations", "protection_umbrella_short_observations"],
    words: /insur|life cover|umbrella|disab|protect|if something happen|die|death|kids safe|safe/i,
    analogy: "Insurance is renting a safety net, so one bad day cannot undo years of saving.",
  },
  {
    id: "education",
    label: "College",
    facts: [],
    narrative: ["savings_short_observations"],
    words: /college|529|educat|tuition|school|universit/i,
    analogy: "College saving is one more goal with a fixed date, so time is the main ingredient.",
  },
  {
    id: "investments",
    label: "Investments",
    facts: [],
    narrative: ["assets_short_observations", "assets_what_to_look_into"],
    words: /invest|stock|portfolio|allocation|risk|market|concentrat|etf|bond/i,
    analogy: "Your mix of investments decides how bumpy the ride is, and how far it can go.",
  },
  {
    id: "home",
    label: "Buying a home",
    facts: ["accessibleCash", "totalCashNeeded"],
    narrative: ["summary_main"],
    words: /home|house|buy(ing)? a|purchase|apartment|condo/i,
    analogy: "Money for a purchase in the next year or two is short-term money: it should not ride the market.",
  },
];

export const topicById = (id: string) => TOPICS.find((t) => t.id === id) ?? null;

/** Which topic a free-text answer or a concern points to, by the first matching word list. */
export function classify(text: string | null | undefined, order: TopicId[] = TOPICS.map((t) => t.id)): TopicId | null {
  if (!text) return null;
  for (const id of order) if (topicById(id)!.words.test(text)) return id;
  return null;
}

/** A concern's topic: specific topics first, the overall score last. */
export const concernTopic = (text: string) =>
  classify(text, ["retirement", "protection", "education", "home", "debt", "cash", "cashflow", "investments", "score"]);

export function topicFacts(c: CaseData, id: TopicId): Fact[] {
  const t = topicById(id)!;
  const ids = new Set(t.facts);
  // nearTermGoals is a list; it belongs with cash and home.
  const goals = c.facts.filter((f) => f.id.startsWith("nearTermGoals"));
  if (id === "home") {
    // The purchase itself first, then the cash that has to cover it. Holidays are not a home topic.
    const purchase = goals.filter((f) => /home|house|purchase/i.test(f.label));
    return [...purchase, ...c.facts.filter((f) => ids.has(f.id))];
  }
  return [...c.facts.filter((f) => ids.has(f.id)), ...(id === "cash" ? goals : [])];
}

export function topicNotes(c: CaseData, id: TopicId): string[] {
  return topicById(id)!.narrative.map((k) => c.narrative[k]).filter(Boolean);
}
