import { handle, json, member } from "@/lib/api/http";
import { loadSession } from "@/lib/api/service";

/** The conversation and the packet for its current phase. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { caseData, member: m, owner } = member(req);
  const { id } = await ctx.params;
  return json(await loadSession(caseData, m, owner, id));
});
