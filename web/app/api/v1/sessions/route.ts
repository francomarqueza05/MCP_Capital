import { ApiError, body, handle, json, member } from "@/lib/api/http";
import { openSession } from "@/lib/api/service";

/** Open a conversation for the member behind the token. Body: { lang?: "es" | "en" } (Spanish by default). */
export const POST = handle(async (req: Request) => {
  const { caseData, member: m, owner } = member(req);
  const b = await body<{ lang: string }>(req);
  const lang = b.lang === undefined ? undefined : b.lang === "es" || b.lang === "en" ? b.lang : null;
  if (lang === null) throw new ApiError(400, "bad_input", "lang must be es or en.");
  return json(await openSession(caseData, m, owner, lang), 201);
});
