// Live captions that never rewrite themselves.
//
// ElevenLabs streams the guide's voice in small audio chunks; each one carries the characters it
// voices and when each character starts inside the chunk. The player plays chunks back to back,
// so a chunk starts when it arrives or when the previous one ends, whichever is later. From that
// we keep our own playback clock, and the caption shows only what has already been heard: words
// are added as they are spoken and nothing on screen is ever replaced by a different version.

export type Alignment = { chars: string[]; char_start_times_ms: number[]; char_durations_ms: number[] };

type Chunk = { t0: number; len: number; chars: string[]; starts: number[]; text: string; started: boolean };

export class SpeechClock {
  private chunks: Chunk[] = [];
  private playhead = 0;
  private shown = "";
  /** Once the player reports chunk starts, only chunks it has started count as heard. */
  private reports = false;

  /** @param lagMs delay between the player starting a chunk and the sound reaching the ear */
  constructor(private lagMs = 90) {}

  /** A new reply starts (the person spoke, or interrupted): forget what was being said. */
  reset() {
    this.chunks = [];
    this.playhead = 0;
    this.shown = "";
  }

  /** A chunk arrived. It will play after the ones already queued. */
  receive(a: Alignment, now: number) {
    if (!a?.chars?.length) return;
    const t0 = Math.max(now + this.lagMs, this.playhead);
    const length = Math.max(0, ...a.char_start_times_ms.map((s, i) => s + (a.char_durations_ms[i] ?? 0)));
    this.chunks.push({ t0, len: length, chars: a.chars, starts: a.char_start_times_ms, text: a.chars.join(""), started: false });
    this.playhead = t0 + length;
  }

  /**
   * The player reports that a chunk really started now (WebSocket only). It is matched to our
   * chunk by its text, not by position: the stream can carry audio without text, so counting
   * reports would pair them with the wrong chunks. That chunk and the ones after it are shifted.
   */
  started(now: number, a?: Alignment | null) {
    if (!a?.chars?.length) return;
    const text = a.chars.join("");
    const k = this.chunks.findIndex((c) => !c.started && c.text === text);
    if (k < 0) return;
    this.reports = true;
    this.chunks[k].started = true;
    const shift = now + this.lagMs - this.chunks[k].t0;
    if (Math.abs(shift) < 15) return;
    for (let i = k; i < this.chunks.length; i++) this.chunks[i].t0 += shift;
    this.playhead += shift;
  }

  /**
   * The speakers just went from silence to sound. Whatever the clock guessed, the chunk that
   * should be playing (or the next one) really starts now: shift it and everything after it.
   * Catches a player that starts late, and pauses between chunks when the network is slow.
   * Only used when the player does not report chunk starts (WebRTC).
   */
  resync(now: number) {
    // The player's own reports are exact; silence inside a reply is often just a natural pause
    // between sentences, so resyncing on it would push the caption late.
    if (this.reports) return;
    const k = this.chunks.findIndex((c) => c.t0 + c.len > now - 200);
    if (k < 0) return;
    const shift = now + this.lagMs - this.chunks[k].t0;
    if (Math.abs(shift) < 60) return;
    for (let i = k; i < this.chunks.length; i++) this.chunks[i].t0 += shift;
    this.playhead += shift;
  }

  /** Everything heard so far in this reply. Only ever grows. */
  heard(now: number) {
    let out = "";
    scan: for (const c of this.chunks) {
      // With reports, a chunk the player has not started yet has not been heard, whatever we guessed.
      if (this.reports && !c.started) break;
      for (let i = 0; i < c.chars.length; i++) {
        if (c.t0 + c.starts[i] > now) break scan;
        out += c.chars[i];
      }
    }
    // A resync can move the clock back; words already on screen never disappear.
    if (out.length > this.shown.length) this.shown = out;
    return this.shown;
  }

  /** All the text received for this reply so far, heard or not. Arrives well ahead of the sound. */
  get received() {
    return this.chunks.map((c) => c.chars.join("")).join("");
  }

  /**
   * What the caption may show: every word whose first letter has been heard, written out in full
   * from the text already received. A word appears the moment it starts sounding, not after it
   * ends. If a chunk cut the word, what has arrived shows and the rest is added when it comes.
   */
  visible(now: number) {
    const heard = this.heard(now);
    const all = this.received;
    if (!heard) return "";
    // Between words: the next one has not started yet.
    if (/\s$/.test(heard)) return heard.trimEnd();
    const rest = all.slice(heard.length);
    const m = rest.match(/^\S*/);
    // The word being spoken, as far as it has been received. If a chunk cut it, it grows into the
    // whole word when the rest arrives; it is never held back (that froze the caption for seconds).
    return heard + (m ? m[0] : "");
  }

  get empty() {
    return this.chunks.length === 0;
  }
}

/**
 * What the caption shows from what has been heard: the sentence being said, word by word as it
 * is spoken. When a sentence ends it stays until the next one begins. A sentence too long for
 * three lines turns the page (after a comma when there is one near) instead of scrolling, so a
 * word on screen never moves or disappears until the whole line is replaced. A word is shown only
 * once it is complete (a chunk can end in the middle of a word).
 */
export function captionTail(heard: string, maxWords = 16) {
  // `heard` holds whole words only (see SpeechClock.visible).
  const settled = heard.replace(/\s+/g, " ").trimStart() + " ";
  const ends = [...settled.matchAll(/[.?!…]+["'»)]*\s/g)].map((m) => m.index! + m[0].length);
  const start = ends.length ? ends[ends.length - 1] : 0;
  const sentenceStart = settled.slice(start).trim() ? start : ends.length > 1 ? ends[ends.length - 2] : 0;
  const words = settled.slice(sentenceStart).trim().split(" ").filter(Boolean);

  // Pages are decided from the start of the sentence with words already said only, so a page
  // boundary never moves once it exists.
  let page = 0;
  let from = 0;
  for (let i = 0; i < words.length; i++) {
    if (i - from + 1 > maxWords) {
      let cut = i;
      for (let k = i - 1; k > i - 7 && k > from; k--)
        if (/[,;:]$/.test(words[k])) {
          cut = k + 1;
          break;
        }
      from = cut;
      page++;
    }
  }
  return { key: sentenceStart * 100 + page, words: words.slice(from), cutBefore: page > 0 };
}
