import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ApiError, body, handle, member } from "@/lib/api/http";

// The guide's voice: ElevenLabs through the Sherpas proxy. Every line is cached on disk by
// its text, so a line is paid for once however many times it is said. Members only, so the
// team's small ElevenLabs allowance cannot be spent by strangers.
const MODEL = process.env.VOICE_MODEL_LIVE ?? "eleven-flash-v2.5";
const VOICE = process.env.VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL";
const dir = join(process.cwd(), ".cache", "voice");

const audio = (buf: Buffer) =>
  new Response(new Uint8Array(buf), { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400" } });

/** First choice: the hackathon proxy, paid from the team's credits. */
// When the proxy fails, skip it for a while instead of paying its round trip on every line.
let proxyDownUntil = 0;

async function viaProxy(text: string): Promise<Buffer | null> {
  const key = process.env.TEAM_KEY;
  if (!key || Date.now() < proxyDownUntil) return null;
  const proxy = (process.env.LLM_PROXY_URL ?? "https://llm-hackathon.sherpaswealth.com").replace(/\/$/, "");
  const res = await fetch(`${proxy}/v1/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, voice: VOICE, input: text, response_format: "mp3" }),
  }).catch(() => null);
  if (res?.ok) return Buffer.from(await res.arrayBuffer());
  proxyDownUntil = Date.now() + 10 * 60_000;
  console.error("speech via proxy failed, skipping it for 10 minutes", res?.status, (await res?.text().catch(() => ""))?.slice(0, 160));
  return null;
}

/** Fallback: the team's own ElevenLabs account, when ELEVENLABS_API_KEY is set. */
async function direct(text: string): Promise<Buffer | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;
  const model = MODEL.replace(/^eleven-/, "eleven_").replace(/[-.]/g, "_");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: model }),
  }).catch(() => null);
  if (res?.ok) return Buffer.from(await res.arrayBuffer());
  console.error("speech direct failed", res?.status, (await res?.text().catch(() => ""))?.slice(0, 160));
  return null;
}

/** Body: { text: string } (up to 600 characters). Returns audio/mpeg. */
export const POST = handle(async (req: Request) => {
  member(req);
  const { text } = await body<{ text: string }>(req);
  if (typeof text !== "string" || !text.trim() || text.length > 600) throw new ApiError(400, "bad_input", "text is required, up to 600 characters.");

  const file = join(dir, `${createHash("sha1").update(`${MODEL}|${VOICE}|${text}`).digest("hex").slice(0, 16)}.mp3`);
  if (existsSync(file)) return audio(readFileSync(file));

  const buf = (await viaProxy(text)) ?? (await direct(text));
  if (!buf) throw new ApiError(502, "voice_unavailable", "The voice service did not answer. Captions still work.");
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, buf);
  } catch {}
  return audio(buf);
});
