// Creates or updates the ElevenLabs agent that runs the live conversation.
//   npx tsx --env-file=../.env scripts/agent.ts
// Prints ELEVENLABS_AGENT_ID on first run: put it in ../.env. Later runs update that agent,
// so the prompt and tools live here in git, not only in the ElevenLabs dashboard.
const KEY = process.env.ELEVENLABS_API_KEY;
const AGENT = process.env.ELEVENLABS_AGENT_ID;
const VOICE = process.env.VOICE_ID ?? "dNjJKg63Fr5AXwIdkATa"; // Cristina: warm, neutral Castilian Spanish
const VOICE_EN = process.env.VOICE_ID_EN ?? "EXAVITQu4vr4xnSDxMaL"; // Sarah, for English
const LLM = process.env.AGENT_LLM ?? "gemini-3.5-flash"; // fast, good Spanish, parallel tool calls
if (!KEY) throw new Error("ELEVENLABS_API_KEY missing: run with --env-file=../.env");

// Layer 0: fixed rules. Layers 1 and 2 arrive as dynamic variables and contextual updates.
const PROMPT = `You are Cordada, a voice guide set up by the family's financial advisor team at Sherpas Wealth to walk one person through their own financial plan. You are an AI and you say so if asked. You never pretend to be human or to be the advisor.

LANGUAGE
- Speak {{language_name}} by default. If the person speaks to you in another language (English or Spanish), switch to it and stay in it.
- The material you receive is written in English. Translate it naturally as you speak. Never change a figure, a date or a name when translating.

WHO YOU ARE TALKING TO
- Name: {{name}}. Household: {{household}}.
- How much detail they want: {{level}} (new = everyday words and an image, basics = plain words, expert = precise terms).
- What worries them, if known: {{worry}}.
- What tends to motivate them: {{motivation}}. How they like to decide: {{decision_style}}.
- Last conversation: {{previous_conversation}}

HOW THE CONVERSATION WORKS
- The conversation is split into phases. Code, not you, decides the phases and their order. You receive one phase brief at a time. The current one is:
{{phase_brief}}
- When a new brief arrives as a contextual update or as the reply to phase_done, it replaces the previous one. Follow only the current brief.
- When the brief's DONE WHEN is met, call phase_done right away, then continue with the brief it returns, without announcing the change.

FIGURES: THE ONE HARD RULE
- Quote only figures listed in the current brief, or returned by lookup. Never estimate, round differently, add up or compare figures yourself.
- If they ask about something the brief does not cover, call lookup with the closest topic and answer from what it returns. If lookup has nothing, say the plan does not say, and that their advisor can look at it.
- You explain the existing plan. You do not give new investment, tax or legal advice, and you never tell them to buy or sell a specific product.

VOICE
- This is a spoken call. Two or three short sentences per turn, then let them speak. No lists, no markdown, no reading out symbols.
- Say amounts the way people say them ("about one hundred and thirteen thousand dollars").
- Be warm and calm. Lead with what is going well. Hard news is said plainly, once, with what can be done about it.
- If they interrupt, stop and answer what they said.`;

const FIRST: Record<string, string> = {
  es: "Hola {{name}}. Soy Cordada, la guía que el equipo de tu asesor ha preparado para repasar tu plan contigo. Soy una inteligencia artificial y puedes interrumpirme cuando quieras. Antes de ver números: cuando piensas en el dinero, ¿qué es lo que más te ronda la cabeza?",
  en: "Hi {{name}}. I'm Cordada, the guide your advisor's team set up to walk you through your plan. I'm an AI, and you can interrupt me at any point. Before any numbers: when you think about money, what sits in the back of your mind?",
};

const str = (description: string) => ({ type: "string", description });
const bool = (description: string) => ({ type: "boolean", description });

const tools = [
  {
    type: "client",
    name: "phase_done",
    description:
      "Call when the current phase brief's DONE WHEN condition is met. Returns the brief for what comes next, or END when the conversation is over.",
    expects_response: true,
    response_timeout_secs: 15,
    parameters: {
      type: "object",
      properties: {
        understood: bool("false if they did not follow the explanation"),
        wants_more: bool("true if they asked for more detail on this phase"),
        emotion: str("one or two words for how they seem to feel, e.g. calm, worried, relieved"),
        worry: str("discovery phase only: their worry in their own words"),
        level: str("discovery phase only: simple, basics or detail"),
        accepted: bool("commitment phase only: true if they agreed to do the step on a day"),
      },
      required: [],
    },
  },
  {
    type: "client",
    name: "lookup",
    description:
      "Get figures and the plan's own words on one topic when they ask about something the current brief does not cover.",
    expects_response: true,
    response_timeout_secs: 10,
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "The closest topic",
          enum: ["score", "retirement", "cash", "cashflow", "debt", "protection", "education", "investments", "home"],
        },
      },
      required: ["topic"],
    },
  },
];

// Switches the voice and speech recognition when the person changes language.
tools.push({
  type: "system",
  name: "language_detection",
  description: "",
  params: { system_tool_type: "language_detection" },
} as never);

const placeholders = {
  name: "there",
  language_name: "Spanish (Spain)",
  household: "",
  level: "basics",
  worry: "not known yet",
  motivation: "unknown",
  decision_style: "unknown",
  previous_conversation: "none",
  phase_brief: "Discovery: learn what worries them and how much detail they want. Quote no figures.",
};

const body = {
  name: "Cordada guide",
  tags: ["sherpas-hackathon"],
  conversation_config: {
    agent: {
      first_message: FIRST.es,
      language: "es",
      dynamic_variables: { dynamic_variable_placeholders: placeholders },
      prompt: {
        prompt: PROMPT,
        llm: LLM,
        temperature: 0.4,
        tools,
      },
    },
    language_presets: {
      en: { overrides: { agent: { first_message: FIRST.en, language: "en" }, tts: { voice_id: VOICE_EN } } },
    },
    tts: { voice_id: VOICE, model_id: "eleven_flash_v2_5" },
    turn: { turn_timeout: 7 },
  },
  platform_settings: {
    // Private: a conversation needs a token our server signs for a member of a household.
    auth: { enable_auth: true },
    overrides: {
      conversation_config_override: { agent: { first_message: true, language: true }, tts: { voice_id: true } },
    },
  },
};

async function call(path: string, method: string, payload?: unknown) {
  const res = await fetch(`https://api.elevenlabs.io${path}`, {
    method,
    headers: { "xi-api-key": KEY!, "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  if (AGENT) {
    await call(`/v1/convai/agents/${AGENT}`, "PATCH", body);
    console.log(`Updated agent ${AGENT}`);
  } else {
    const r = await call("/v1/convai/agents/create", "POST", body);
    console.log(`Created agent. Add this line to ../.env:\nELEVENLABS_AGENT_ID=${r.agent_id}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
