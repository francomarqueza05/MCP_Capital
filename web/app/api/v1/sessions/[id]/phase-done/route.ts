import { ApiError, body, handle, json, member } from "@/lib/api/http";
import { phaseDone } from "@/lib/api/service";
import type { DoneInput } from "@/lib/engine/engine";

/**
 * The guide reports the phase is over. The engine, not the model, picks what comes next:
 * the same phase in more depth, or the next phase.
 * Body: { understood?: boolean, emotion?: string, wantsMore?: boolean,
 *         answers?: { worry?: string, level?: string, accepted?: boolean } }
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { caseData, member: m, owner } = member(req);
  const { id } = await ctx.params;
  const b = await body<DoneInput>(req);
  const a = b.answers ?? {};
  const bad =
    (b.understood !== undefined && typeof b.understood !== "boolean") ||
    (b.wantsMore !== undefined && typeof b.wantsMore !== "boolean") ||
    (b.emotion !== undefined && typeof b.emotion !== "string") ||
    (typeof a !== "object" || a === null) ||
    (a.worry !== undefined && typeof a.worry !== "string") ||
    (a.level !== undefined && typeof a.level !== "string") ||
    (a.accepted !== undefined && typeof a.accepted !== "boolean");
  if (bad)
    throw new ApiError(400, "bad_input", "understood and wantsMore are booleans; emotion, answers.worry and answers.level are text; answers.accepted is a boolean.");
  return json(await phaseDone(caseData, m, owner, id, b as DoneInput));
});
