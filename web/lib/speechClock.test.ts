// Replays a real reply captured from the live agent (chunk arrival times and texts) and checks the
// caption only ever grows within a sentence and moves cleanly to the next one.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SpeechClock, captionTail, type Alignment } from "./speechClock";

// Captured from the agent: [arrival ms, chunk text]. Chunks can split words ("pi" + "ensas").
const CAPTURED: [number, string][] = [
  [580, "Hola"],
  [650, " Michael"],
  [893, ". Soy Cordada,"],
  [1133, " la guía que el equipo"],
  [1760, " de tu asesor ha preparado para repasar tu"],
  [2324, " plan contigo. Soy una inteligencia"],
  [3026, " artificial y puedes interrumpirme cuando quieras."],
  [3594, " Antes de ver números: cuando pi"],
  [4269, "ensas en el dinero, ¿qué es lo que más te ronda"],
  [4652, " la cabeza?"],
];
const FULL = CAPTURED.map((c) => c[1]).join("");

/** ~65 ms per character, like the real alignment. */
const align = (text: string): Alignment => {
  const chars = [...text];
  return { chars, char_start_times_ms: chars.map((_, i) => i * 65), char_durations_ms: chars.map(() => 65) };
};

function replay() {
  const clock = new SpeechClock(90);
  const frames: { heard: string; caption: string; key: number }[] = [];
  let next = 0;
  for (let now = 0; now <= 20000; now += 16) {
    while (next < CAPTURED.length && CAPTURED[next][0] <= now) clock.receive(align(CAPTURED[next++][1]), now);
    const heard = clock.heard(now);
    const t = captionTail(heard);
    frames.push({ heard, caption: t.words.join(" "), key: t.key });
  }
  return frames;
}

test("what is heard only ever grows, and ends as the whole reply", () => {
  const frames = replay();
  for (let i = 1; i < frames.length; i++) assert.ok(frames[i].heard.startsWith(frames[i - 1].heard), `frame ${i} rewrote the past`);
  assert.equal(frames.at(-1)!.heard, FULL);
});

test("within a sentence the caption only adds words; a new sentence replaces it whole", () => {
  const frames = replay();
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1];
    const b = frames[i];
    if (a.key === b.key) assert.ok(b.caption.startsWith(a.caption), `"${a.caption}" became "${b.caption}"`);
    else assert.ok(b.key > a.key, "sentences and pages only move forward");
  }
});

test("a word split across chunks never shows half", () => {
  const shown = new Set(replay().flatMap((f) => f.caption.split(" ")));
  assert.ok(!shown.has("pi"), "half word shown");
  assert.ok(shown.has("piensas"));
});

test("the caption keeps a finished sentence until the next one is spoken", () => {
  const t = captionTail("Hola Michael. Soy Cordada.");
  assert.equal(t.words.join(" "), "Soy Cordada.");
  const n = captionTail("Hola Michael. Soy Cordada. Ant");
  assert.equal(n.words.join(" "), "Soy Cordada.", "the next sentence starts only with a full word");
});

test("the player's real start times correct the estimate", () => {
  const clock = new SpeechClock(0);
  clock.receive(align("Hola Michael."), 0);
  clock.started(500); // it really started 500 ms later
  assert.equal(clock.heard(400), "");
  assert.ok(clock.heard(700).startsWith("Hola"));
});

test("a long sentence turns the page at a comma instead of scrolling", () => {
  const long = "Lo que más destaca en tu plan es el dinero para la casa, porque la entrada sale casi toda de tus inversiones y eso reduce lo que tendrás";
  const first = captionTail(long.split(" ").slice(0, 16).join(" ") + " ");
  const next = captionTail(long + " ");
  assert.equal(first.cutBefore, false);
  assert.equal(next.cutBefore, true);
  assert.equal(next.words[0], "porque", next.words.join(" "));
});
