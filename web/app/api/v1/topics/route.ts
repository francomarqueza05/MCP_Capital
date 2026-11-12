import { json } from "@/lib/api/http";
import { TOPICS } from "@/lib/engine/topics";

/** The closed list of topics lookup can answer. */
export function GET() {
  return json(TOPICS.map((t) => ({ id: t.id, label: t.label })));
}
