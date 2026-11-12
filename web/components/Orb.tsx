"use client";

import { useEffect, useRef } from "react";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "interrupted";

// The guide: a dark glass sphere with a thin prismatic rim and a ribbon of light at
// its equator, in the manner of Apple's Siri orb.
//   idle         one calm streak that breathes
//   listening    the streak cools and swells with the microphone
//   speaking     the streak opens into four coloured strands that move with the voice
//   thinking     the light becomes a tilted ring with a comet running around it
//   interrupted  everything collapses and dims at once
// Every frame reads the real audio level, so motion lands on the syllables.

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uLevel;
uniform float uPunch;
uniform float uSpeak;
uniform float uListen;
uniform float uThink;
uniform float uDim;

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 strandCol(int i){
  if (i == 0) return vec3(1.00, 0.98, 0.95);
  if (i == 1) return vec3(1.00, 0.60, 0.30);
  if (i == 2) return vec3(0.32, 0.62, 1.00);
  return vec3(0.78, 0.46, 1.00);
}

void main(){
  float px = 2.0 / min(uRes.x, uRes.y);
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
  float t = uTime;
  float L = uLevel;

  float R = 0.56 * (1.0 + 0.012 * sin(t * 0.9) + L * 0.035 + uPunch * 0.012) * (1.0 - uDim * 0.06);
  float r = length(uv);
  vec2 q = uv / R;
  float len = length(q);
  float aa = 2.0 * px / R;
  float inside = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, len);
  float z = sqrt(max(0.0, 1.0 - len * len));
  float ang = atan(q.y, q.x);
  float x = q.x;

  // Glass body: near black, a little depth, smoke gathering around the light.
  vec3 col = vec3(0.018, 0.020, 0.026);
  col += vec3(0.045, 0.05, 0.06) * smoothstep(1.0, 0.15, len);
  float fog = exp(-abs(q.y) * 2.2) * exp(-x * x * 1.2) * (0.16 + L * 0.22 + uSpeak * 0.04 + uThink * 0.03);
  col += vec3(0.55, 0.58, 0.68) * fog * (0.35 + 0.65 * z);
  col += vec3(0.05, 0.055, 0.07) * smoothstep(-0.1, 1.0, q.y) * (1.0 - z * 0.5);

  // Warm on the left, cool on the right, white in the middle. Listening cools it.
  vec3 tint = mix(vec3(1.0, 0.76, 0.56), vec3(0.6, 0.77, 1.0), smoothstep(-0.7, 0.7, x));
  tint = mix(tint, vec3(0.62, 0.84, 1.0), uListen * 0.45);

  // The ribbon: four strands, folded into one line when quiet.
  float env = pow(max(0.0, 1.0 - x * x), 1.15);
  float thick = (0.03 + L * 0.03 + uPunch * 0.016) * (1.0 - uDim * 0.75);
  float energy = uSpeak * (0.04 + L * 0.34) + uListen * (0.018 + L * 0.17);
  vec3 band = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float dir = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    float amp = env * (0.009 + energy * (1.0 - fi * 0.16));
    float y = amp * sin(x * (2.4 + fi * 1.25) + t * (1.3 + fi * 0.55) * dir + fi * 1.9);
    y += amp * 0.35 * sin(x * (5.0 + fi) - t * 2.1 + fi);
    float w = thick * pow(env, 1.6) * (1.0 - fi * 0.12) + 0.0012;
    float d = q.y - y;
    float core = exp(-d * d / (w * w));
    float glow = exp(-abs(d) / (w * 5.0)) * 0.22;
    band += strandCol(i) * (core + glow) * (i == 0 ? 1.0 : 0.7);
  }
  // Soft bloom around the hot centre of the ribbon.
  band += vec3(0.85, 0.88, 1.0) * exp(-q.y * q.y / 0.012) * exp(-x * x * 3.0) * (0.22 + L * 0.35) * (1.0 - uThink);
  band *= mix(tint, vec3(1.0), exp(-x * x * 4.0));
  band *= 0.5 + 0.5 * env;
  float breathe = 0.85 + 0.15 * sin(t * 1.1);
  band *= (0.62 * breathe + L * 0.95 + uPunch * 0.45) * (1.0 + uSpeak * 0.35);

  // Thinking: the equator tilts back and forth like a ring turning, with a comet on it.
  float k = 0.30 * sin(t * 1.4);
  float s = sqrt(max(0.0, 1.0 - x * x));
  float wt = 0.02 * s + 0.002;
  float d1 = q.y - k * s;
  float d2 = q.y + k * s;
  float phi = acos(clamp(x, -1.0, 1.0));
  float head = mod(t * 3.0, 6.2832);
  float c1 = 0.3 + 1.6 * pow(0.5 + 0.5 * cos(phi - head), 6.0);
  float c2 = 0.3 + 1.6 * pow(0.5 + 0.5 * cos(-phi - head), 6.0);
  vec3 ring = vec3(0.9, 0.93, 1.0) * (
      exp(-d1 * d1 / (wt * wt)) * c1 + exp(-d2 * d2 / (wt * wt)) * c2 * 0.45
    + (exp(-abs(d1) / (wt * 5.0)) * c1 + exp(-abs(d2) / (wt * 5.0)) * c2 * 0.4) * 0.18);
  ring *= mix(tint, vec3(1.0), 0.5) * 1.6;
  band = mix(band, ring, uThink);
  band *= 1.0 - uDim * 0.8;
  col += band;

  // Prismatic rim: red, green and blue sit at slightly different radii.
  float kR = 1.0 / (0.021 * 0.021);
  float e = 1.0 - len;
  vec3 rgb = vec3(exp(-pow(e + 0.004, 2.0) * kR), exp(-pow(e, 2.0) * kR), exp(-pow(e - 0.004, 2.0) * kR));
  float horiz = pow(abs(cos(ang)), 3.0);
  float rimI = 0.2 + 1.15 * horiz * exp(-q.y * q.y * 5.0) + 0.25 * smoothstep(0.2, 1.0, q.y);
  rimI *= (0.8 + L * 0.95 + uListen * 0.2) * (1.0 - uDim * 0.6);
  rimI += uThink * 1.3 * pow(0.5 + 0.5 * cos(ang - t * 2.6), 10.0);
  vec3 rimTint = mix(vec3(1.0, 0.68, 0.42), vec3(0.42, 0.68, 1.0), smoothstep(-0.6, 0.6, cos(ang)));
  rimTint = mix(rimTint, vec3(0.5, 1.0, 0.72), smoothstep(0.4, 1.0, -sin(ang)) * smoothstep(0.2, 0.9, -cos(ang)) * 0.6);
  rimTint = mix(rimTint, vec3(0.92, 0.94, 1.0), smoothstep(0.3, 1.0, q.y));
  col += rgb * rimTint * rimI;
  col += vec3(0.6, 0.65, 0.78) * pow(1.0 - z, 4.0) * (0.22 + L * 0.4);

  col = 1.0 - exp(-col * 1.25);
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

  // Outside: a faint halo, and light leaking sideways at the ribbon's height.
  float dOut = max(r - R, 0.0);
  float halo = exp(-dOut * 7.0) * (0.05 + L * 0.16 + uPunch * 0.06) * (1.0 - uDim * 0.7);
  float flare = exp(-abs(uv.y) * (42.0 - L * 22.0)) * exp(-dOut * 6.0) * (0.03 + L * 0.3) * (1.0 - uThink) * (1.0 - uDim);
  vec3 haloC = vec3(0.7, 0.76, 0.92) * halo + mix(vec3(1.0, 0.74, 0.52), vec3(0.58, 0.75, 1.0), step(0.0, uv.x)) * flare;
  // Fade every outside light to nothing well before the canvas edge, so nothing is clipped.
  float box = max(abs(uv.x), abs(uv.y));
  float edgeFade = (1.0 - smoothstep(0.62, 0.98, box)) * (1.0 - smoothstep(0.7, 1.0, r));
  haloC *= edgeFade;
  float hA = clamp(max(max(haloC.r, haloC.g), haloC.b), 0.0, 1.0);

  vec3 outCol = col * inside + haloC * (1.0 - inside);
  gl_FragColor = vec4(outCol, max(inside, hA * (1.0 - inside)));
}`;

type Mood = { speak: number; listen: number; think: number; dim: number };

const moods: Record<VoiceState, Mood> = {
  idle: { speak: 0, listen: 0, think: 0, dim: 0 },
  listening: { speak: 0, listen: 1, think: 0, dim: 0 },
  speaking: { speak: 1, listen: 0, think: 0, dim: 0 },
  thinking: { speak: 0, listen: 0, think: 1, dim: 0 },
  interrupted: { speak: 0, listen: 0, think: 0, dim: 1 },
};

export function Orb({ state, level }: { state: VoiceState; level: React.RefObject<number> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: true, alpha: true, powerPreference: "high-performance" });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const u = {
      res: U("uRes"),
      time: U("uTime"),
      level: U("uLevel"),
      punch: U("uPunch"),
      speak: U("uSpeak"),
      listen: U("uListen"),
      think: U("uThink"),
      dim: U("uDim"),
    };

    const resize = () => {
      // Supersample: render above the screen's pixel density so the hairline rim and the
      // light ribbon stay crisp, capped so a large canvas stays cheap.
      const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1) * 1.6, 3.2);
      const { width, height } = canvas.getBoundingClientRect();
      const side = Math.min(2400, Math.max(2, Math.round(Math.max(width, height) * dpr)));
      canvas.width = side;
      canvas.height = side;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cur: Mood = { ...moods.idle };
    let lv = 0;
    let punch = 0;
    let prev = 0;
    let t = 0;
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      const target = moods[s];
      // An interruption snaps; every other change glides.
      const k = s === "interrupted" ? 0.3 : 0.075;
      cur.speak += (target.speak - cur.speak) * k;
      cur.listen += (target.listen - cur.listen) * k;
      cur.think += (target.think - cur.think) * k;
      cur.dim += (target.dim - cur.dim) * k;

      // Fast attack, slower release: the light jumps on a syllable and settles after it.
      const raw = Math.min(1, Math.max(0, level.current ?? 0));
      lv += (raw - lv) * (raw > lv ? 0.5 : 0.1);
      punch = Math.max(punch * 0.85, Math.max(0, raw - prev) * 3.2);
      prev = raw;
      t += dt * (still ? 0.15 : 0.6 + lv * 1.3 + cur.speak * 0.35);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, t);
      gl.uniform1f(u.level, lv);
      gl.uniform1f(u.punch, Math.min(1, punch));
      gl.uniform1f(u.speak, cur.speak);
      gl.uniform1f(u.listen, cur.listen);
      gl.uniform1f(u.think, cur.think);
      gl.uniform1f(u.dim, cur.dim);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [level]);

  return <canvas ref={ref} className="orb-canvas" aria-hidden="true" />;
}
