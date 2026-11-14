// Where the Cordada API lives (separate repo: MCP_Capital_Backend). Set NEXT_PUBLIC_API_URL.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787").replace(/\/$/, "");
