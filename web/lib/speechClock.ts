// Live captions that never rewrite themselves.
//
// ElevenLabs streams the guide's voice in small audio chunks; each one carries the characters it
// voices and when each character starts inside the chunk. The player plays chunks back to back,
// so a chunk starts when it arrives or when the previous one ends, whichever is later. From that
// we keep our own playback clock, and the caption shows only what has already been heard: words
// are added as they are spoken and nothing on screen is ever replaced by a different version.

export type Alignment = { chars: string[]; char_start_times_ms: number[]; char_durations_ms: number[] };

type Chunk = { t0: number; chars: string[]; starts: number[] };

export class SpeechClock {
  private chunks: Chunk[] = [];
  private playhead = 0;
  private playIndex = 0;

  /** @param lagMs delay between the player starting a chunk and the sound reaching the ear */
  constructor(private lagMs = 90) {}

  /** A new reply starts (the person spoke, or interrupted): forget what was being said. */
  reset() {
    this.chunks = [];
    this.playhead = 0;
    this.playIndex = 0;
  }

  /** A chunk arrived. It will play after the ones already queued. */
  receive(a: Alignment, now: number) {
    if (!a?.chars?.length) return;
    const t0 = Math.max(now + this.lagMs, this.playhead);
    const length = Math.max(0, ...a.char_start_times_ms.map((s, i) => s + (a.char_durations_ms[i] ?? 0)));
    this.chunks.push({ t0, chars: a.chars, starts: a.char_start_times_ms });
    this.playhead = t0 + length;
  }

  /**
   * The player reports that the next chunk really started now (WebSocket only). Shift that chunk
   * and the ones after it, so the estimate never drifts.
   */
  started(now: number) {
    const c = this.chunks[this.playIndex++];
    if (!c) return;
    const shift = now + this.lagMs - c.t0;
    if (Math.abs(shift) < 15) return;
    for (let i = this.playIndex - 1; i < this.chunks.length; i++) this.chunks[i].t0 += shift;
    this.playhead += shift;
  }

  /** Everything heard so far in this reply. Only ever grows. */
  heard(now: number) {
    let out = "";
    for (const c of this.chunks) {
      for (let i = 0; i < c.chars.length; i++) {
        if (c.t0 + c.starts[i] > now) return out;
        out += c.chars[i];
      }
    }
    return out;
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
  const text = heard.replace(/\s+/g, " ");
  const lastBreak = Math.max(text.lastIndexOf(" "), 0);
  const settled = /[\s.,;:?!…]$/.test(text) ? text : text.slice(0, lastBreak);
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
