// Personal links. A member token is a signed (case, member) pair, so it needs no database to
// check and cannot be edited to reach another family or another person in the same family.
import { createHmac, timingSafeEqual } from "node:crypto";

export type Claims = { caseId: string; memberId: string };

const DEV_SECRET = "cordada-dev-secret-change-me";

function secret() {
  const s = process.env.APP_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("APP_SECRET is required in production");
  return s || DEV_SECRET;
}

const b64 = (b: Buffer) => b.toString("base64url");
const sign = (payload: string) => b64(createHmac("sha256", secret()).update(payload).digest()).slice(0, 32);

export function issueToken(c: Claims): string {
  const payload = b64(Buffer.from(`${c.caseId}:${c.memberId}`));
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: string | null | undefined): Claims | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const good = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  const [caseId, memberId] = Buffer.from(payload, "base64url").toString().split(":");
  return caseId && memberId ? { caseId, memberId } : null;
}

/** Key for Sherpas' own servers (advisor views). Compared in constant time. */
export function isServerKey(key: string | null): boolean {
  const want = process.env.SERVER_KEY;
  if (!want || !key) return false;
  const a = Buffer.from(want);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}
