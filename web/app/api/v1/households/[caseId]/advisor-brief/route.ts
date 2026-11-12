import { ApiError, handle, json, server } from "@/lib/api/http";
import { advisorBrief } from "@/lib/api/service";
import { getCase } from "@/lib/cases/load";

/** What the advisor should know before the meeting. Requires the server key (x-api-key). */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ caseId: string }> }) => {
  server(req);
  const { caseId } = await ctx.params;
  const c = getCase(caseId);
  if (!c) throw new ApiError(404, "not_found", "No such household.");
  return json(await advisorBrief(c));
});
