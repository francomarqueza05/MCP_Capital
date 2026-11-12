import { body, handle, json, member } from "@/lib/api/http";
import { openSession } from "@/lib/api/service";

/** Open a conversation for the member behind the token. Carries over what was learnt last time. */
export const POST = handle(async (req: Request) => {
  const { caseData, member: m, owner } = member(req);
  await body(req);
  return json(await openSession(caseData, m, owner), 201);
});
