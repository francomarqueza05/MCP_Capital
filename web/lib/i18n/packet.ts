// A phase packet in the family's language: everything shown on screen or said by the
// scripted guide. The live agent gets the English original plus orders to speak Spanish,
// because the model translates while it talks and the figures stay untouched.
import type { Packet } from "../engine/engine";
import { toSpanish, type Lang } from "./translate";

export async function localize(p: Packet, lang: Lang): Promise<Packet> {
  if (lang === "en") return p;
  const out: Packet = structuredClone(p);
  const slots: { get: () => string; set: (v: string) => void }[] = [];
  const add = (get: () => string, set: (v: string) => void) => get() && slots.push({ get, set });

  add(() => out.name, (v) => (out.name = v));
  out.fallback.forEach((_, i) => add(() => out.fallback[i], (v) => (out.fallback[i] = v)));
  out.ask.forEach((a) => {
    add(() => a.question, (v) => (a.question = v));
    a.chips.forEach((_, i) => add(() => a.chips[i], (v) => (a.chips[i] = v)));
  });
  const v = out.visual;
  if (v.kind === "figure") {
    add(() => v.fact.label, (x) => (v.fact.label = x));
    add(() => v.fact.display, (x) => (v.fact.display = x));
  } else if (v.kind === "ridge") v.flags.forEach((f) => add(() => f.label, (x) => (f.label = x)));
  else if (v.kind === "quote") add(() => v.text, (x) => (v.text = x));
  else if (v.kind === "step") {
    add(() => v.title, (x) => (v.title = x));
    add(() => v.detail, (x) => (v.detail = x));
  }

  const translated = await toSpanish(slots.map((s) => s.get()));
  slots.forEach((s, i) => s.set(translated[i]));
  return out;
}

const LANG_NAME: Record<Lang, string> = { es: "Spanish (Spain)", en: "English" };

/**
 * Layer 2 of the context, written for the live agent: this phase's brief. Sent as a
 * contextual update when the phase starts and as the reply to phase_done.
 */
export function agentBrief(p: Packet, lang: Lang): string {
  const lines = [
    `PHASE ${p.index + 1} of ${p.of}: ${p.name}${p.depth ? " (go deeper: they asked for more or did not follow)" : ""}.`,
    `GOAL: ${p.goal}`,
    `SPEAK: ${LANG_NAME[lang]}, unless they switch language. Translate the material below as you speak; never change a figure.`,
  ];
  if (p.facts.length) {
    lines.push("FIGURES YOU MAY QUOTE (and no others):");
    for (const f of p.facts)
      lines.push(`- ${f.label}: ${f.display}${f.period ? ` (${f.period})` : ""}${f.doNotConfuseWith?.length ? `. Not the same as: ${f.doNotConfuseWith.join(", ")}` : ""}`);
  } else lines.push("FIGURES: none in this phase. Do not quote any number.");
  if (p.planSays.length) lines.push("WHAT THE PLAN SAYS (paraphrase, keep figures):", ...p.planSays.map((t) => `- ${t.replace(/\s+/g, " ").slice(0, 900)}`));
  if (p.analogy) lines.push(`ANALOGY YOU CAN USE: ${p.analogy}`);
  if (p.ask.length) lines.push("ASK, one at a time, and wait for the answer:", ...p.ask.map((a) => `- ${a.question} (options shown on screen: ${a.chips.join(" / ")})`));
  lines.push(`DONE WHEN: ${p.exit}`);
  if (p.avoid.length) lines.push(...p.avoid);
  lines.push(
    `Then call phase_done. Pass understood=false if they did not follow, wants_more=true if they asked for more detail` +
      (p.ask.some((a) => a.field === "worry") && p.phase === "discovery" ? ", worry=<their worry in their words>, level=<simple|basics|detail>" : "") +
      (p.ask.some((a) => a.field === "accepted") ? ", accepted=true/false" : "") +
      ". Keep each turn to two or three short sentences.",
  );
  return lines.join("\n");
}
