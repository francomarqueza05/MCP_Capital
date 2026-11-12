// Turns a plan fact into the words the guide says, following the plan's own quoting rules:
// keep the unit (a yearly figure is said per year), percentages as percentages, no rounding
// that changes meaning.
import type { Fact } from "../cases/load";

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

export function display(f: Fact): string {
  const v = f.value;
  if (typeof v === "number") {
    if (f.unit === "USD") return usd(v);
    if (f.unit === "USD/yr") return `${usd(v)} a year`;
    if (f.unit === "months") return `${v} months`;
  }
  if (f.unit === "months") return `${v} months`;
  if (f.unit === "of 100") return `${v} out of 100`;
  return String(v);
}

export type SpokenFact = {
  id: string;
  label: string;
  value: number | string;
  display: string;
  unit: string;
  period?: string;
  doNotConfuseWith?: string[];
};

export const spoken = (f: Fact): SpokenFact => ({
  id: f.id,
  label: f.label,
  value: f.value,
  display: display(f),
  unit: f.unit,
  period: f.period,
  doNotConfuseWith: f.notToBeConfusedWith,
});

/** A plain sentence for the fallback script: label, figure, and when it applies. */
export const sentence = (f: Fact) => `${f.label}: ${display(f)}${f.period ? `, ${f.period}` : ""}.`;
