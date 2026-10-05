// Searches the association's MCP server (HadeethEnc and QuranEnc through `search`) for the words
// and conduct of each candidate Mawqif situation, one request at a time, 2 s apart. Prints result
// ids and titles only, for docs/MAWQIF_COVERAGE.md; the texts themselves are fetched later by
// fetch-content.mjs from the situations that cite them.

import { request } from "./common.mjs";

const ENDPOINT = "https://mcp.islamiccontent.org/mcp";
const GAP_MS = 2000;
const PROTOCOL = "2025-06-18";

const QUERIES = [
  ["greeting", "hadith", "السلام عليكم فرد عليه ثم جلس فقال النبي عشر"],
  ["greeting", "hadith", "أي الإسلام خير قال تطعم الطعام وتقرأ السلام على من عرفت ومن لم تعرف"],
  ["greeting", "hadith", "يسلم الصغير على الكبير والمار على القاعد"],
  ["sleep", "hadith", "إذا أتيت مضجعك فتوضأ وضوءك للصلاة"],
  ["sleep", "hadith", "الحمد لله الذي أحيانا بعد ما أماتنا وإليه النشور"],
  ["fasting", "hadith", "إذا أقبل الليل وأدبر النهار وغربت الشمس فقد أفطر الصائم"],
  ["fasting", "hadith", "من نسي وهو صائم فأكل أو شرب فليتم صومه"],
  ["condolence", "quran", "إنا لله وإنا إليه راجعون"],
]

let nextId = 0;

async function rpc(method, params, { notification = false } = {}) {
  const message = notification ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id: ++nextId, method, params };
  const response = await request(ENDPOINT, {
    gapMs: GAP_MS,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": PROTOCOL, "User-Agent": "Rehla content check (Thakaa Flow)" },
      body: JSON.stringify(message),
    },
  });
  const body = await response.text();
  if (notification) return null;
  const messages = body.trimStart().startsWith("{")
    ? [JSON.parse(body)]
    : body.split("\n").filter((line) => line.startsWith("data:")).map((line) => JSON.parse(line.slice(5)));
  const reply = messages.find((candidate) => candidate.id === message.id);
  if (!reply || reply.error) throw new Error(`${method}: ${reply?.error?.message ?? "no reply"}`);
  return reply.result;
}

await rpc("initialize", { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "rehla-mawqif-search", version: "1.0.0" } });
await rpc("notifications/initialized", {}, { notification: true });

for (const [topic, source, query] of QUERIES) {
  try {
    const result = await rpc("tools/call", { name: "search", arguments: { query, language: "ar", sources: [source], limit: 4 } });
    const text = (result.content ?? []).filter((block) => block.type === "text").map((block) => block.text).join("\n");
    let hits = [];
    try {
      const parsed = JSON.parse(text);
      hits = (parsed.results ?? parsed).map((hit) => `${hit.id} | ${String(hit.title ?? "").slice(0, 110)}`);
    } catch {
      hits = text.split("\n").filter((line) => /hadith:|quran:/.test(line)).slice(0, 6);
    }
    console.log(`\n== ${topic} [${source}] ${query}\n${hits.slice(0, 4).join("\n") || text.slice(0, 400)}`);
  } catch (error) {
    console.log(`\n== ${topic} [${source}] ${query}\nFAILED: ${error.message}`);
  }
}
