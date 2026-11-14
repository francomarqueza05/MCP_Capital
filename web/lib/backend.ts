// Where the Cordada API lives (separate repo: MCP_Capital_Backend). Set NEXT_PUBLIC_API_URL.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787").replace(/\/$/, "");

export type DemoHousehold = { id: string; family: string; place: string; score: number; members: { id: string; name: string; token: string }[] };

/** The four Sherpas cases with a personal link token per member (demo mode of the API). */
export async function demoHouseholds(): Promise<DemoHousehold[]> {
  return fetch(`${API_URL}/v1/demo/households`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
}
