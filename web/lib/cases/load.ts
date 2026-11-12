// Reads the four Sherpas cases from the repo's cases/ folder and normalises them into the
// shape the phase engine needs. Every figure the guide may say comes from here: the plan's
// own labelled facts (key_metrics.facts), the score, the projection and the persona text.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parsePersona, type Persona } from "./persona";

export type Fact = {
  id: string;
  group: "cash" | "retirement" | "score" | "move";
  label: string;
  value: number | string;
  unit: string;
  period?: string;
  note?: string;
  notToBeConfusedWith?: string[];
};

export type Member = {
  id: string;
  name: string;
  role: "client" | "co-client";
  age: number;
  retirementAge?: number;
  riskProfile?: string;
};

export type Pillar = { name: string; score: number; points: string };
export type Move = { title: string; action: string; effort: string; scoreBefore: number; scoreAfter: number };
export type Goal = { year: number; type: string; name: string };
export type YearPoint = { year: number; age: number; investable: number; netWorth: number };

export type CaseData = {
  id: string;
  family: string;
  place: string;
  members: Member[];
  children: { name: string; age: number }[];
  score: { value: number; band: string; message: string };
  pillars: Pillar[];
  moves: Move[];
  facts: Fact[];
  rules: string[];
  narrative: Record<string, string>;
  recommendations: string[];
  goals: Goal[];
  yearly: YearPoint[];
  runOutAge: number | null;
  persona: Persona;
};

export function casesDir() {
  const candidates = [process.env.CASES_DIR, resolve(process.cwd(), "../cases"), resolve(process.cwd(), "cases")];
  const found = candidates.find((d) => d && existsSync(d));
  if (!found) throw new Error("Cases folder not found: set CASES_DIR");
  return found;
}

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function readFacts(raw: Raw): Fact[] {
  const out: Fact[] = [];
  for (const group of ["cash", "retirement"] as const) {
    for (const [key, val] of Object.entries<Raw>(raw[group] ?? {})) {
      const list = Array.isArray(val) ? val : [val];
      list.forEach((f, i) => {
        if (!f || f.value === null || f.value === undefined) return;
        out.push({
          id: list.length > 1 ? `${key}.${i}` : key,
          group,
          label: f.label,
          value: f.value,
          unit: f.unit,
          period: f.period,
          note: f.note,
          notToBeConfusedWith: f.notToBeConfusedWith,
        });
      });
    }
  }
  return out;
}

function load(id: string, dir: string): CaseData {
  const fh: Raw = JSON.parse(readFileSync(join(dir, id, "financial-health.json"), "utf8"));
  const persona = parsePersona(readFileSync(join(dir, id, "persona.md"), "utf8"));
  const household: Raw[] = fh.case.household;
  const members: Member[] = household
    .filter((h) => h.role !== "child")
    .map((h) => ({
      id: String(h.first_name).toLowerCase(),
      name: h.first_name,
      role: h.role,
      age: h.age,
      retirementAge: h.retirement_age ?? undefined,
      riskProfile: h.risk_profile ?? undefined,
    }));
  const first = members[0];
  const y0 = fh.projections.yearly[0].year;
  const yearly: YearPoint[] = fh.projections.yearly.map((r: Raw) => ({
    year: r.year,
    age: first.age + (r.year - y0),
    investable: Math.round(r.investable_assets),
    netWorth: Math.round(r.net_worth),
  }));
  const runOut = fh.key_metrics.retirementAndOtherGoals?.assetDepletion?.ageWhenTheyRunOutOfLiquidAssets;
  const score = fh.score;

  const facts = readFacts(fh.key_metrics.facts);
  facts.push({ id: "score", group: "score", label: "Financial health score", value: score.published_score, unit: "of 100", period: `band: ${score.band}` });
  for (const p of score.pillars as Raw[]) {
    facts.push({ id: `pillar.${slug(p.pillar)}`, group: "score", label: `${p.pillar} points`, value: p.points_shown_in_app, unit: "points" });
  }

  return {
    id,
    family: members.map((m) => m.name).join(" and ") + " " + (household[0].last_name ?? lastName(id)),
    place: `${fh.case.city}, ${fh.case.state}`,
    members,
    children: household.filter((h) => h.role === "child").map((h) => ({ name: h.first_name, age: h.age })),
    score: { value: score.published_score, band: score.band, message: score.message },
    pillars: (score.pillars as Raw[]).map((p) => ({ name: p.pillar, score: p.score, points: p.points_shown_in_app })),
    moves: (score.top_moves as Raw[]).map((m) => ({
      title: m.title,
      action: m.action,
      effort: m.effort,
      scoreBefore: m.score_before,
      scoreAfter: m.score_after,
    })),
    facts,
    rules: fh.key_metrics.facts.rules ?? [],
    narrative: fh.narrative,
    recommendations: String(fh.narrative.summary_recommendations ?? "")
      .split("\n")
      .map((l) => l.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean),
    goals: (fh.goals.chartGoals as Raw[])
      .filter((g) => g.name)
      .map((g) => ({ year: Number(String(g.date).slice(0, 4)), type: g.goalType, name: g.name })),
    yearly,
    runOutAge: typeof runOut === "number" ? runOut : null,
    persona,
  };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const lastName = (id: string) => {
  const parts = id.split("-");
  return parts[parts.length - 1].replace(/^./, (c) => c.toUpperCase());
};

const cache = new Map<string, CaseData>();

export function caseIds(): string[] {
  const dir = casesDir();
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, "financial-health.json")) && existsSync(join(dir, d, "persona.md")))
    .sort();
}

export function getCase(id: string): CaseData | null {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  if (!cache.has(id)) {
    if (!caseIds().includes(id)) return null;
    cache.set(id, load(id, casesDir()));
  }
  return cache.get(id)!;
}
