// Splits what the guide says into short caption phrases, keeping each phrase's position in the
// original text so the caption can follow the voice letter by letter.
//  - A sentence ends at . ? ! or … followed by a space or the end, so "3.2 months" or "$1.5M"
//    never break, and a sentence still arriving without its full stop is kept.
//  - Long sentences are cut at commas, colons or semicolons, then by words, so a phrase always
//    fits on screen and is never clipped.

export type Phrase = { text: string; start: number; end: number };

const MAX = 90;
const WORDS = 12;

function sentences(text: string): Phrase[] {
  const out: Phrase[] = [];
  const re = /[.?!…]+["'»)\]]*(?=\s|$)/g;
  let from = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const end = m.index + m[0].length;
    out.push({ text: text.slice(from, end), start: from, end });
    from = end;
  }
  if (from < text.length) out.push({ text: text.slice(from), start: from, end: text.length });
  return out;
}

function cut(p: Phrase, at: RegExp): Phrase[] {
  if (p.text.trim().length <= MAX) return [p];
  const parts: Phrase[] = [];
  let from = 0;
  let last = 0;
  for (let m = at.exec(p.text); m; m = at.exec(p.text)) {
    const end = m.index + m[0].length;
    if (end - from > MAX && last > from) {
      parts.push({ text: p.text.slice(from, last), start: p.start + from, end: p.start + last });
      from = last;
    }
    last = end;
  }
  parts.push({ text: p.text.slice(from), start: p.start + from, end: p.end });
  at.lastIndex = 0;
  return parts;
}

function byWords(p: Phrase): Phrase[] {
  if (p.text.trim().length <= MAX + 20) return [p];
  const out: Phrase[] = [];
  const re = /\S+\s*/g;
  let from = 0;
  let n = 0;
  for (let m = re.exec(p.text); m; m = re.exec(p.text)) {
    n++;
    const end = m.index + m[0].length;
    if (n === WORDS && end < p.text.length) {
      out.push({ text: p.text.slice(from, end), start: p.start + from, end: p.start + end });
      from = end;
      n = 0;
    }
  }
  if (from < p.text.length) out.push({ text: p.text.slice(from), start: p.start + from, end: p.end });
  return out;
}

export function phrases(text: string): Phrase[] {
  return sentences(text)
    .flatMap((s) => cut(s, /[,;:—–]\s+/g))
    .flatMap(byWords)
    .filter((p) => p.text.trim());
}

/** The phrase being spoken at a character position, and how many of its words have been reached. */
export function current(text: string, pos: number) {
  const list = phrases(text);
  if (!list.length) return null;
  const p = list.find((x) => pos < x.end) ?? list[list.length - 1];
  const words: { w: string; at: number }[] = [];
  const re = /\S+/g;
  for (let m = re.exec(p.text); m; m = re.exec(p.text)) words.push({ w: m[0], at: p.start + m.index });
  return { phrase: p, words, said: words.filter((w) => w.at < pos).length };
}
