import { ApiError, handle, json, member } from "@/lib/api/http";
import { lookup } from "@/lib/engine/lookup";
import { topicById, TOPICS, type TopicId } from "@/lib/engine/topics";

/** Facts from the plan for one topic, for questions the current phase does not cover. */
export const GET = handle(async (req: Request) => {
  const { caseData } = member(req);
  const topic = new URL(req.url).searchParams.get("topic") ?? "";
  if (!topicById(topic)) throw new ApiError(400, "unknown_topic", `topic must be one of: ${TOPICS.map((t) => t.id).join(", ")}.`);
  return json(lookup(caseData, topic as TopicId));
});
