// Spanish for what the family sees. The plans are written in English; fixed interface words
// come from a dictionary, and the plan's own sentences are translated once by a fast model
// and cached. A translation that changes any figure is thrown away and the English is kept.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ask } from "../llm/router";

export type Lang = "es" | "en";
export const LANGS: Lang[] = ["es", "en"];
export const asLang = (v: unknown): Lang => (v === "en" ? "en" : "es");

const file = join(process.cwd(), ".cache", "translations-es.json");
let memo: Record<string, string> | null = null;

function cache() {
  if (!memo) {
    try {
      memo = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
    } catch {
      memo = {};
    }
  }
  return memo!;
}

function persist() {
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(cache(), null, 1));
  } catch {}
}

/** Every number in a string, so a translation can be checked figure by figure. */
const figures = (s: string) => (s.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]$/, "")).sort().join("|");

const FIXED: Record<string, string> = {
  "Before the numbers": "Antes de los números",
  "Where you stand": "Dónde estás",
  "What stands out": "Lo que más destaca",
  "What pulls against what": "Lo que tira en contra",
  "The road ahead": "El camino por delante",
  "Your first step": "Tu primer paso",
  "Making it happen": "Ponerlo en marcha",
  Retirement: "Jubilación",
  "Cash and safety net": "Efectivo y colchón",
  "Monthly cash flow": "Flujo de caja mensual",
  Debt: "Deudas",
  "Insurance and protection": "Seguros y protección",
  College: "Universidad",
  Investments: "Inversiones",
  "Buying a home": "Comprar una casa",
  "How I'm doing overall": "Cómo voy en general",
  "Keep it simple": "Explícamelo fácil",
  "I know the basics": "Sé lo básico",
  "Give me the detail": "Dame el detalle",
  "Yes, roughly": "Sí, más o menos",
  "No, that's news to me": "No, no lo sabía",
  "Yes, Saturday": "Sí, el sábado",
  "Not yet": "Todavía no",
  "You stop working": "Dejas de trabajar",
  "Savings run out": "Se acaban los ahorros",
  "Two goals, one pool of money": "Dos metas, un mismo dinero",
  "Financial health score": "Puntuación de salud financiera",
};

/** Translate many strings at once; anything that fails stays in English. */
export async function toSpanish(texts: string[]): Promise<string[]> {
  const c = cache();
  const todo = [...new Set(texts.filter((t) => t && !FIXED[t] && !(t in c)))];
  if (todo.length) {
    const reply = await ask("fast", [
      {
        role: "system",
        content:
          "You translate a personal financial plan for a family in the US into natural Spanish (Spain), warm and plain. " +
          "Keep every number, $ amount, percentage, age, month and year exactly as written. Keep names unchanged. " +
          "Address the reader as tú. Reply only with a JSON array of strings, same length and order as the input.",
      },
      { role: "user", content: JSON.stringify(todo) },
    ]);
    try {
      const out = JSON.parse(String(reply).replace(/^```(json)?|```$/g, "").trim());
      if (Array.isArray(out) && out.length === todo.length) {
        todo.forEach((t, i) => {
          if (typeof out[i] === "string" && out[i].trim() && figures(out[i]) === figures(t)) c[t] = out[i].trim();
        });
        persist();
      }
    } catch {}
  }
  return texts.map((t) => FIXED[t] ?? c[t] ?? t);
}
