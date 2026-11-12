import { ApiError, body, handle, json, member } from "@/lib/api/http";
import { store } from "@/lib/store/store";

/** Body: { note?: string, done?: boolean } */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { owner } = member(req);
  const { id } = await ctx.params;
  const b = await body<{ note: string; done: boolean }>(req);
  if (b.note !== undefined && typeof b.note !== "string") throw new ApiError(400, "bad_input", "note must be text.");
  if (b.done !== undefined && typeof b.done !== "boolean") throw new ApiError(400, "bad_input", "done must be a boolean.");
  const g = await store.checkin(owner, id, b.note?.slice(0, 500) ?? null, b.done ?? false);
  if (!g) throw new ApiError(404, "not_found", "No such goal for this person.");
  return json(g);
});
