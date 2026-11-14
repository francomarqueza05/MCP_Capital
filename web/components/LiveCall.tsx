"use client";

import { API_URL } from "@/lib/backend";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Packet, Visual } from "@/lib/engine/engine";
import type { YearPoint } from "@/lib/cases/load";
import { downloadIcs, nextSaturday } from "@/lib/calendar";
import { CC, CLOSE, Icon, MIC, MIC_OFF, Stage, spring, swap } from "./CallExperience";
import { Orb, type VoiceState } from "./Orb";
import { SpeechClock, captionTail } from "@/lib/speechClock";

/**
 * Live caption: the sentence being said, built only from words already heard. Within a sentence
 * words are only added; a new sentence (or page of a long one) replaces the line with a short
 * fade-in. Nothing is ever rewritten in place.
 */
function LiveCaption({ heard, turn }: { heard: string; turn: number }) {
  const t = captionTail(heard);
  if (!t.words.length) return null;
  return (
    <div className="caption" aria-live="polite">
      <p key={`${turn}:${t.key}`} className="caption-line">
        {t.cutBefore && <span className="is-said">… </span>}
        {t.words.map((w, k) => (
          <span key={k} className="is-said">
            {w}{" "}
          </span>
        ))}
      </p>
    </div>
  );
}
import { sections, type Block } from "./blocks/registry";
import type { Johnson, PersonId } from "@/lib/johnson";
import "./blocks/blocks.css";

/** One block the director chose for this phase (see the API's Step schema). */
type Step = { block: string; name: string; depth: "plain" | "detailed"; level: number; say: string | null; who: string };
type LivePacket = Packet & { steps?: Step[] };

const BLOCKS = new Map<string, Block>(sections.flatMap((s) => s.blocks).map((b) => [b.id, b]));

/** The block on screen, drawn with the family's plan from the API. */
function LiveBlock({ step, plan, index, of }: { step: Step; plan: Johnson; index: number; of: number }) {
  const block = BLOCKS.get(step.block);
  if (!block) return null;
  return (
    <div className="live-block">
      <div className="frame-visual">{block.render({ data: plan, who: step.who as PersonId, depth: step.depth })}</div>
      {of > 1 && (
        <ol className="live-steps" aria-label={`${index + 1} / ${of}`}>
          {Array.from({ length: of }, (_, i) => (
            <li key={i} className={i === index ? "is-now" : i < index ? "is-done" : ""} />
          ))}
        </ol>
      )}
    </div>
  );
}

type Lang = "es" | "en";
type Goal = { id: string; title: string; detail: string; due: string | null };
type Persona = {
  name: string;
  household: { adults: string[]; children: string[]; place: string };
  level: string;
  worry: string | null;
  motivation: string | null;
  decisionStyle: string | null;
  previousConversation: string | null;
};
type View = { session: { id: string; done: boolean }; persona: Persona; packet: Packet | null; agentBrief: string | null };

const T = {
  es: {
    ready: (n: string) => `${n}, tu plan está listo para hablarlo.`,
    readyAnon: "Tu plan está listo para hablarlo.",
    intro: "Unos minutos, en voz alta. Hablarás con una guía de inteligencia artificial del equipo de tu asesor, y puedes interrumpirla cuando quieras.",
    start: "Empezar la conversación",
    noLink: "Ábrelo desde tu enlace personal.",
    noLinkBody: "Tu asesor envía a cada persona su propio enlace, para que el plan que escuches sea el tuyo.",
    choose: "Elegir una familia",
    error: "No hemos podido abrir tu plan.",
    retry: "Recarga la página para intentarlo de nuevo.",
    back: "Volver al inicio",
    whenever: "Cuando quieras",
    thanks: "Gracias por hablarlo.",
    calendar: "Añadir al calendario",
    again: "Hablarlo otra vez",
    talkAgain: "Hablarlo otra vez",
    states: { idle: "", listening: "Te escucho", thinking: "Pensando", speaking: "Habla cuando quieras para interrumpir", interrupted: "Dime" },
    connecting: "Conectando",
    phase: (n: number, of: number) => `Fase ${n} de ${of}`,
    deeper: "a fondo",
    mute: "Silenciar micrófono",
    unmute: "Activar micrófono",
    captions: "Subtítulos",
    end: "Terminar la conversación",
    mic: "Necesitamos el micrófono para hablar contigo. Permítelo en el navegador y vuelve a empezar.",
  },
  en: {
    ready: (n: string) => `${n}, your plan is ready to talk through.`,
    readyAnon: "Your plan is ready to talk through.",
    intro: "A few minutes, out loud. You will be talking with an AI guide from your advisor's team, and you can interrupt it at any point.",
    start: "Start the conversation",
    noLink: "Open this from your personal link.",
    noLinkBody: "Your advisor sends each person their own link, so the plan you hear is yours.",
    choose: "Choose a family",
    error: "We could not open your plan.",
    retry: "Reload the page to try again.",
    back: "Back to the start",
    whenever: "Whenever you are ready",
    thanks: "Thanks for talking it through.",
    calendar: "Add to calendar",
    again: "Talk it through again",
    talkAgain: "Talk it through again",
    states: { idle: "", listening: "Listening", thinking: "Thinking", speaking: "Just talk to interrupt", interrupted: "Go ahead" },
    connecting: "Connecting",
    phase: (n: number, of: number) => `Step ${n} of ${of}`,
    deeper: "in depth",
    mute: "Mute microphone",
    unmute: "Unmute microphone",
    captions: "Captions",
    end: "End the conversation",
    mic: "We need the microphone to talk with you. Allow it in the browser and start again.",
  },
};

/** Words that show which question the guide just asked, in Spanish or English. */
const ASKED: Record<string, RegExp> = {
  worry: /preocup|worr|ronda|cabeza|mind|inquiet/g,
  level: /detalle|detail|sencill|simple|b[aá]sic|basic|nivel|profund|f[aá]cil/g,
  accepted: /calendario|calendar|s[aá]bado|saturday|apunt/g,
};

/**
 * The answers to offer: only those of the question the guide just asked. With one question in
 * the phase, that one; with several, the one whose words came last in what the guide said;
 * if it is unclear, none (a wrong option is worse than no option).
 */
function chipsFor(ask: Packet["ask"], said: string): string[] | null {
  if (!ask.length) return null;
  if (ask.length === 1) return ask[0].chips;
  const tail = said.slice(-220).toLowerCase();
  let best: Packet["ask"][number] | null = null;
  let at = -1;
  for (const a of ask) {
    const hits = [...tail.matchAll(ASKED[a.field] ?? /$^/g)];
    const pos = hits.length ? hits[hits.length - 1].index! : -1;
    if (pos > at) {
      at = pos;
      best = a;
    }
  }
  return best?.chips ?? null;
}

/** Diagnostics for caption timing, only with ?debug=1: window.__cap holds the trace. */
const debugOn = () => typeof location !== "undefined" && new URLSearchParams(location.search).has("debug");
const trace = (e: Record<string, unknown>) => {
  if (!debugOn()) return;
  const w = window as unknown as { __cap?: Record<string, unknown>[] };
  (w.__cap ??= []).push({ t: Math.round(performance.now()), ...e });
};

/** Typical delay between the audio player starting a chunk and it reaching the speakers. */
const OUTPUT_LAG_MS = 90;

const LANG_NAME: Record<Lang, string> = { es: "Spanish (Spain)", en: "English" };
const LEVEL: Record<string, string> = { new: "new", basics: "basics", expert: "expert" };

export function LiveCall(props: { slug: string }) {
  return (
    <ConversationProvider>
      <Live {...props} />
    </ConversationProvider>
  );
}

// The live conversation. The ElevenLabs agent listens and talks (with interruptions handled by
// ElevenLabs); the phase engine decides what it covers. Each phase brief reaches the agent as a
// dynamic variable at the start and as the reply to its phase_done tool after that, and every
// figure on screen comes from the engine's packet, never from the model.
function Live({ slug }: { slug: string }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [lang, setLang] = useState<Lang>("es");
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [stage, setStage] = useState<"lobby" | "call" | "done" | "error">("lobby");
  const [error, setError] = useState("");
  const [packet, setPacket] = useState<Packet | null>(null);
  const [visual, setVisual] = useState<Visual | null>(null);
  const [plan, setPlan] = useState<Johnson | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const packetRef = useRef<LivePacket | null>(null);
  const [yearly, setYearly] = useState<YearPoint[] | null>(null);
  const [line, setLine] = useState("");
  const [turn, setTurn] = useState(0);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cut, setCut] = useState(false);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [step, setStep] = useState<{ title: string; detail: string } | null>(null);

  const t = T[lang];
  const root = useRef<HTMLElement>(null);
  const level = useRef(0);
  const sessionId = useRef<string | null>(null);
  const finished = useRef(false);
  // Captions: our own playback clock over the voice's audio chunks (see lib/speechClock).
  const clock = useRef(new SpeechClock(OUTPUT_LAG_MS));
  const lastSound = useRef(0);
  const aligned = useRef(false);
  const turnOver = useRef(true);

  const api = useCallback(
    async <R,>(path: string, init: RequestInit = {}): Promise<R> => {
      const res = await fetch(`${API_URL}/v1${path}`, {
        ...init,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? `Request failed (${res.status})`);
      return res.json();
    },
    [token],
  );

  const show = useCallback((p: LivePacket | null) => {
    setPacket(p);
    packetRef.current = p;
    // The phase opens on its first block; the agent moves on with show_block.
    setActive(p?.steps?.[0]?.block ?? null);
    if (!p) return;
    if (p.visual.kind !== "none") setVisual(p.visual);
    if (p.visual.kind === "step") setStep({ title: p.visual.title, detail: p.visual.detail });
  }, []);

  const conversation = useConversation({
    clientTools: {
      // The agent says which block it is about to talk about: put it on screen.
      show_block: (p: Record<string, unknown>) => {
        const id = String(p.block ?? "");
        if (packetRef.current?.steps?.some((x) => x.block === id)) setActive(id);
      },
      // The agent says the phase is over; the engine decides what comes next.
      phase_done: async (p: Record<string, unknown>) => {
        if (!sessionId.current) return "No conversation is open.";
        setBusy(true);
        try {
          const answers: Record<string, unknown> = {};
          if (typeof p.worry === "string" && p.worry.trim()) answers.worry = p.worry;
          if (typeof p.level === "string" && p.level.trim()) answers.level = p.level;
          if (typeof p.accepted === "boolean") answers.accepted = p.accepted;
          const r = await api<View & { goal: Goal | null }>(`/sessions/${sessionId.current}/phase-done`, {
            method: "POST",
            body: JSON.stringify({
              understood: typeof p.understood === "boolean" ? p.understood : undefined,
              wantsMore: typeof p.wants_more === "boolean" ? p.wants_more : undefined,
              emotion: typeof p.emotion === "string" ? p.emotion : undefined,
              answers,
            }),
          });
          if (r.goal) setGoal(r.goal);
          show(r.packet);
          if (!r.packet) {
            finished.current = true;
            return "END. The plan is covered. In one or two sentences, thank them, repeat the first step and the day they chose (or that they can do it whenever they are ready), and say goodbye. Do not start a new topic.";
          }
          return r.agentBrief ?? "Continue.";
        } catch (e) {
          return `The plan could not be loaded (${e instanceof Error ? e.message : "error"}). Apologise briefly and suggest they talk to their advisor.`;
        } finally {
          setBusy(false);
        }
      },
      // Off-script questions are answered from the plan, by code.
      lookup: async (p: Record<string, unknown>) => {
        try {
          const r = await api<{ label: string; facts: { label: string; display: string; period?: string }[]; planSays: string[] }>(
            `/lookup?topic=${encodeURIComponent(String(p.topic ?? ""))}`,
          );
          const facts = r.facts.map((f) => `- ${f.label}: ${f.display}${f.period ? ` (${f.period})` : ""}`).join("\n");
          return `TOPIC: ${r.label}\nFIGURES YOU MAY QUOTE:\n${facts || "- none"}\nWHAT THE PLAN SAYS:\n${r.planSays.map((s) => `- ${s.slice(0, 700)}`).join("\n") || "- nothing on this"}\nAnswer briefly, then go back to the current phase.`;
        } catch {
          return "The plan has nothing on that topic. Say so, and that their advisor can look at it.";
        }
      },
    },
    // Every audio chunk, as it arrives: what it says and when each letter sounds inside it.
    onAudioAlignment: (alignment) => {
      if (!alignment?.chars?.length) return;
      if (turnOver.current) {
        clock.current.reset();
        turnOver.current = false;
        setTurn((n) => n + 1);
        setLine("");
      }
      aligned.current = true;
      trace({ k: "recv", text: alignment.chars.join(""), starts: alignment.char_start_times_ms.map(Math.round) });
      clock.current.receive(alignment, performance.now());
    },
    // When the player really starts a chunk (WebSocket only), correct our clock.
    onAudioAlignmentPlayback: ({ alignment }) => {
      trace({ k: "play", text: alignment?.chars?.join("") ?? null });
      clock.current.started(performance.now(), alignment);
    },
    onMessage: (m) => {
      // A new turn starts when the person speaks. Not on "listening": the player reports that
      // too in the short gaps between audio chunks of the same reply, which used to reset the caption.
      if (m.role === "user" || m.source === "user") {
        turnOver.current = true;
        return;
      }
      // Without timing data, show the whole reply once it is known.
      if (aligned.current) return;
      setLine(m.message);
    },
    onInterruption: () => {
      // Drop what was being said, so an interrupted sentence never comes back on screen.
      turnOver.current = true;
      clock.current.reset();
      setLine("");
      setCut(true);
      setTimeout(() => setCut(false), 700);
    },
    onError: (msg) => console.error("agent", msg),
    onDisconnect: () => {
      sessionId.current = null;
      setStage((s) => (s === "call" ? "done" : s));
    },
  });

  const { status, isSpeaking, getInputVolume, getOutputVolume } = conversation;

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setToken(q.get("t"));
    if (q.get("lang") === "en") setLang("en");
  }, []);

  useEffect(() => {
    if (!token) return;
    api<{ name: string }>("/me")
      .then(setMe)
      .catch((e) => {
        setError(e.message);
        setStage("error");
      });
  }, [token, api]);

  const state: VoiceState =
    stage !== "call" ? "idle" : cut ? "interrupted" : status !== "connected" || busy ? "thinking" : isSpeaking ? "speaking" : "listening";
  const stateRef = useRef(state);
  stateRef.current = state;

  // Feed the orb from the live audio: the agent's voice while it speaks, the microphone otherwise.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = stateRef.current;
      let v = 0;
      try {
        if (s === "speaking") v = getOutputVolume();
        else if (s === "listening") v = getInputVolume();
      } catch {}
      const lv = 1 - Math.exp(-v * 4.5);
      level.current = lv;
      root.current?.style.setProperty("--lv", lv.toFixed(3));
      // When the speakers go from silence to sound, that is when the next words really start.
      let out = 0;
      try {
        out = getOutputVolume();
      } catch {}
      const now = performance.now();
      if (out > 0.015) {
        if (now - lastSound.current > 350) {
          trace({ k: "sound", silentMs: Math.round(now - lastSound.current) });
          clock.current.resync(now);
        }
        lastSound.current = now;
      }
      // The caption is what has been heard so far: it only ever grows within a reply.
      if (aligned.current && !clock.current.empty) {
        const heard = clock.current.visible(performance.now());
        setLine((prev) => {
          if (prev !== heard) trace({ k: "heard", n: heard.length, tail: heard.slice(-24), vol: Math.round(out * 1000) / 1000 });
          return prev === heard ? prev : heard;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getInputVolume, getOutputVolume]);

  // When the engine says the plan is covered, hang up once the goodbye has been said.
  useEffect(() => {
    if (!finished.current || stage !== "call" || isSpeaking || busy) return;
    const id = setTimeout(() => {
      if (finished.current && !conversation.isSpeaking) conversation.endSession();
    }, 2500);
    return () => clearTimeout(id);
  }, [isSpeaking, busy, stage, conversation]);

  const start = useCallback(async () => {
    setStage("call");
    setVisual(null);
    setGoal(null);
    setStep(null);
    setLine("");
    finished.current = false;
    turnOver.current = true;
    aligned.current = false;
    clock.current.reset();
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((x) => x.stop()));
    } catch {
      setError(t.mic);
      setStage("error");
      return;
    }
    try {
      const [view, ridge, voice] = await Promise.all([
        api<View>("/sessions", { method: "POST", body: JSON.stringify({ lang }) }),
        api<{ yearly: YearPoint[] }>("/visuals/ridge"),
        api<{ signedUrl: string }>("/voice/agent-session", { method: "POST", body: "{}" }),
        // Every figure the blocks draw. Without it, the call falls back to the simple visuals.
        api<Johnson>("/plan").then(setPlan).catch(() => setPlan(null)),
      ]);
      sessionId.current = view.session.id;
      setYearly(ridge.yearly);
      show(view.packet);
      const p = view.persona;
      conversation.startSession({
        signedUrl: voice.signedUrl,
        connectionType: "websocket",
        overrides: { agent: { language: lang } },
        dynamicVariables: {
          name: p.name,
          language_name: LANG_NAME[lang],
          household: [...p.household.adults, ...p.household.children].join(", ") + `, ${p.household.place}`,
          level: LEVEL[p.level] ?? "basics",
          worry: p.worry ?? "not known yet",
          motivation: p.motivation ?? "unknown",
          decision_style: p.decisionStyle ?? "unknown",
          previous_conversation: p.previousConversation ?? "none",
          phase_brief: view.agentBrief ?? "",
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setStage("error");
    }
  }, [api, lang, show, conversation, t.mic]);

  const end = useCallback(() => {
    conversation.endSession();
    setStage("done");
  }, [conversation]);

  const due = goal?.due ? new Date(`${goal.due}T10:00:00`) : nextSaturday();
  const closing = goal ?? step;
  const compact = stage === "call" && Boolean(visual);
  const chips = stage === "call" && packet && state === "listening" ? chipsFor(packet.ask, line) : null;

  return (
    <main ref={root} className={`call is-${stage} is-${state} ${compact ? "is-compact" : ""}`} lang={lang}>
      <div className="aura" aria-hidden="true" />

      <header className="call-top">
        <span className="wordmark">cordada</span>
        <AnimatePresence mode="wait">
          {stage === "call" && packet ? (
            <motion.div key="track" className="phase-track" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ol aria-hidden="true">
                {Array.from({ length: packet.of }, (_, i) => (
                  <li key={i} className={i < packet.index ? "is-done" : i === packet.index ? "is-now" : ""} />
                ))}
              </ol>
              <p aria-live="polite">
                <span>{t.phase(packet.index + 1, packet.of)}</span>
                <AnimatePresence mode="wait">
                  <motion.strong key={packet.phase + packet.depth} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    {packet.name}
                  </motion.strong>
                </AnimatePresence>
                {packet.depth > 0 && <em className="depth">{t.deeper}</em>}
              </p>
            </motion.div>
          ) : stage === "lobby" ? (
            <div className="segmented" role="group" aria-label="Idioma / Language">
              {(["es", "en"] as Lang[]).map((l) => (
                <button key={l} aria-pressed={l === lang} onClick={() => setLang(l)}>
                  {l === lang && <motion.i layoutId="lang" transition={spring} />}
                  <span>{l === "es" ? "Español" : "English"}</span>
                </button>
              ))}
            </div>
          ) : null}
        </AnimatePresence>
      </header>

      <div className="call-body">
        <motion.button
          layout
          transition={{ type: "spring", stiffness: 170, damping: 24 }}
          className="orb"
          disabled
          aria-label={t.states[state] || "Guide"}
        >
          <Orb state={state} level={level} />
        </motion.button>

        <AnimatePresence mode="wait">
          {stage === "lobby" && (
            <motion.section key={`lobby-${lang}`} className="panel" {...swap}>
              {token === null ? (
                <>
                  <h1>{t.noLink}</h1>
                  <p>{t.noLinkBody}</p>
                  <Link className="btn btn-ink" href="/">
                    {t.choose}
                  </Link>
                </>
              ) : (
                <>
                  <h1>{me ? t.ready(me.name) : t.readyAnon}</h1>
                  <p>{t.intro}</p>
                  <button className="btn btn-ink" onClick={start} disabled={!me}>
                    {t.start}
                  </button>
                </>
              )}
            </motion.section>
          )}

          {stage === "error" && (
            <motion.section key="error" className="panel" {...swap}>
              <h1>{t.error}</h1>
              <p>
                {error} {t.retry}
              </p>
              <Link className="btn btn-ink" href="/">
                {t.back}
              </Link>
            </motion.section>
          )}

          {stage === "done" && (
            <motion.section key="done" className="panel" {...swap}>
              <span className="pill is-blue">
                {goal?.due ? due.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { weekday: "long", month: "long", day: "numeric" }) : t.whenever}
              </span>
              <h1>{closing?.title ?? t.thanks}</h1>
              {closing?.detail && <p>{closing.detail}</p>}
              <div className="row">
                {closing && (
                  <button
                    className="btn btn-ink"
                    onClick={() => downloadIcs({ title: closing.title, description: `${closing.detail}\n\n${t.talkAgain}: ${location.href}`, start: due })}
                  >
                    {t.calendar}
                  </button>
                )}
                <button className="btn btn-line" onClick={() => setStage("lobby")}>
                  {t.again}
                </button>
              </div>
            </motion.section>
          )}

          {stage === "call" && plan && active && packet && (packet as LivePacket).steps?.length ? (
            <motion.section key={`block-${active}`} className="stage" {...swap}>
              {(() => {
                const steps = (packet as LivePacket).steps!;
                const i = Math.max(0, steps.findIndex((x) => x.block === active));
                return <LiveBlock step={steps[i]} plan={plan} index={i} of={steps.length} />;
              })()}
            </motion.section>
          ) : (
            stage === "call" &&
            visual && (
              <motion.section key={`${packet?.phase}-${packet?.depth}-${visual.kind}`} className="stage" {...swap}>
                <Stage visual={visual} yearly={yearly} seconds={9} lang={lang} />
              </motion.section>
            )
          )}
        </AnimatePresence>
      </div>

      {stage === "call" && (
        <footer className="call-foot">
          <p className="status">
            <i />
            {status === "connecting" ? t.connecting : t.states[state]}
          </p>
          {/* One fixed-height box: the caption while the guide talks, the answer options when it asks.
              Nothing above it moves when either appears. */}
          <div className="foot-main">
            <AnimatePresence initial={false}>
              {!chips && captionsOn && line && (
                <motion.div key="caption" className="foot-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <LiveCaption heard={line} turn={turn} />
                </motion.div>
              )}
            {chips && (
                <motion.div key="chips" className="chips foot-layer" initial="hide" animate="show" exit="hide" variants={{ show: { transition: { staggerChildren: 0.07 } } }}>
                  {chips.map((c) => (
                    <motion.button
                      key={c}
                      variants={{ hide: { opacity: 0, y: 14, scale: 0.9 }, show: { opacity: 1, y: 0, scale: 1 } }}
                      transition={spring}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => conversation.sendUserMessage(c)}
                    >
                      {c}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="dock">
            <button
              aria-pressed={conversation.isMuted}
              aria-label={conversation.isMuted ? t.unmute : t.mute}
              onClick={() => conversation.setMuted(!conversation.isMuted)}
            >
              <Icon d={conversation.isMuted ? MIC_OFF : MIC} />
            </button>
            <button aria-pressed={captionsOn} aria-label="Captions" title={t.captions} onClick={() => setCaptionsOn((v) => !v)}>
              <Icon d={CC} />
            </button>
            <button className="is-end" aria-label={t.end} onClick={end}>
              <Icon d={CLOSE} />
            </button>
          </div>
        </footer>
      )}
    </main>
  );
}
