"use client";

import Link from "next/link";
import { AnimatePresence, animate, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cases, type Ctx, type Phase, type Visual } from "@/mock/data";
import voice from "@/mock/voice.json";
import { downloadIcs, nextSaturday } from "@/lib/calendar";
import { Orb, type VoiceState } from "./Orb";
import { Ridge } from "./Ridge";

const clips = voice as Record<string, string>;
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

const Icon = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const MIC = "M12 4a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 5 0v-5A2.5 2.5 0 0 0 12 4ZM6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3";
const MIC_OFF = "M4 4l16 16M9.5 9.5v2a2.5 2.5 0 0 0 4 2M14.5 10V6.5a2.5 2.5 0 0 0-4.6-1.3M6.5 11.5a5.5 5.5 0 0 0 9 4.2M12 17v3";
const CC = "M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-9ZM10.5 10.5a2 2 0 1 0 0 3M16.5 10.5a2 2 0 1 0 0 3";
const CLOSE = "M6 6l12 12M18 6 6 18";

// Visual pass: the script and figures come from mock data, the voice is ElevenLabs audio
// rendered ahead of time. The live build swaps `speak` and `listen` for the ElevenLabs
// agent session; the orb already runs on real audio levels, so nothing here changes.
export function CallExperience({ slug }: { slug: string }) {
  const data = cases[slug];
  const [member, setMember] = useState(data.members[0]);
  const [stage, setStage] = useState<"lobby" | "call" | "done">("lobby");
  const [state, setState] = useState<VoiceState>("idle");
  const [phase, setPhase] = useState<Phase | null>(null);
  const [line, setLine] = useState("");
  const [progress, setProgress] = useState(0);
  const [seconds, setSeconds] = useState(4);
  const [visual, setVisual] = useState<Visual | null>(null);
  const [chips, setChips] = useState<string[] | null>(null);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [accepted, setAccepted] = useState(false);

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
  const soundRef = useRef(soundOn);
  const micRef = useRef(micOn);
  soundRef.current = soundOn;
  micRef.current = micOn;

  const go = useCallback((v: VoiceState) => {
    stateRef.current = v;
    setState(v);
  }, []);

  // One loop reads the real audio (the guide's voice or the family's microphone),
  // feeds the orb and the page glow, and advances the caption with the playback.
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
        const step = Math.round(Math.min(1, pr) * 400);
        if (step !== shown) {
          shown = step;
          setProgress(step / 400);
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

  const speak = useCallback(
    (text: string) =>
      new Promise<"done" | "cut">((resolve) => {
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
          setSeconds(total);
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

        const src = clips[text];
        if (!src || !soundRef.current || !ac.current || !out.current) return silent();
        const el = new Audio(src);
        el.preload = "auto";
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
    [go],
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
    setAccepted(false);
    setVisual(null);
    setLine("");

    const ctxA = new AudioContext();
    ac.current = ctxA;
    const an = ctxA.createAnalyser();
    an.fftSize = 1024;
    an.smoothingTimeConstant = 0.5;
    an.connect(ctxA.destination);
    out.current = an;
    // The guide starts talking at once; the microphone joins when the family allows it.
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

    await wait(700);
    const ctx: Ctx = { name: member.name, worry: null };
    for (const p of data.phases) {
      if (!alive()) return;
      setPhase(p);
      let i = 0;
      while (i < p.lines.length) {
        const l = p.lines[i];
        if (l.visual !== undefined) setVisual(l.visual);
        const how = await speak(typeof l.say === "function" ? l.say(ctx) : l.say);
        if (!alive()) return;
        if (how === "cut") {
          go("interrupted");
          setLine("");
          await wait(500);
          if (!alive()) return;
          await listen(null);
          if (!alive()) return;
          go("thinking");
          await wait(900);
          if (!alive()) return;
          await speak(p.interruptReply);
          if (!alive()) return;
          continue;
        }
        i++;
        await wait(220);
      }
      if (p.ask) {
        const picked = await listen(p.ask.chips);
        if (!alive()) return;
        if (p.ask.remember === "worry") ctx.worry = picked;
        if (p.id === "step") setAccepted(Boolean(picked?.startsWith("Yes")));
        go("thinking");
        setLine("");
        await wait(1000);
      }
    }
    if (!alive()) return;
    go("idle");
    stopAudio();
    setStage("done");
  }, [data, member, speak, listen, go, stopAudio]);

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

  const when = nextSaturday();
  const compact = stage === "call" && Boolean(visual);

  return (
    <main ref={root} className={`call is-${stage} is-${state} ${compact ? "is-compact" : ""}`}>
      <div className="aura" aria-hidden="true" />

      <header className="call-top">
        <span className="wordmark">cordada</span>
        <AnimatePresence mode="wait">
          {stage === "call" && phase && (
            <motion.span key={phase.id} className="pill" {...swap} transition={{ duration: 0.35 }}>
              {phase.name}
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
              <h1>{member.name}, your plan is ready to talk through.</h1>
              <p>
                Six minutes, out loud. You will be talking with an AI guide from your advisor&apos;s team, and you can
                interrupt it at any point.
              </p>
              {data.members.length > 1 && (
                <div className="segmented" role="group" aria-label="Who is talking">
                  {data.members.map((m) => (
                    <button key={m.id} aria-pressed={m.id === member.id} onClick={() => setMember(m)}>
                      {m.id === member.id && <motion.i layoutId="seg" transition={spring} />}
                      <span>{m.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <button className="btn btn-ink" onClick={start}>
                Start the conversation
              </button>
              <label className="check">
                <input type="checkbox" checked={!soundOn} onChange={(e) => setSoundOn(!e.target.checked)} />
                Captions only, no sound
              </label>
            </motion.section>
          )}

          {stage === "done" && (
            <motion.section key="done" className="panel" {...swap}>
              <span className="pill is-blue">
                {accepted ? when.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Whenever you are ready"}
              </span>
              <h1>{data.step.title}</h1>
              <p>{data.step.detail}</p>
              <div className="row">
                <button
                  className="btn btn-ink"
                  onClick={() =>
                    downloadIcs({
                      title: data.step.title,
                      description: `${data.step.detail}\n\nTalk it through again: ${location.origin}/call/${slug}`,
                      start: when,
                    })
                  }
                >
                  Add to calendar
                </button>
                <Link className="btn btn-line" href={`/home/${slug}`}>
                  See your steps
                </Link>
              </div>
              <button className="text-link" onClick={() => setStage("lobby")}>
                Talk it through again
              </button>
            </motion.section>
          )}

          {stage === "call" && visual && (
            <motion.section key={visual.kind} className="stage" {...swap}>
              {visual.kind === "figure" && (
                <div className="v-figure">
                  <div className="ring">
                    <svg viewBox="0 0 120 120" aria-hidden="true">
                      <circle cx="60" cy="60" r="52" className="ring-track" />
                      <motion.circle
                        cx="60"
                        cy="60"
                        r="52"
                        className="ring-fill"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: visual.share }}
                        transition={{ duration: Math.max(1.6, seconds * 0.8), ease: [0.2, 0.7, 0.2, 1], delay: 0.5 }}
                      />
                    </svg>
                    <span>
                      {Math.round(visual.share * 100)}%<small>{visual.shareLabel}</small>
                    </span>
                  </div>
                  <strong>
                    <Count to={visual.amount} seconds={Math.min(2.2, seconds * 0.45)} />
                  </strong>
                  <p>{visual.sentence}</p>
                </div>
              )}
              {visual.kind === "ridge" && <Ridge yearly={data.yearly} toAge={visual.toAge} flags={visual.flags} seconds={seconds} />}
              {visual.kind === "compare" && (
                <div className="v-compare">
                  <AnimatePresence>
                    {visual.rows.map((r) => (
                      <motion.div key={r.label} layout className={r.tone === "attention" ? "is-attention" : ""} {...swap}>
                        <strong>
                          <Count to={r.amount} seconds={1.6} />
                        </strong>
                        <span>{r.label}</span>
                        <motion.i
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: Math.max(0.012, r.amount / visual.rows[0].amount) }}
                          transition={{ type: "spring", stiffness: 60, damping: 16, delay: 0.3 }}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              {visual.kind === "step" && (
                <div className="v-step">
                  <span className="pill is-blue">This week</span>
                  <strong>{data.step.title}</strong>
                  <p>{data.step.detail}</p>
                </div>
              )}
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
