// The phase engine. Code, not the language model, decides what the conversation covers and
// in what order. For each phase it builds a packet: the goal, the only figures the guide may
// quote, the plan's own words on the subject, a visual, an exit condition and a fallback
// script. The model only talks; it reports back with phaseDone and the engine moves on.
import type { CaseData, Fact, Member } from "../cases/load";
import type { Concern, Tension } from "../cases/persona";
import { sentence, spoken, type SpokenFact } from "./format";
import { classify, concernTopic, TOPICS, topicById, topicFacts, topicNotes, type TopicId } from "./topics";

export type PhaseId = "discovery" | "today" | "focus" | "tension" | "route" | "step" | "commit";

export type Level = "new" | "basics" | "expert";

export type Profile = {
  memberId: string;
  name: string;
  level: Level;
  worry: string | null;
  worryTopic: TopicId | null;
};

export type Visual =
  | { kind: "none" }
  | { kind: "figure"; fact: SpokenFact }
  | { kind: "ridge"; toAge: number; flags: { age: number; label: string; tone?: "attention" }[] }
  | { kind: "quote"; text: string }
  | { kind: "step"; title: string; detail: string };

export type Packet = {
  phase: PhaseId;
  name: string;
  index: number;
  of: number;
  depth: number;
  goal: string;
  facts: SpokenFact[];
  planSays: string[];
  analogy: string | null;
  visual: Visual;
  ask: { question: string; chips: string[]; field: "worry" | "level" | "accepted" }[];
  exit: string;
  avoid: string[];
  fallback: string[];
  maxTurns: number;
};

export type PhaseLog = { phase: PhaseId; understood?: boolean; emotion?: string; wantsMore?: boolean; at: string };

export type SessionState = {
  phase: number;
  depth: number;
  turns: number;
  plan: PhaseId[];
  profile: Profile;
  log: PhaseLog[];
  done: boolean;
};

export type DoneInput = {
  understood?: boolean;
  emotion?: string;
  wantsMore?: boolean;
  answers?: { worry?: string; level?: string; accepted?: boolean };
};

const NAMES: Record<PhaseId, string> = {
  discovery: "Before the numbers",
  today: "Where you stand",
  focus: "What stands out",
  tension: "What pulls against what",
  route: "The road ahead",
  step: "Your first step",
  commit: "Making it happen",
};

const MAX_TURNS = 4;
const LEVEL_CHIPS = ["Keep it simple", "I know the basics", "Give me the detail"];

// ---------- What to talk about ----------

/** The concern to focus on: the one matching their worry, otherwise the most severe. */
export function focusConcern(c: CaseData, p: Profile): Concern | null {
  const byRank = [...c.persona.concerns].sort((a, b) => b.rank - a.rank);
  if (p.worryTopic && p.worryTopic !== "score") {
    const hit = byRank.find((k) => concernTopic(`${k.title} ${k.text}`) === p.worryTopic);
    if (hit) return hit;
  }
  return byRank[0] ?? null;
}

export function focusTension(c: CaseData, focus: Concern | null): Tension | null {
  const byRank = [...c.persona.tensions].sort((a, b) => b.rank - a.rank);
  return (focus && byRank.find((t) => t.concerns.includes(focus.id))) ?? byRank[0] ?? null;
}

/** The plan's own recommendation that fits the focus, otherwise its first one. */
export function firstStep(c: CaseData, topic: TopicId | null) {
  const rec = (topic && c.recommendations.find((r) => concernTopic(r) === topic)) || c.recommendations[0] || "";
  const move = c.moves.find((m) => concernTopic(`${m.title} ${m.action}`) === topic && m.scoreAfter > m.scoreBefore) ?? null;
  const title = rec.split(/,|;| so | since | because /)[0].trim().replace(/\.$/, "");
  return { title: title.length > 70 ? title.slice(0, 67).trimEnd() + "..." : title, detail: rec, move };
}

export function buildPlan(c: CaseData, p: Profile): PhaseId[] {
  const plan: PhaseId[] = ["discovery", "today"];
  const focus = focusConcern(c, p);
  if (focus) plan.push("focus");
  if (focusTension(c, focus)) plan.push("tension");
  plan.push("route", "step", "commit");
  return plan;
}

// ---------- Packets ----------

const ageAt = (c: CaseData, year: number) => c.yearly.find((y) => y.year >= year)?.age ?? null;

function ridge(c: CaseData): Visual {
  const flags: { age: number; label: string; tone?: "attention" }[] = [];
  const seen = new Set<string>();
  for (const g of c.goals) {
    const label =
      g.type === "RETIREMENT" ? "You stop working" : g.type === "COLLEGE" ? "College" : g.type === "PURCHASE" ? g.name.replace(/^Purchase an? /i, "New ") : null;
    const age = ageAt(c, g.year);
    if (!label || age === null || seen.has(label)) continue;
    seen.add(label);
    flags.push({ age, label });
  }
  if (c.runOutAge) flags.push({ age: c.runOutAge, label: "Savings run out", tone: "attention" });
  return { kind: "ridge", toAge: c.yearly[c.yearly.length - 1].age, flags: flags.sort((a, b) => a.age - b.age) };
}

function strengths(c: CaseData): Fact[] {
  const f = (id: string) => c.facts.find((x) => x.id === id);
  const num = (v: unknown) => (typeof v === "number" ? v : parseFloat(String(v)));
  const out: Fact[] = [];
  const months = f("monthsCovered");
  if (months && num(months.value) >= 6) out.push(months);
  const share = f("incomeShareOfNeed");
  if (share && num(share.value) >= 80) out.push(share);
  const flow = f("netCashFlowThisYear");
  if (flow && num(flow.value) > 0) out.push(flow);
  const left = f("savingsLeftAtPlanEnd");
  if (left) out.push(left);
  return out;
}

export function packet(c: CaseData, s: SessionState): Packet {
  const id = s.plan[s.phase];
  const p = s.profile;
  const focus = focusConcern(c, p);
  const topic = focus ? concernTopic(`${focus.title} ${focus.text}`) : null;
  const simple = p.level === "new";
  const later = s.plan.slice(s.phase + 1).map((x) => NAMES[x]);
  const base = {
    phase: id,
    name: NAMES[id],
    index: s.phase,
    of: s.plan.length,
    depth: s.depth,
    avoid: later.length ? [`Do not get ahead of the plan: ${later.join(", ")} come later.`] : [],
    maxTurns: MAX_TURNS,
  };

  switch (id) {
    case "discovery": {
      const chips = [...new Set([...c.persona.concerns].sort((a, b) => b.rank - a.rank).map((k) => concernTopic(`${k.title} ${k.text}`)).filter(Boolean))]
        .slice(0, 3)
        .map((t) => topicById(t!)!.label);
      return {
        ...base,
        goal: "Learn what worries them most and how much detail they want. Quote no figures yet.",
        facts: [],
        planSays: [],
        analogy: null,
        visual: { kind: "none" },
        ask: [
          { question: "When you think about money, what sits in the back of your mind?", chips: [...chips, "How I'm doing overall"], field: "worry" },
          { question: "How much detail would you like?", chips: LEVEL_CHIPS, field: "level" },
        ],
        exit: "They named a worry, or said they have none, and you know how much detail they want.",
        fallback: [
          `Hi ${p.name}. I'm the guide your advisor's team set up to walk you through your plan. I'm an AI, and you can interrupt me at any point.`,
          "Before any numbers: when you think about money, what sits in the back of your mind?",
        ],
      };
    }

    case "today": {
      const top = [...c.pillars].sort((a, b) => b.score - a.score)[0];
      const pillarFact = c.facts.find((f) => f.label === `${top.name} points`);
      const good = strengths(c);
      const score = c.facts.find((f) => f.id === "score")!;
      const facts = [...(pillarFact ? [pillarFact] : []), ...good.slice(0, s.depth ? 3 : 2), score];
      const hard = ["critical", "vulnerable"].includes(c.score.band.toLowerCase());
      return {
        ...base,
        goal: `Start from what is working. Mention the score only after the strengths, as a starting point${hard ? ", and do not dwell on it" : ""}.`,
        facts: facts.map(spoken),
        planSays: [c.narrative.summary_main].filter(Boolean),
        analogy: simple ? topicById("score")!.analogy : null,
        visual: good[0] ? { kind: "figure", fact: spoken(good[0]) } : { kind: "figure", fact: spoken(score) },
        ask: [],
        exit: "They have heard one strength and know where the score stands.",
        fallback: [
          `Let's start with what's working. Your strongest area is ${top.name.toLowerCase()}.`,
          ...good.slice(0, 1).map(sentence),
          `Your plan scores ${c.score.value} out of 100 today. Think of it as a starting point, not a grade.`,
        ],
      };
    }

    case "focus": {
      const facts = topic ? topicFacts(c, topic) : [];
      const shown = facts.slice(0, s.depth ? 6 : 3);
      const notes = topic ? topicNotes(c, topic) : [];
      const visual: Visual =
        topic === "retirement" ? ridge(c) : shown[0] ? { kind: "figure", fact: spoken(shown[0]) } : { kind: "quote", text: focus!.title };
      return {
        ...base,
        goal: `Explain one thing in plain words: ${focus!.title}. Use only the figures below.`,
        facts: shown.map(spoken),
        planSays: [focus!.text, ...notes.slice(0, s.depth ? 2 : 1)],
        analogy: simple || s.depth ? (topic ? topicById(topic)!.analogy : null) : null,
        visual,
        ask: [],
        exit: "They can say in their own words what the issue is and why it matters to them.",
        fallback: [`What stands out most in your plan is this: ${focus!.title.toLowerCase()}.`, ...(shown.length ? shown.slice(0, 2).map(sentence) : [focus!.text])],
      };
    }

    case "tension": {
      const t = focusTension(c, focus)!;
      return {
        ...base,
        goal: "Show that two good goals pull on the same money, without picking for them.",
        facts: [],
        planSays: [t.text],
        analogy: simple ? "It's one paycheck asked to do two jobs at the same time." : null,
        visual: { kind: "quote", text: "Two goals, one pool of money" },
        ask: [{ question: "Does that match what you expected?", chips: ["Yes, roughly", "No, that's news to me"], field: "worry" }],
        exit: "They see the trade-off and have reacted to it.",
        fallback: ["Here is the part that needs a decision.", t.text],
      };
    }

    case "route": {
      const end = c.facts.find((f) => f.id === "savingsRunOut") ?? c.facts.find((f) => f.id === "savingsLeftAtPlanEnd");
      return {
        ...base,
        goal: "Walk the projection left to right: today, the big goals, retirement, the end of the plan.",
        facts: end ? [spoken(end)] : [],
        planSays: [c.narrative.retirement_short_observations].filter(Boolean),
        analogy: simple ? topicById("retirement")!.analogy : null,
        visual: ridge(c),
        ask: [],
        exit: "They have seen where the line goes and where it gets tight.",
        fallback: ["This line is your savings and investments, year by year.", ...(end ? [sentence(end)] : [])],
      };
    }

    case "step": {
      const st = firstStep(c, topic);
      const lift: Fact[] = st.move
        ? [{ id: "move.scoreAfter", group: "move", label: `Score after "${st.move.title}"`, value: st.move.scoreAfter, unit: "of 100", period: `from ${st.move.scoreBefore} today` }]
        : [];
      return {
        ...base,
        goal: "Give one first step, small enough to start this week. Do not list the other recommendations.",
        facts: lift.map(spoken),
        planSays: [st.detail],
        analogy: null,
        visual: { kind: "step", title: st.title, detail: st.detail },
        ask: [],
        exit: "They know the one step and why it comes first.",
        fallback: [`One step to start with: ${st.detail}`],
      };
    }

    case "commit": {
      const st = firstStep(c, topic);
      return {
        ...base,
        goal: "Ask them to commit to a day. Accept a no without pushing; offer to talk again.",
        facts: [],
        planSays: [],
        analogy: null,
        visual: { kind: "step", title: st.title, detail: st.detail },
        ask: [{ question: "Shall I put it in your calendar for Saturday?", chips: ["Yes, Saturday", "Not yet"], field: "accepted" }],
        exit: "They said yes with a day, or chose to wait.",
        fallback: ["Shall I put it in your calendar for Saturday?"],
      };
    }
  }
}

// ---------- Moving through the plan ----------

const LEVELS: Record<string, Level> = { "keep it simple": "new", "i know the basics": "basics", "give me the detail": "expert" };

export function startState(c: CaseData, member: Member, prior?: Partial<Profile>): SessionState {
  const profile: Profile = { memberId: member.id, name: member.name, level: prior?.level ?? "basics", worry: prior?.worry ?? null, worryTopic: prior?.worryTopic ?? null };
  return { phase: 0, depth: 0, turns: 0, plan: buildPlan(c, profile), profile, log: [], done: false };
}

export type Advance = { state: SessionState; accepted: boolean | null };

export function advance(c: CaseData, prev: SessionState, input: DoneInput): Advance {
  const s: SessionState = structuredClone(prev);
  if (s.done) return { state: s, accepted: null };
  const id = s.plan[s.phase];
  const a = input.answers ?? {};

  if (a.worry && id === "discovery") {
    s.profile.worry = a.worry.slice(0, 300);
    s.profile.worryTopic = classify(a.worry);
  }
  if (a.level) s.profile.level = LEVELS[a.level.toLowerCase()] ?? (/simple|new|basic/i.test(a.level) ? "new" : /detail|expert/i.test(a.level) ? "expert" : s.profile.level);

  s.log.push({ phase: id, understood: input.understood, emotion: input.emotion?.slice(0, 40), wantsMore: input.wantsMore, at: new Date().toISOString() });
  s.turns++;

  // Go deeper once if they want more or did not follow; otherwise move on. Never loop.
  const deeper = (input.wantsMore || input.understood === false) && s.depth === 0 && s.turns < MAX_TURNS && id !== "discovery" && id !== "commit";
  if (deeper) {
    s.depth = 1;
    return { state: s, accepted: null };
  }

  if (id === "discovery") s.plan = buildPlan(c, s.profile);
  s.phase++;
  s.depth = 0;
  s.turns = 0;
  if (s.phase >= s.plan.length) {
    s.done = true;
    s.phase = s.plan.length - 1;
  }
  return { state: s, accepted: id === "commit" ? Boolean(a.accepted) : null };
}

export { TOPICS };
