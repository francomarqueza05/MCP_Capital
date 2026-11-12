// End to end through the real route handlers, without a server.
import assert from "node:assert/strict";
import { test } from "node:test";
import { issueToken } from "../auth/token";
import { POST as openSession } from "../../app/api/v1/sessions/route";
import { GET as getSession } from "../../app/api/v1/sessions/[id]/route";
import { POST as phaseDone } from "../../app/api/v1/sessions/[id]/phase-done/route";
import { GET as lookup } from "../../app/api/v1/lookup/route";
import { GET as goals } from "../../app/api/v1/goals/route";
import { GET as nextStep } from "../../app/api/v1/next-step/route";
import { GET as brief } from "../../app/api/v1/households/[caseId]/advisor-brief/route";

const timothy = issueToken({ caseId: "timothy-melanie-weah", memberId: "timothy" });
const melanie = issueToken({ caseId: "timothy-melanie-weah", memberId: "melanie" });
const michael = issueToken({ caseId: "michael-carter", memberId: "michael" });

const req = (path: string, token?: string, init: RequestInit = {}) =>
  new Request(`http://test${path}`, {
    ...init,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json", ...(init.headers ?? {}) },
  });
const ctx = <T>(params: T) => ({ params: Promise.resolve(params) });
const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

test("a full conversation through the API ends in a goal and a next step", async () => {
  const open = await openSession(req("/api/v1/sessions", timothy, post({})));
  assert.equal(open.status, 201);
  const o = await open.json();
  assert.equal(o.packet.phase, "discovery");
  assert.equal(o.persona.name, "Timothy");

  let r = await (await phaseDone(req("", timothy, post({ answers: { worry: "Paying for college", level: "Keep it simple" } })), ctx({ id: o.session.id }))).json();
  assert.equal(r.packet.phase, "today");
  assert.equal(r.persona.level, "new");
  let guard = 0;
  while (r.packet && guard++ < 12) {
    r = await (await phaseDone(req("", timothy, post({ understood: true, emotion: "calm", answers: { accepted: true } })), ctx({ id: o.session.id }))).json();
  }
  assert.equal(r.session.done, true);
  assert.ok(r.goal?.due, "accepting creates a goal with a date");

  const g = await (await goals(req("/api/v1/goals", timothy))).json();
  assert.equal(g.length, 1);
  const n = await (await nextStep(req("/api/v1/next-step", timothy))).json();
  assert.equal(n.source, "goal");

  // The next conversation starts from what was learnt.
  const again = await (await openSession(req("/api/v1/sessions", timothy, post({})))).json();
  assert.equal(again.persona.worry, "Paying for college");
  assert.match(again.persona.previousConversation, /college/i);
});

test("nobody reads someone else's conversation or goals", async () => {
  const o = await (await openSession(req("/api/v1/sessions", timothy, post({})))).json();
  for (const token of [melanie, michael]) {
    const r = await getSession(req("", token), ctx({ id: o.session.id }));
    assert.equal(r.status, 404);
    const p = await phaseDone(req("", token, post({})), ctx({ id: o.session.id }));
    assert.equal(p.status, 404);
  }
  assert.deepEqual(await (await goals(req("/api/v1/goals", melanie))).json(), []);
});

test("bad or missing tokens and bad input are refused", async () => {
  assert.equal((await openSession(req("/api/v1/sessions", undefined, post({})))).status, 401);
  const forged = timothy.split(".")[0] + ".AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  assert.equal((await openSession(req("/api/v1/sessions", forged, post({})))).status, 401);
  assert.equal((await lookup(req("/api/v1/lookup?topic=crypto", timothy))).status, 400);
  const o = await (await openSession(req("/api/v1/sessions", timothy, post({})))).json();
  assert.equal((await phaseDone(req("", timothy, post({ understood: "yes" })), ctx({ id: o.session.id }))).status, 400);
  assert.equal((await phaseDone(req("", timothy, { method: "POST", body: "{nope" }), ctx({ id: o.session.id }))).status, 400);
});

test("the advisor brief needs the server key", async () => {
  process.env.SERVER_KEY = "test-server-key";
  assert.equal((await brief(req("", timothy), ctx({ caseId: "timothy-melanie-weah" }))).status, 401);
  const r = await brief(req("", undefined, { headers: { "x-api-key": "test-server-key" } }), ctx({ caseId: "timothy-melanie-weah" }));
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.members.length, 2);
  assert.ok(b.members[0].conversations >= 1);
});
