import { handle, json, member } from "@/lib/api/http";

/** Who this link belongs to, for the page header. */
export const GET = handle(async (req: Request) => {
  const { caseData, member: m } = member(req);
  return json({ name: m.name, household: caseData.family, place: caseData.place, members: caseData.members.map((x) => x.name) });
});
