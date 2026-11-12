import { ApiError, handle, json, member } from "@/lib/api/http";

/**
 * A short-lived signed WebSocket URL for the live voice agent. The agent is private, so only a
 * member of a household (with a valid personal link) can open a conversation with it.
 * WebSocket rather than WebRTC: only WebSocket streams the per-character timing of the voice,
 * which keeps the captions on the exact syllable being spoken.
 */
export const POST = handle(async (req: Request) => {
  member(req);
  const key = process.env.ELEVENLABS_API_KEY;
  const agent = process.env.ELEVENLABS_AGENT_ID;
  if (!key || !agent) throw new ApiError(503, "no_agent", "The live guide is not configured on this server.");
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agent)}`, {
    headers: { "xi-api-key": key },
  });
  if (!res.ok) {
    console.error("voice token", res.status, (await res.text()).slice(0, 200));
    throw new ApiError(502, "agent_unavailable", "The live guide is not answering right now.");
  }
  const { signed_url } = await res.json();
  return json({ signedUrl: signed_url });
});
