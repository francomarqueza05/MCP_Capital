// Small helpers shared by every /api/v1 route: auth, JSON errors and body parsing.
import { getCase, type CaseData, type Member } from "../cases/load";
import { isServerKey, readToken } from "../auth/token";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: { code: e.code, message: e.message } }, e.status);
      console.error(e);
      return json({ error: { code: "internal", message: "Something went wrong on our side." } }, 500);
    }
  };
}

export type Caller = { caseData: CaseData; member: Member; owner: { caseId: string; memberId: string } };

/** The member behind a personal link: `Authorization: Bearer <token>` or `?t=<token>`. */
export function member(req: Request): Caller {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : new URL(req.url).searchParams.get("t");
  const claims = readToken(token);
  if (!claims) throw new ApiError(401, "unauthorized", "Missing or invalid member token.");
  const caseData = getCase(claims.caseId);
  const m = caseData?.members.find((x) => x.id === claims.memberId);
  if (!caseData || !m) throw new ApiError(401, "unauthorized", "This link no longer matches a household member.");
  return { caseData, member: m, owner: { caseId: claims.caseId, memberId: claims.memberId } };
}

export function server(req: Request) {
  if (!isServerKey(req.headers.get("x-api-key"))) throw new ApiError(401, "unauthorized", "Missing or invalid server key.");
}

export async function body<T>(req: Request): Promise<Partial<T>> {
  const text = await req.text();
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  } catch {}
  throw new ApiError(400, "bad_json", "The request body must be a JSON object.");
}
