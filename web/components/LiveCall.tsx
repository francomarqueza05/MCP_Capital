"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Packet, Visual } from "@/lib/engine/engine";
import type { YearPoint } from "@/lib/cases/load";
import { downloadIcs, nextSaturday } from "@/lib/calendar";
import { CC, CLOSE, Caption, Icon, MIC, MIC_OFF, Stage, spring, swap } from "./CallExperience";
import { Orb, type VoiceState } from "./Orb";

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
    mute: "Mute microphone",
    unmute: "Unmute microphone",
    captions: "Captions",
    end: "End the conversation",
    mic: "We need the microphone to talk with you. Allow it in the browser and start again.",
  },
};

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
  const [yearly, setYearly] = useState<YearPoint[] | null>(null);
  const [line, setLine] = useState("");
  const [progress, setProgress] = useState(1);
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
  const lineStart = useRef(0);

  const api = useCallback(
    async <R,>(path: string, init: RequestInit = {}): Promise<R> => {
      const res = await fetch(`/api/v1${path}`, {
        ...init,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? `Request failed (${res.status})`);
      return res.json();
    },
    [token],
  );

  const show = useCallback((p: Packet | null) => {
    setPacket(p);
    if (!p) return;
    if (p.visual.kind !== "none") setVisual(p.visual);
    if (p.visual.kind === "step") setStep({ title: p.visual.title, detail: p.visual.detail });
  }, []);

  const conversation = useConversation({
    clientTools: {
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
    onMessage: (m) => {
      if (m.role !== "agent" && m.source !== "ai") return;
      lineStart.current = performance.now();
      setProgress(0);
      setLine(m.message);
    },
    onInterruption: () => {
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
      // Light the caption at speaking pace while the agent talks.
      if (s === "speaking") {
        setProgress((p) => (p >= 1 ? p : Math.min(1, (performance.now() - lineStart.current) / 1000 / 4.5)));
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
        api<{ token: string }>("/voice/token", { method: "POST", body: "{}" }),
      ]);
      sessionId.current = view.session.id;
      setYearly(ridge.yearly);
      show(view.packet);
      const p = view.persona;
      conversation.startSession({
        conversationToken: voice.token,
        connectionType: "webrtc",
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
  const chips = stage === "call" && packet?.ask.length && state === "listening" ? packet.ask.flatMap((a) => a.chips) : null;

  return (
    <main ref={root} className={`call is-${stage} is-${state} ${compact ? "is-compact" : ""}`} lang={lang}>
      <div className="aura" aria-hidden="true" />

      <header className="call-top">
        <span className="wordmark">cordada</span>
        <AnimatePresence mode="wait">
          {stage === "call" && packet ? (
            <motion.span key={packet.phase + packet.depth} className="pill" {...swap} transition={{ duration: 0.35 }}>
              {packet.name}
            </motion.span>
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

          {stage === "call" && visual && (
            <motion.section key={`${packet?.phase}-${packet?.depth}-${visual.kind}`} className="stage" {...swap}>
              <Stage visual={visual} yearly={yearly} seconds={9} lang={lang} />
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {stage === "call" && (
        <footer className="call-foot">
          <p className="status">
            <i />
            {status === "connecting" ? t.connecting : t.states[state]}
          </p>
          {captionsOn && line && <Caption text={line} progress={progress} />}
          <AnimatePresence>
            {chips && (
              <motion.div className="chips" initial="hide" animate="show" exit="hide" variants={{ show: { transition: { staggerChildren: 0.07 } } }}>
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
