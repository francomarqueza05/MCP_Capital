// npm test  (runs from web/, reads ../cases)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { caseIds, casesDir, getCase } from "../cases/load";
import { advance, packet, startState, type SessionState } from "./engine";
import { lookup } from "./lookup";
import { TOPICS } from "./topics";

const ids = caseIds();

/** Walk a whole conversation with fixed answers and collect every packet. */
function walk(id: string, worry?: string) {
  const c = getCase(id)!;
  let s: SessionState = startState(c, c.members[0]);
  const packets = [packet(c, s)];
  s = advance(c, s, { answers: { worry, level: "Keep it simple" } }).state;
  let guard = 0;
  while (!s.done && guard++ < 20) {
    packets.push(packet(c, s));
    s = advance(c, s, { understood: true, answers: { accepted: true } }).state;
  }
  return { c, s, packets };
}

test("all four cases load with members, facts and persona", () => {
  assert.equal(ids.length, 4);
  for (const id of ids) {
    const c = getCase(id)!;
    assert.ok(c.members.length >= 1, id);
    assert.ok(c.facts.length >= 10, id);
    assert.ok(c.persona.concerns.length >= 5, id);
    assert.ok(c.persona.tensions.length >= 3, id);
    assert.ok(c.recommendations.length >= 3, id);
    assert.ok(c.persona.concerns.every((k) => k.title), id);
  }
});

test("every conversation starts with discovery, never with bad news, and ends with a commitment", () => {
  for (const id of ids) {
    const { s, packets } = walk(id);
    assert.equal(packets[0].phase, "discovery");
    assert.equal(packets[0].facts.length, 0, "no figures before we know them");
    assert.equal(packets[1].phase, "today");
    assert.equal(packets.at(-1)!.phase, "commit");
    assert.ok(s.done);
    assert.deepEqual(new Set(packets.map((p) => p.phase)).size, packets.length, "no phase repeats");
  }
});

test("every figure in every packet is a figure from the plan", () => {
  for (const id of ids) {
    const raw = readFileSync(join(casesDir(), id, "financial-health.json"), "utf8");
    for (const p of walk(id).packets) {
      for (const f of p.facts) {
        if (f.id.startsWith("move.")) {
          assert.ok(raw.includes(`"score_after": ${f.value}`), `${id} ${f.id}`);
          continue;
        }
        const v = typeof f.value === "number" ? String(f.value) : JSON.stringify(f.value);
        assert.ok(raw.includes(v), `${id} ${p.phase} ${f.id}=${v} not in the plan`);
      }
    }
  }
});

test("their worry steers the focus", () => {
  const retire = walk("michael-carter", "Will I have enough to retire at 58?");
  assert.match(retire.packets.find((p) => p.phase === "focus")!.goal, /retirement/i);
  const house = walk("michael-carter", "Buying the house");
  assert.notEqual(
    house.packets.find((p) => p.phase === "focus")!.goal,
    retire.packets.find((p) => p.phase === "focus")!.goal,
    "a different worry gives a different focus",
  );

  const kids = walk("timothy-melanie-weah", "Keep the kids safe if something happens to us");
  assert.match(kids.packets.find((p) => p.phase === "focus")!.goal, /insurance|life/i);
});

test("wanting more goes one level deeper, once, then moves on", () => {
  const c = getCase("michael-carter")!;
  let s = advance(c, startState(c, c.members[0]), { answers: { worry: "retiring at 58" } }).state;
  s = advance(c, s, {}).state; // today -> focus
  assert.equal(s.plan[s.phase], "focus");
  const before = packet(c, s).facts.length;
  s = advance(c, s, { wantsMore: true }).state;
  assert.equal(s.plan[s.phase], "focus");
  assert.equal(s.depth, 1);
  assert.ok(packet(c, s).facts.length >= before);
  s = advance(c, s, { wantsMore: true }).state;
  assert.notEqual(s.plan[s.phase], "focus", "never loops on one phase");
});

test("lookup answers every topic from the plan only", () => {
  for (const id of ids) {
    const c = getCase(id)!;
    for (const t of TOPICS) {
      const r = lookup(c, t.id);
      assert.equal(r.topic, t.id);
      assert.ok(r.facts.length + r.planSays.length > 0, `${id} ${t.id} has nothing to say`);
    }
  }
});
