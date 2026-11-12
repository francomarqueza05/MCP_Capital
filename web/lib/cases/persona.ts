// Parses the Sherpas persona.md: the classification block (D0 to D6), the objective
// concerns (O1, O2...) and the tensions between them (T1, T2...). Two writing styles
// exist across the cases, so the parser keys on the ids and severity words only.

export type Concern = { id: string; severity: string; rank: number; title: string; text: string };
export type Tension = { id: string; severity: string; rank: number; text: string; concerns: string[] };
export type Persona = {
  classification: Record<string, string>;
  concerns: Concern[];
  tensions: Tension[];
  sections: Record<string, string>;
};

const CONCERN_RANK: Record<string, number> = { CRITICAL: 4, SIGNIFICANT: 3, MODERATE: 2, MINOR: 1 };
const TENSION_RANK: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export function parsePersona(text: string): Persona {
  const md = text.replace(/\r\n?/g, "\n"); // git on Windows may check the files out with CRLF
  const classification: Record<string, string> = {};
  const block = md.match(/```classification\n([\s\S]*?)```/)?.[1] ?? "";
  for (const line of block.split("\n")) {
    const m = line.match(/^(D\d[a-z]?):\s*(.+)$/);
    if (m) classification[m[1]] = m[2].trim();
  }

  const sections: Record<string, string> = {};
  const parts = md.split(/^## /m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf("\n");
    sections[p.slice(0, nl).trim()] = p.slice(nl + 1).replace(/```classification[\s\S]*?```/, "").trim();
  }

  const concerns: Concern[] = [];
  const tensions: Tension[] = [];
  for (const line of md.split("\n")) {
    const c = line.match(/^- \*\*(O\d+)\b(.*?)\*\*\s*(.*)$/);
    if (c) {
      const severity = (c[2] + " " + c[3]).match(/\b(CRITICAL|SIGNIFICANT|MODERATE|MINOR)\b/)?.[1] ?? "MINOR";
      const title = c[2]
        .replace(/\((CRITICAL|SIGNIFICANT|MODERATE|MINOR)\)/, "")
        .replace(/\b(CRITICAL|SIGNIFICANT|MODERATE|MINOR)\b/, "")
        .replace(/^[:\s]+|[.\s:]+$/g, "")
        .trim();
      concerns.push({ id: c[1], severity, rank: CONCERN_RANK[severity], title, text: c[3].replace(/\s*Connected:.*$/, "").trim() });
      continue;
    }
    const t = line.match(/^- \*\*(T\d+)\b(.*?)\*\*\s*(.*)$/);
    if (t) {
      const severity = (t[2] + " " + t[3]).match(/\b(HIGH|MEDIUM|LOW)\b/)?.[1] ?? "LOW";
      const text = t[3].trim();
      tensions.push({ id: t[1], severity, rank: TENSION_RANK[severity], text, concerns: [...new Set(text.match(/\bO\d+\b/g) ?? [])] });
    }
  }
  return { classification, concerns, tensions, sections };
}
