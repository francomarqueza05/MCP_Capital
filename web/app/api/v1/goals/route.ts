import { ApiError, body, handle, json, member } from "@/lib/api/http";
import { store } from "@/lib/store/store";

export const GET = handle(async (req: Request) => {
  const { owner } = member(req);
  return json(await store.listGoals(owner));
});

/** Body: { title: string, detail?: string, due?: "YYYY-MM-DD" } */
export const POST = handle(async (req: Request) => {
  const { owner } = member(req);
  const b = await body<{ title: string; detail: string; due: string }>(req);
  if (typeof b.title !== "string" || !b.title.trim() || b.title.length > 140) throw new ApiError(400, "bad_input", "title is required, up to 140 characters.");
  if (b.due !== undefined && (typeof b.due !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.due))) throw new ApiError(400, "bad_input", "due must be a date as YYYY-MM-DD.");
  if (b.detail !== undefined && typeof b.detail !== "string") throw new ApiError(400, "bad_input", "detail must be text.");
  return json(await store.createGoal(owner, { title: b.title.trim(), detail: (b.detail ?? "").slice(0, 1000), due: b.due ?? null }), 201);
});
