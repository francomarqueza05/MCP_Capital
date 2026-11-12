"use client";

import Link from "next/link";
import { AnimatePresence, animate, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Packet, Visual } from "@/lib/engine/engine";
import type { YearPoint } from "@/lib/cases/load";
import { downloadIcs, nextSaturday } from "@/lib/calendar";
import { Orb, type VoiceState } from "./Orb";
import { Ridge } from "./Ridge";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const spring = { type: "spring", stiffness: 260, damping: 26 } as const;
const swap = {
  initial: { opacity: 0, y: 28, scale: 0.94, filter: "blur(12px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, y: -18, scale: 0.97, filter: "blur(10px)" },
  transition: spring,
};

const stateWords: Record<VoiceState, string> = {
  idle: "",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Tap the orb to interrupt",
  interrupted: "Go ahead",
};

const CUT_CHIPS = ["Say that again, simpler", "Tell me more", "Carry on"];

type Goal = { id: string; title: string; detail: string; due: string | null };
type DoneReply = { packet: Packet | null; goal: Goal | null; session: { done: boolean } };

/** A number that counts up when it appears, in step with the voice saying it. */
function Count({ to, seconds = 1.4 }: { to: number; seconds?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const c = animate(0, to, {
      duration: seconds,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => ref.current && (ref.current.textContent = usd(v)),
    });
    return () => c.stop();
  }, [to, seconds]);
  return <span ref={ref}>{usd(0)}</span>;
}

/** The sentence being spoken, lit word by word as the audio reaches it. */
function Caption({ text, progress }: { text: string; progress: number }) {
  const parts = useMemo(() => {
    const sentences = text.match(/[^.?!]+[.?!]+["']?\s*/g) ?? [text];
    let at = 0;
    return sentences.map((s) => {
      const start = at;
      at += s.length;
      return { s: s.trim(), start, end: at };
    });
  }, [text]);
  const pos = progress * text.length;
  const cur = parts.find((p) => pos < p.end) ?? parts[parts.length - 1];
  const words = cur.s.split(" ");
  const inside = Math.max(0, pos - cur.start) / Math.max(1, cur.end - cur.start);
  const said = Math.ceil(inside * words.length + 0.4);
  return (
    <div className="caption" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.p
          key={cur.start + text}
          initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
          transition={{ duration: 0.28 }}
        >
          {words.map((w, k) => (
            <span key={k} className={k < said ? "is-said" : ""}>
              {w}{" "}
            </span>
          ))}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** What the plan shows while the guide talks: built from the phase packet, never by the model. */
function Stage({ visual, yearly, seconds }: { visual: Visual; yearly: YearPoint[] | null; seconds: number }) {
  if (visual.kind === "figure") {
    const f = visual.fact;
    const money = typeof f.value === "number" && (f.unit === "USD" || f.unit === "USD/yr");
    const pct = f.unit === "percent" ? parseFloat(String(f.value)) : null;
    return (
      <div className="v-figure">
        {pct !== null && (
          <div className="ring">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="52" className="ring-track" />
              <motion.circle
                cx="60"
                cy="60"
                r="52"
                className="ring-fill"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: Math.min(1, pct / 100) }}
                transition={{ duration: 1.8, ease: [0.2, 0.7, 0.2, 1], delay: 0.4 }}
              />
            </svg>
          </div>
        )}
        <strong>{money ? <Count to={Math.abs(f.value as number)} seconds={1.8} /> : f.display}</strong>
        <p>
          {f.label}
          {f.unit === "USD/yr" ? ", per year" : ""}
        </p>
      </div>
    );
  }
  if (visual.kind === "ridge" && yearly) return <Ridge yearly={yearly} toAge={visual.toAge} flags={visual.flags} seconds={seconds} />;
  if (visual.kind === "quote") return <p className="v-quote">{visual.text}</p>;
  if (visual.kind === "step")
    return (
      <div className="v-step">
        <span className="pill is-blue">This week</span>
        <strong>{visual.title}</strong>
        <p>{visual.detail}</p>
      </div>
    );
  return null;
}

const Icon = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const MIC = "M12 4a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 5 0v-5A2.5 2.5 0 0 0 12 4ZM6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3";
const MIC_OFF = "M4 4l16 16M9.5 9.5v2a2.5 2.5 0 0 0 4 2M14.5 10V6.5a2.5 2.5 0 0 0-4.6-1.3M6.5 11.5a5.5 5.5 0 0 0 9 4.2M12 17v3";
const CC = "M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-9ZM10.5 10.5a2 2 0 1 0 0 3M16.5 10.5a2 2 0 1 0 0 3";
const CLOSE = "M6 6l12 12M18 6 6 18";

// The conversation, driven by the phase engine through /api/v1. The engine sends one packet
// per phase: what to cover, the figures, the visual and the lines to say. This screen speaks
// those lines with the ElevenLabs voice and reports back; the engine decides what is next.
// The live agent replaces `speak` and `listen`; the API contract stays the same.
export function CallExperience({ slug }: { slug: string }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [me, setMe] = useState<{ name: string; household: string } | null>(null);
  const [stage, setStage] = useState<"lobby" | "call" | "done" | "error">("lobby");
  const [error, setError] = useState("");
  const [state, setState] = useState<VoiceState>("idle");
  const [packet, setPacket] = useState<Packet | null>(null);
  const [line, setLine] = useState("");
  const [progress, setProgress] = useState(0);
  const [seconds, setSeconds] = useState(6);
  const [visual, setVisual] = useState<Visual | null>(null);
  const [yearly, setYearly] = useState<YearPoint[] | null>(null);
  const [chips, setChips] = useState<string[] | null>(null);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [step, setStep] = useState<{ title: string; detail: string } | null>(null);

  const root = useRef<HTMLElement>(null);
  const level = useRef(0);
  const stateRef = useRef<VoiceState>("idle");
  const run = useRef(0);
  const cut = useRef<(() => void) | null>(null);
  const answer = useRef<((v: string | null) => void) | null>(null);
  const ac = useRef<AudioContext | null>(null);
  const out = useRef<AnalyserNode | null>(null);
  const mic = useRef<AnalyserNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const playing = useRef<{ el?: HTMLAudioElement; t0: number; total: number } | null>(null);
  const clips = useRef(new Map<string, Promise<string | null>>());
  const soundRef = useRef(soundOn);
  const micRef = useRef(micOn);
  soundRef.current = soundOn;
  micRef.current = micOn;

  const api = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const res = await fetch(`/api/v1${path}`, {
        ...init,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? `Request failed (${res.status})`);
      return res.json();
    },
    [token],
  );

  // The personal link carries the token.
  useEffect(() => {
    setToken(new URLSearchParams(location.search).get("t"));
  }, []);

  useEffect(() => {
    if (!token) return;
    api<{ name: string; household: string }>("/me")
      .then(setMe)
      .catch((e) => {
        setError(e.message);
        setStage("error");
      });
  }, [token, api]);

  const go = useCallback((v: VoiceState) => {
    stateRef.current = v;
    setState(v);
  }, []);

  // One loop reads the real audio (the guide's voice or the microphone), feeds the orb and
  // the page glow, advances the caption with the playback, and hears the end of an answer.
  useEffect(() => {
    let raf = 0;
    let heard = 0;
    let quiet = 0;
    let last = performance.now();
    let shown = -1;
    const buf = new Uint8Array(1024);
    const rms = (an: AnalyserNode | null) => {
      if (!an) return 0;
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += ((buf[i] - 128) / 128) ** 2;
      return Math.sqrt(sum / buf.length);
    };
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const s = stateRef.current;
      const p = playing.current;
      let lv = 0;
      if (s === "speaking" && p) {
        const real = p.el && !p.el.paused;
        lv = real ? 1 - Math.exp(-rms(out.current) * 6.5) : 0.25 + 0.4 * Math.abs(Math.sin(now / 137) * Math.sin(now / 345 + 1));
        const pr = p.el?.duration ? p.el.currentTime / p.el.duration : (now - p.t0) / p.total;
        const st = Math.round(Math.min(1, pr) * 400);
        if (st !== shown) {
          shown = st;
          setProgress(st / 400);
        }
      } else if (s === "listening") {
        lv = micRef.current ? 1 - Math.exp(-rms(mic.current) * 9) : 0;
        if (lv > 0.16) {
          heard += dt;
          quiet = 0;
        } else if (heard > 250) {
          quiet += dt;
          if (quiet > 1100) {
            heard = quiet = 0;
            answer.current?.(null);
          }
        }
      } else {
        heard = quiet = 0;
        shown = -1;
      }
      level.current = lv;
      root.current?.style.setProperty("--lv", lv.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** Fetch a line's audio once; lines of a packet are fetched together so speech never waits. */
  const clip = useCallback(
    (text: string) => {
      if (!clips.current.has(text)) {
        clips.current.set(
          text,
          fetch("/api/v1/speech", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ text }) })
            .then((r) => (r.ok ? r.blob() : null))
            .then((b) => (b ? URL.createObjectURL(b) : null))
            .catch(() => null),
        );
      }
      return clips.current.get(text)!;
    },
    [token],
  );

  const speak = useCallback(
    (text: string) =>
      new Promise<"done" | "cut">(async (resolve) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let settled = false;
        const finish = (how: "done" | "cut") => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          playing.current?.el?.pause();
          playing.current = null;
          cut.current = null;
          resolve(how);
        };
        const begin = (total: number, el?: HTMLAudioElement) => {
          playing.current = { el, t0: performance.now(), total: total * 1000 };
          setProgress(0);
          setLine(text);
          go("speaking");
        };
        const silent = () => {
          const total = 1.2 + text.length * 0.055;
          begin(total);
          timer = setTimeout(() => finish("done"), total * 1000);
        };
        cut.current = () => finish("cut");

        const src = soundRef.current ? await clip(text) : null;
        if (settled) return;
        if (!src || !ac.current || !out.current) return silent();
        const el = new Audio(src);
        try {
          ac.current.createMediaElementSource(el).connect(out.current);
        } catch {
          return silent();
        }
        el.onloadedmetadata = () => {
          begin(el.duration || 4, el);
          el.play().catch(silent);
        };
        el.onended = () => finish("done");
        el.onerror = silent;
      }),
    [go, clip],
  );

  const listen = useCallback(
    (options: string[] | null) =>
      new Promise<string | null>((resolve) => {
        go("listening");
        setChips(options ?? []);
        answer.current = (v) => {
          answer.current = null;
          setChips(null);
          resolve(v);
        };
      }),
    [go],
  );

  const stopAudio = useCallback(() => {
    playing.current?.el?.pause();
    playing.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    mic.current = null;
    ac.current?.close().catch(() => {});
    ac.current = null;
    out.current = null;
  }, []);

  const start = useCallback(async () => {
    const id = ++run.current;
    const alive = () => run.current === id;
    setStage("call");
    setVisual(null);
    setLine("");
    setGoal(null);
    go("thinking");

    const ctxA = new AudioContext();
    ac.current = ctxA;
    const an = ctxA.createAnalyser();
    an.fftSize = 1024;
    an.smoothingTimeConstant = 0.5;
    an.connect(ctxA.destination);
    out.current = an;
    navigator.mediaDevices
      ?.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        if (!alive()) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        const node = ctxA.createAnalyser();
        node.fftSize = 1024;
        ctxA.createMediaStreamSource(s).connect(node);
        mic.current = node;
      })
      .catch(() => setMicOn(false));

    try {
      const [opened, ridge] = await Promise.all([
        api<{ session: { id: string }; packet: Packet }>("/sessions", { method: "POST", body: "{}" }),
        api<{ yearly: YearPoint[] }>("/visuals/ridge"),
      ]);
      if (!alive()) return;
      setYearly(ridge.yearly);
      let pk: Packet | null = opened.packet;

      while (pk && alive()) {
        const current: Packet = pk;
        setPacket(current);
        const lines = current.fallback;
        lines.forEach(clip);
        current.ask.forEach((a) => clip(a.question));
        setSeconds(Math.max(4, lines.join(" ").length * 0.065));
        if (current.visual.kind !== "none") setVisual(current.visual);
        if (current.visual.kind === "step") setStep({ title: current.visual.title, detail: current.visual.detail });

        // Say the phase; an interruption lets them ask for it simpler, deeper, or carry on.
        let outcome: "ok" | "simpler" | "more" = "ok";
        for (let i = 0; i < lines.length && outcome === "ok"; ) {
          const how = await speak(lines[i]);
          if (!alive()) return;
          if (how === "cut") {
            go("interrupted");
            setLine("");
            await wait(420);
            const pick = await listen(CUT_CHIPS);
            if (!alive()) return;
            if (pick === CUT_CHIPS[0]) outcome = "simpler";
            else if (pick === CUT_CHIPS[1]) outcome = "more";
            continue;
          }
          i++;
          await wait(200);
        }

        const answers: { worry?: string; level?: string; accepted?: boolean } = {};
        if (outcome === "ok") {
          const said = lines.join(" ").toLowerCase();
          for (const a of current.ask) {
            if (!said.includes(a.question.toLowerCase())) {
              await speak(a.question);
              if (!alive()) return;
            }
            const picked = await listen(a.chips);
            if (!alive()) return;
            if (a.field === "worry" && picked && current.phase === "discovery") answers.worry = picked;
            if (a.field === "level" && picked) answers.level = picked;
            if (a.field === "accepted") answers.accepted = Boolean(picked?.startsWith("Yes"));
          }
        }

        go("thinking");
        setLine("");
        const reply: DoneReply = await api<DoneReply>(`/sessions/${opened.session.id}/phase-done`, {
          method: "POST",
          body: JSON.stringify({
            understood: outcome !== "simpler",
            wantsMore: outcome === "more" || undefined,
            answers,
          }),
        });
        if (!alive()) return;
        if (reply.goal) setGoal(reply.goal);
        pk = reply.packet;
      }
    } catch (e) {
      if (!alive()) return;
      stopAudio();
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("error");
      return;
    }
    if (!alive()) return;
    go("idle");
    stopAudio();
    setStage("done");
  }, [api, clip, speak, listen, go, stopAudio]);

  const end = useCallback(() => {
    run.current++;
    cut.current?.();
    answer.current = null;
    stopAudio();
    go("idle");
    setChips(null);
    setStage("done");
  }, [go, stopAudio]);

  useEffect(
    () => () => {
      run.current++;
      stopAudio();
    },
    [stopAudio],
  );

  useEffect(() => {
    if (stage !== "call") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        cut.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage]);

  const due = goal?.due ? new Date(`${goal.due}T10:00:00`) : nextSaturday();
  const closing = goal ?? step;
  const compact = stage === "call" && Boolean(visual);

  return (
    <main ref={root} className={`call is-${stage} is-${state} ${compact ? "is-compact" : ""}`}>
      <div className="aura" aria-hidden="true" />

      <header className="call-top">
        <span className="wordmark">cordada</span>
        <AnimatePresence mode="wait">
          {stage === "call" && packet && (
            <motion.span key={packet.phase + packet.depth} className="pill" {...swap} transition={{ duration: 0.35 }}>
              {packet.name}
            </motion.span>
          )}
        </AnimatePresence>
      </header>

      <div className="call-body">
        <motion.button
          layout
          transition={{ type: "spring", stiffness: 170, damping: 24 }}
          className="orb"
          onClick={() => cut.current?.()}
          disabled={stage !== "call"}
          aria-label={state === "speaking" ? "Interrupt the guide" : "Your guide"}
        >
          <Orb state={state} level={level} />
        </motion.button>

        <AnimatePresence mode="wait">
          {stage === "lobby" && (
            <motion.section key="lobby" className="panel" {...swap}>
              {token === null ? (
                <>
                  <h1>Open this from your personal link.</h1>
                  <p>Your advisor sends each person their own link, so the plan you hear is yours.</p>
                  <Link className="btn btn-ink" href="/">
                    Choose a family
                  </Link>
                </>
              ) : (
                <>
                  <h1>{me ? `${me.name}, your plan is ready to talk through.` : "Your plan is ready to talk through."}</h1>
                  <p>
                    A few minutes, out loud. You will be talking with an AI guide from your advisor&apos;s team, and you can
                    interrupt it at any point.
                  </p>
                  <button className="btn btn-ink" onClick={start} disabled={!me}>
                    Start the conversation
                  </button>
                  <label className="check">
                    <input type="checkbox" checked={!soundOn} onChange={(e) => setSoundOn(!e.target.checked)} />
                    Captions only, no sound
                  </label>
                </>
              )}
            </motion.section>
          )}

          {stage === "error" && (
            <motion.section key="error" className="panel" {...swap}>
              <h1>We could not open your plan.</h1>
              <p>{error} Reload the page to try again.</p>
              <Link className="btn btn-ink" href="/">
                Back to the start
              </Link>
            </motion.section>
          )}

          {stage === "done" && (
            <motion.section key="done" className="panel" {...swap}>
              <span className="pill is-blue">
                {goal?.due ? due.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Whenever you are ready"}
              </span>
              <h1>{closing?.title ?? "Thanks for talking it through."}</h1>
              {closing?.detail && <p>{closing.detail}</p>}
              <div className="row">
                {closing && (
                  <button
                    className="btn btn-ink"
                    onClick={() =>
                      downloadIcs({
                        title: closing.title,
                        description: `${closing.detail}\n\nTalk it through again: ${location.href}`,
                        start: due,
                      })
                    }
                  >
                    Add to calendar
                  </button>
                )}
                <button className="btn btn-line" onClick={() => setStage("lobby")}>
                  Talk it through again
                </button>
              </div>
            </motion.section>
          )}

          {stage === "call" && visual && (
            <motion.section key={`${packet?.phase}-${packet?.depth}-${visual.kind}`} className="stage" {...swap}>
              <Stage visual={visual} yearly={yearly} seconds={seconds} />
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {stage === "call" && (
        <footer className="call-foot">
          <p className="status">
            <i />
            {stateWords[state]}
          </p>
          {captionsOn && line && <Caption text={line} progress={progress} />}
          <AnimatePresence>
            {chips && (
              <motion.div className="chips" initial="hide" animate="show" exit="hide" variants={{ show: { transition: { staggerChildren: 0.07 } } }}>
                {(chips.length ? chips : ["Continue"]).map((c) => (
                  <motion.button
                    key={c}
                    variants={{ hide: { opacity: 0, y: 14, scale: 0.9 }, show: { opacity: 1, y: 0, scale: 1 } }}
                    transition={spring}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => answer.current?.(chips.length ? c : null)}
                  >
                    {c}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="dock">
            <button aria-pressed={!micOn} aria-label={micOn ? "Mute microphone" : "Unmute microphone"} onClick={() => setMicOn((v) => !v)}>
              <Icon d={micOn ? MIC : MIC_OFF} />
            </button>
            <button aria-pressed={captionsOn} aria-label="Captions" onClick={() => setCaptionsOn((v) => !v)}>
              <Icon d={CC} />
            </button>
            <button className="is-end" aria-label="End the conversation" onClick={end}>
              <Icon d={CLOSE} />
            </button>
          </div>
        </footer>
      )}
    </main>
  );
}
