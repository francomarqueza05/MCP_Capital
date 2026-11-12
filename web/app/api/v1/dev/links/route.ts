import { ApiError, handle, json } from "@/lib/api/http";
import { issueToken } from "@/lib/auth/token";
import { caseIds, getCase } from "@/lib/cases/load";

/** Development only: a personal link per member of every household. */
export const GET = handle(async (req: Request) => {
  if (process.env.NODE_ENV === "production") throw new ApiError(404, "not_found", "Not found.");
  const origin = new URL(req.url).origin;
  return json(
    caseIds().flatMap((id) =>
      getCase(id)!.members.map((m) => {
        const token = issueToken({ caseId: id, memberId: m.id });
        return { household: id, member: m.name, token, call: `${origin}/call/${id}?t=${token}` };
      }),
    ),
  );
});
