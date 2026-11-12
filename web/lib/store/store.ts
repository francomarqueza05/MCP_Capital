// Storage behind the API. Every read and write is scoped to one member of one household,
// so a query can never return another person's data. This in-memory version keeps the
// demo running with no setup; a Postgres version implements the same interface.
import { randomUUID } from "node:crypto";
import type { SessionState } from "../engine/engine";

export type Owner = { caseId: string; memberId: string };

export type Session = Owner & { id: string; createdAt: string; updatedAt: string; state: SessionState; summary: string | null };

export type Checkin = { at: string; note: string | null };
export type Goal = Owner & {
  id: string;
  title: string;
  detail: string;
  due: string | null;
  status: "open" | "done";
  createdAt: string;
  checkins: Checkin[];
};

export interface Store {
  createSession(o: Owner, state: SessionState): Promise<Session>;
  getSession(o: Owner, id: string): Promise<Session | null>;
  saveSession(o: Owner, id: string, state: SessionState, summary?: string | null): Promise<Session | null>;
  listSessions(o: Owner): Promise<Session[]>;
  createGoal(o: Owner, g: Pick<Goal, "title" | "detail" | "due">): Promise<Goal>;
  listGoals(o: Owner): Promise<Goal[]>;
  checkin(o: Owner, id: string, note: string | null, done: boolean): Promise<Goal | null>;
  /** Advisor view: everything in one household. Server key only. */
  household(caseId: string): Promise<{ sessions: Session[]; goals: Goal[] }>;
}

const mine = (o: Owner) => (x: Owner) => x.caseId === o.caseId && x.memberId === o.memberId;
const now = () => new Date().toISOString();

class MemoryStore implements Store {
  sessions = new Map<string, Session>();
  goals = new Map<string, Goal>();

  async createSession(o: Owner, state: SessionState) {
    const s: Session = { ...o, id: randomUUID(), createdAt: now(), updatedAt: now(), state, summary: null };
    this.sessions.set(s.id, s);
    return structuredClone(s);
  }
  async getSession(o: Owner, id: string) {
    const s = this.sessions.get(id);
    return s && mine(o)(s) ? structuredClone(s) : null;
  }
  async saveSession(o: Owner, id: string, state: SessionState, summary?: string | null) {
    const s = this.sessions.get(id);
    if (!s || !mine(o)(s)) return null;
    s.state = state;
    s.updatedAt = now();
    if (summary !== undefined) s.summary = summary;
    return structuredClone(s);
  }
  async listSessions(o: Owner) {
    return [...this.sessions.values()].filter(mine(o)).map((s) => structuredClone(s));
  }
  async createGoal(o: Owner, g: Pick<Goal, "title" | "detail" | "due">) {
    const goal: Goal = { ...o, ...g, id: randomUUID(), status: "open", createdAt: now(), checkins: [] };
    this.goals.set(goal.id, goal);
    return structuredClone(goal);
  }
  async listGoals(o: Owner) {
    return [...this.goals.values()].filter(mine(o)).map((g) => structuredClone(g));
  }
  async checkin(o: Owner, id: string, note: string | null, done: boolean) {
    const g = this.goals.get(id);
    if (!g || !mine(o)(g)) return null;
    g.checkins.push({ at: now(), note });
    if (done) g.status = "done";
    return structuredClone(g);
  }
  async household(caseId: string) {
    return {
      sessions: [...this.sessions.values()].filter((s) => s.caseId === caseId).map((s) => structuredClone(s)),
      goals: [...this.goals.values()].filter((g) => g.caseId === caseId).map((g) => structuredClone(g)),
    };
  }
}

// One instance per server process, kept across hot reloads in development.
const g = globalThis as unknown as { __cordadaStore?: Store };
export const store: Store = (g.__cordadaStore ??= new MemoryStore());
export const newMemoryStore = (): Store => new MemoryStore();
