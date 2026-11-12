// Pre-renders every line the guide can say with ElevenLabs, through the Sherpas AI proxy.
//   npx tsx --env-file=../.env scripts/voice.ts
// Clips are cached by content hash in public/voice, so only new or changed lines cost credits.
// The team's ElevenLabs allowance through the proxy is small ($1.40): keep an eye on the total.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cases, type Ctx } from "../mock/data";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "../public/voice");
const manifestPath = join(here, "../mock/voice.json");
const MODEL = process.env.VOICE_MODEL ?? "eleven-multilingual-v2";
const VOICE = process.env.VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL"; // ElevenLabs "Sarah"
const proxy = (process.env.LLM_PROXY_URL ?? "https://llm-hackathon.sherpaswealth.com").replace(/\/$/, "");
const key = process.env.TEAM_KEY;
if (!key) throw new Error("TEAM_KEY missing: run with --env-file=../.env");

// Every text the script can produce, across members and discovery answers.
const texts = new Set<string>();
for (const c of Object.values(cases)) {
  const worries = [null, ...c.phases.flatMap((p) => (p.ask?.remember === "worry" ? p.ask.chips : []))];
  for (const m of c.members)
    for (const worry of worries) {
      const ctx: Ctx = { name: m.name, worry };
      for (const p of c.phases) {
        texts.add(p.interruptReply);
        for (const l of p.lines) texts.add(typeof l.say === "function" ? l.say(ctx) : l.say);
      }
    }
}

async function main() {
mkdirSync(outDir, { recursive: true });
const manifest: Record<string, string> = {};
let made = 0;
let chars = 0;
const only = Number(process.env.VOICE_LIMIT ?? Infinity);

for (const text of texts) {
  const id = createHash("sha1").update(`${MODEL}|${VOICE}|${text}`).digest("hex").slice(0, 14);
  const file = join(outDir, `${id}.mp3`);
  if (!existsSync(file)) {
    if (made >= only) continue;
    const res = await fetch(`${proxy}/v1/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, voice: VOICE, input: text, response_format: "mp3" }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    made++;
    chars += text.length;
    console.log(`+ ${id}  ${text.slice(0, 60)}`);
  }
  manifest[text] = `/voice/${id}.mp3`;
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`${Object.keys(manifest).length}/${texts.size} lines ready, ${made} new (${chars} characters)`);
}

main();
