"use client";

import { useEffect, useRef, useState } from "react";
import { Orb, type VoiceState } from "@/components/Orb";

const states: VoiceState[] = ["idle", "listening", "speaking", "thinking", "interrupted"];

// Bench for the orb: every state, with a synthetic voice level to see how it reacts.
export function OrbLab() {
  const [state, setState] = useState<VoiceState>(() => {
    const s = typeof location !== "undefined" ? new URLSearchParams(location.search).get("s") : null;
    return states.includes(s as VoiceState) ? (s as VoiceState) : "idle";
  });
  const level = useRef(0);
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const talking = state === "speaking" || state === "listening";
      // Syllable-like envelope: bursts with short gaps, like speech.
      const syl = Math.max(0, Math.sin(now / 95)) * Math.max(0, Math.sin(now / 410 + 1.3));
      level.current = talking ? Math.min(1, 0.15 + syl * 0.85) * (state === "listening" ? 0.7 : 1) : 0;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  return (
    <main className="call is-call" style={{ placeItems: "center" }}>
      <div />
      <div style={{ width: "min(90vw, 520px)", aspectRatio: "1" }}>
        <Orb state={state} level={level} />
      </div>
      <div className="dock" style={{ marginBottom: 24 }}>
        {states.map((s) => (
          <button key={s} aria-pressed={s === state} onClick={() => setState(s)} style={{ width: "auto", padding: "0 14px", color: s === state ? "#fff" : undefined }}>
            {s}
          </button>
        ))}
      </div>
    </main>
  );
}
