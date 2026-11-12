// What the /api/v1 routes do, kept apart from HTTP so it can be tested and reused.
import type { CaseData, Member } from "../cases/load";
import { advance, firstStep, focusConcern, packet, startState, type DoneInput, type SessionState } from "../engine/engine";
import { concernTopic } from "../engine/topics";
import { store, type Owner, type Session } from "../store/store";
import { ApiError } from "./http";

/** Layer 1 of the context: who the guide is talking to. */
export function personaFor(c: CaseData, m: Member, s: SessionState, previous: string | null) {
  const cls = c.persona.classification;
  return {
    name: m.name,
    household: {
      adults: c.members.map((x) => x.name),
      children: c.children.map((k) => `${k.name} (${k.age})`),
      place: c.place,
    },
    level: s.profile.level,
    worry: s.profile.worry,
    worryTopic: s.profile.worryTopic,
    riskProfile: m.riskProfile ?? null,
    motivation: cls.D6 ?? null,
    decisionStyle: cls.D5 ?? null,
    previousConversation: previous,
  };
}

export function view(c: CaseData, m: Member, s: Session, previous: string | null) {
  return {
    session: { id: s.id, done: s.state.done, plan: s.state.plan, phase: s.state.plan[s.state.phase] },
    persona: personaFor(c, m, s.state, previous),
    packet: s.state.done ? null : packet(c, s.state),
  };
}

function summarise(c: CaseData, s: SessionState, accepted: boolean | null) {
  const focus = focusConcern(c, s.profile);
  const step = firstStep(c, focus ? concernTopic(`${focus.title} ${focus.text}`) : null);
  const lost = [...new Set(s.log.filter((l) => l.understood === false).map((l) => l.phase))];
  return [
    s.profile.worry ? `Said what worries them: "${s.profile.worry}".` : "Did not name a worry.",
    focus ? `Talked through: ${focus.title}.` : null,
    lost.length ? `Needed more explanation on: ${lost.join(", ")}.` : null,
    `First step: ${step.title}${accepted === null ? "" : accepted ? " (agreed a day)" : " (not committed yet)"}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

async function previousSummary(o: Owner) {
  const done = (await store.listSessions(o)).filter((s) => s.summary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return done[0] ?? null;
}

export async function openSession(c: CaseData, m: Member, o: Owner) {
  const prev = await previousSummary(o);
  const state = startState(c, m, prev?.state.profile);
  const s = await store.createSession(o, state);
  return view(c, m, s, prev?.summary ?? null);
}

export async function loadSession(c: CaseData, m: Member, o: Owner, id: string) {
  const s = await store.getSession(o, id);
  if (!s) throw new ApiError(404, "not_found", "No such conversation for this person.");
  return view(c, m, s, (await previousSummary(o))?.summary ?? null);
}

function nextSaturday(from = new Date()) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

export async function phaseDone(c: CaseData, m: Member, o: Owner, id: string, input: DoneInput) {
  const s = await store.getSession(o, id);
  if (!s) throw new ApiError(404, "not_found", "No such conversation for this person.");
  if (s.state.done) throw new ApiError(409, "finished", "This conversation has already ended. Open a new one.");
  const { state, accepted } = advance(c, s.state, input);

  let goal = null;
  if (accepted !== null) {
    const focus = focusConcern(c, state.profile);
    const step = firstStep(c, focus ? concernTopic(`${focus.title} ${focus.text}`) : null);
    const existing = (await store.listGoals(o)).find((g) => g.title === step.title && g.status === "open");
    goal = existing ?? (await store.createGoal(o, { title: step.title, detail: step.detail, due: accepted ? nextSaturday() : null }));
  }
  const saved = await store.saveSession(o, id, state, state.done ? summarise(c, state, accepted) : undefined);
  return { ...view(c, m, saved!, null), goal };
}

export async function nextStep(c: CaseData, o: Owner) {
  const goals = await store.listGoals(o);
  const open = goals.find((g) => g.status === "open");
  if (open) return { source: "goal" as const, goal: open };
  const doneTitles = new Set(goals.map((g) => g.detail));
  const rec = c.recommendations.find((r) => !doneTitles.has(r));
  return rec ? { source: "plan" as const, recommendation: rec } : { source: "none" as const };
}

export async function advisorBrief(c: CaseData) {
  const { sessions, goals } = await store.household(c.id);
  return {
    household: c.family,
    score: c.score,
    members: c.members.map((m) => {
      const mine = sessions.filter((s) => s.memberId === m.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const last = mine[0];
      return {
        name: m.name,
        conversations: mine.length,
        lastConversation: last
          ? {
              at: last.updatedAt,
              finished: last.state.done,
              reached: last.state.plan[last.state.phase],
              worry: last.state.profile.worry,
              level: last.state.profile.level,
              summary: last.summary,
              feelings: last.state.log.filter((l) => l.emotion).map((l) => ({ phase: l.phase, emotion: l.emotion })),
            }
          : null,
        goals: goals.filter((g) => g.memberId === m.id),
      };
    }),
  };
}
