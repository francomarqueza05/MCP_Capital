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
    const t = captionTail(clock.visible(now));
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

test("a word split across chunks only grows into the whole word", () => {
  const frames = replay();
  const final = new Set(FULL.split(/\s+/).map((w) => w.replace(/[^\p{L}]/gu, "")));
  for (const f of frames)
    for (const w of f.caption.split(" ").filter(Boolean)) {
      const bare = w.replace(/[^\p{L}]/gu, "");
      assert.ok([...final].some((x) => x.startsWith(bare)), `"${w}" is not the start of a real word`);
    }
  assert.ok(frames.at(-1)!.caption.includes("cabeza?"));
});

test("the caption keeps a finished sentence until the next one is spoken", () => {
  const t = captionTail("Hola Michael. Soy Cordada.");
  assert.equal(t.words.join(" "), "Soy Cordada.");
  const n = captionTail("Hola Michael. Soy Cordada. Antes");
  assert.equal(n.words.join(" "), "Antes");
});

test("a word appears, complete, the moment its first letter sounds", () => {
  const clock = new SpeechClock(0);
  clock.receive(align("Soy una inteligencia artificial."), 0); // 65 ms per character
  // "inteligencia" starts at character 8 = 520 ms.
  assert.equal(captionTail(clock.visible(500)).words.join(" "), "Soy una");
  assert.equal(captionTail(clock.visible(530)).words.join(" "), "Soy una inteligencia");
});

test("a word split across chunks shows what has arrived and completes when the rest comes", () => {
  const clock = new SpeechClock(0);
  clock.receive(align("cuando quier"), 0);
  assert.equal(clock.visible(500), "cuando quier");
  clock.receive(align("as."), 600);
  assert.equal(clock.visible(500), "cuando quieras.");
});

test("the player's real start times correct the estimate", () => {
  const clock = new SpeechClock(0);
  clock.receive(align("Hola Michael."), 0);
  clock.started(500, align("Hola Michael.")); // it really started 500 ms later
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

test("when the player starts late, the first sound resyncs the clock", () => {
  const clock = new SpeechClock(0);
  clock.receive(align("Hola Michael. Soy Cordada."), 0);
  // The speakers stay silent until 600 ms, then the voice starts.
  clock.resync(600);
  assert.equal(clock.heard(550), "", "nothing shown before it is heard");
  assert.ok(clock.heard(700).startsWith("Ho"));
});

test("a pause between chunks holds the caption until the voice resumes", () => {
  const clock = new SpeechClock(0);
  clock.receive(align("Hola."), 0); // 5 chars, ends at 325 ms
  clock.receive(align(" Soy Cordada."), 100); // the clock guesses it follows at 325 ms
  // The network stalls: silence from 325 to 1000 ms, then the voice resumes.
  clock.resync(1000);
  assert.equal(clock.heard(900), "Hola.");
  assert.ok(clock.heard(1100).startsWith("Hola. S"));
});

test("a resync that moves the clock back never removes words already shown", () => {
  const clock = new SpeechClock(0);
  clock.receive(align("Hola Michael."), 0);
  const before = clock.heard(400);
  clock.resync(450); // sound only now: the clock had run ahead
  assert.ok(clock.heard(460).startsWith(before));
});

test("a report for audio without text does not shift the wrong chunk", () => {
  const clock = new SpeechClock(0);
  clock.receive(align("Hola."), 0);
  clock.receive(align(" Soy Cordada."), 0);
  clock.started(0, align("Hola."));
  clock.started(200, null); // audio with no text
  clock.started(325, align(" Soy Cordada.")); // on time
  assert.ok(clock.heard(330).startsWith("Hola. "), clock.heard(330));
});

test("once the player reports starts, a chunk it has not started is not shown, however late", () => {
  const clock = new SpeechClock(0);
  clock.receive(align("Hola."), 0);
  clock.receive(align(" Soy Cordada."), 0);
  clock.started(0, align("Hola."));
  // The clock would guess the second chunk at 325 ms, but the player starts it at 900 ms.
  assert.equal(clock.heard(600), "Hola.");
  clock.started(900, align(" Soy Cordada."));
  assert.ok(clock.heard(1000).startsWith("Hola. S"));
});

test("a natural pause between sentences does not delay the caption when the player reports starts", () => {
  const clock = new SpeechClock(0);
  clock.receive(align("contigo. Soy una"), 0);
  clock.started(0, align("contigo. Soy una"));
  // A pause after "contigo." and then sound again: not a late start.
  clock.resync(700);
  assert.ok(clock.heard(700).includes("So"), clock.heard(700));
});
