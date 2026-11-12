import { handle, json, member } from "@/lib/api/http";
import { nextStep } from "@/lib/api/service";

/** The one thing to do next: the open goal, otherwise the plan's next recommendation. */
export const GET = handle(async (req: Request) => {
  const { caseData, owner } = member(req);
  return json(await nextStep(caseData, owner));
});
