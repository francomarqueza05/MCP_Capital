// Layer 3 of the context: an answer to an off-script question, built from the plan by code.
import type { CaseData } from "../cases/load";
import { spoken } from "./format";
import { topicById, topicFacts, topicNotes, type TopicId } from "./topics";

export function lookup(c: CaseData, id: TopicId) {
  const t = topicById(id)!;
  return {
    topic: t.id,
    label: t.label,
    facts: topicFacts(c, id).map(spoken),
    planSays: topicNotes(c, id),
    analogy: t.analogy,
    rules: c.rules,
  };
}
