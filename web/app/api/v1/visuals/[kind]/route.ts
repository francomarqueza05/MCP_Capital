import { ApiError, handle, json, member } from "@/lib/api/http";

/** Data for the on-screen visuals, prepared from the plan so the browser draws, never computes. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ kind: string }> }) => {
  const { caseData } = member(req);
  const { kind } = await ctx.params;
  if (kind === "ridge") return json({ yearly: caseData.yearly, goals: caseData.goals, runOutAge: caseData.runOutAge });
  if (kind === "score") return json({ score: caseData.score, pillars: caseData.pillars });
  throw new ApiError(404, "unknown_visual", "Visuals available: ridge, score.");
});
