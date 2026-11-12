// One door to the text models on the Sherpas proxy. Tasks ask for a tier, not a model;
// each tier tries its models in order and falls back on a timeout, an error or an empty reply.
// Live voice turns never come through here: they run inside the ElevenLabs agent.

export type Tier = "fast" | "quality";

const TIERS: Record<Tier, { models: string[]; timeoutMs: number }> = {
  fast: { models: ["gemini-3.5-flash-lite", "gpt-5-mini"], timeoutMs: 8000 },
  quality: { models: ["gpt-5-mini", "gemini-3.5-flash-lite"], timeoutMs: 30000 },
};

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// The team key allows 4 requests at once; keep background work to 2 so live work has room.
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

export async function ask(tier: Tier, messages: ChatMessage[]): Promise<string | null> {
  const key = process.env.TEAM_KEY;
  if (!key) return null;
  const base = (process.env.LLM_PROXY_URL ?? "https://llm-hackathon.sherpaswealth.com").replace(/\/$/, "");
  const { models, timeoutMs } = TIERS[tier];
  for (const model of models) {
    try {
      const text = await slot(async () => {
        const res = await fetch(`${base}/v1/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new Error(`${model} ${res.status}`);
        const data = await res.json();
        return String(data?.choices?.[0]?.message?.content ?? "").trim();
      });
      if (text) return text;
    } catch (e) {
      console.error("llm", tier, e instanceof Error ? e.message : e);
    }
  }
  return null;
}
