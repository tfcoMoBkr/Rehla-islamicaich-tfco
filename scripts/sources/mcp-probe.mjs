// Probes the official MCP server of the Association for Multilingual Islamic Content
// (https://mcp.islamiccontent.org/mcp, streamable HTTP, no auth) that Rafiq will read Quran and
// hadith texts from live. Lists its tools with their input schemas and times sample calls, one at
// a time and 2 s apart (the server answers 429 to bursts). Writes docs/MCP_TOOLS.md. Nothing
// the server returns is stored except result titles and timings.

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { request, root, today } from "./common.mjs";

const ENDPOINT = "https://mcp.islamiccontent.org/mcp";
const GAP_MS = 2000;
const PROTOCOL = "2025-06-18";

const PROBES = [
  { tool: "search", arguments: { query: "نواقض الوضوء", language: "ar" } },
  { tool: "search", arguments: { query: "nullifiers of ablution", language: "en" } },
  { tool: "search", arguments: { query: "أوقات الصلاة", language: "ar" } },
  { tool: "search", arguments: { query: "times of the prayers", language: "en" } },
  { tool: "get_hadith", arguments: { id: 3064, language: "ar" } },
  { tool: "get_hadith", arguments: { id: 3064, language: "en" } },
  { tool: "get_quran_verses", arguments: { surah: 1, ayah: 1, through: 7, translation_key: "english_saheeh" } },
  { tool: "get_quran_verses", arguments: { surah: 1, ayah: 1, through: 7, translation_key: "arabic_moyassar" } },
  { tool: "browse_hadith_categories", arguments: { category_id: 445 } },
  { tool: "get_library_item", arguments: { id: 1871 } },
];

let nextId = 0;

/** One JSON-RPC message; the server answers in JSON or as a short event stream. */
async function rpc(method, params, { notification = false } = {}) {
  const message = notification ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id: ++nextId, method, params };
  const started = performance.now();
  const response = await request(ENDPOINT, {
    gapMs: GAP_MS,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": PROTOCOL },
      body: JSON.stringify(message),
    },
  });
  const body = await response.text();
  const ms = Math.round(performance.now() - started);
  if (notification) return { ms };
  const messages = body.trimStart().startsWith("{")
    ? [JSON.parse(body)]
    : body
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => JSON.parse(line.slice(5)));
  const reply = messages.find((candidate) => candidate.id === message.id);
  if (!reply) throw new Error(`${method}: no reply in the response`);
  if (reply.error) throw new Error(`${method}: ${reply.error.message}`);
  return { ms, result: reply.result };
}

const textBlocks = (result) => (result.content ?? []).filter((block) => block.type === "text").map((block) => block.text);

/**
 * What a result is about, without its sacred text: the first `count` titles. Search answers with a
 * JSON block of results; a hadith answers with its title on the first line after the RETRIEVED
 * header; a category lists "[id] title" lines; verses have no title, so only their count is given.
 */
function summary(result, count = 5) {
  const found = [];
  const visit = (value) => {
    if (found.length >= count || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value.title === "string") found.push(value.title);
    Object.values(value).forEach(visit);
  };
  for (const text of textBlocks(result)) {
    try {
      visit(JSON.parse(text));
      continue;
    } catch {
      // Not JSON: a block marked up for a reader.
    }
    // Verses first: their footnotes are numbered "[n]" too, and are not titles.
    const verses = text.match(/^\[\d+:\d+\]$/gm);
    if (verses) return [`${verses.length} verses (${verses[0].slice(1, -1)} to ${verses.at(-1).slice(1, -1)}); texts not reproduced`];
    const listed = [...text.matchAll(/^\s*\[\d+\]\s+(.+)$/gm)].map((match) => match[1].trim());
    if (listed.length > 0) {
      found.push(...listed);
      continue;
    }
    const header = text.match(/RETRIEVED FROM [^\n]*\n+([^\n[]+)/);
    if (header) found.push(header[1].trim());
  }
  return found.slice(0, count);
}

const cell = (text) => String(text).replaceAll("|", "\\|").replaceAll("\n", " ");

export async function probeMcp() {
  const initialize = await rpc("initialize", {
    protocolVersion: PROTOCOL,
    capabilities: {},
    clientInfo: { name: "rehla-mcp-probe", version: "1.0.0" },
  });
  await rpc("notifications/initialized", {}, { notification: true });
  const { result: listed } = await rpc("tools/list", {});

  const results = [];
  for (const probe of PROBES) {
    try {
      const { ms, result } = await rpc("tools/call", { name: probe.tool, arguments: probe.arguments });
      results.push(
        result.isError
          ? { ...probe, ms, ok: false, titles: [], error: textBlocks(result).join(" ") }
          : { ...probe, ms, ok: true, titles: summary(result) },
      );
    } catch (error) {
      results.push({ ...probe, ms: null, ok: false, titles: [], error: error.message });
    }
    console.log(`  ${probe.tool} ${JSON.stringify(probe.arguments)}: ${results.at(-1).ms ?? "-"} ms`);
  }

  const server = initialize.result.serverInfo ?? {};
  const lines = [
    "# MCP tools",
    "",
    `The official MCP server of the Association for Multilingual Islamic Content, which Rafiq reads Quran and hadith texts from live (nothing it returns is stored in this repository). Generated by \`node scripts/fetch-content.mjs --mcp-probe\` on ${today}; calls were made one at a time, ${GAP_MS / 1000} s apart.`,
    "",
    `- Endpoint: <${ENDPOINT}> (streamable HTTP, no authentication)`,
    `- Server: ${server.title ?? server.name ?? "?"} ${server.version ?? ""}, protocol ${initialize.result.protocolVersion}`,
    `- Initialize: ${initialize.ms} ms`,
    "",
    "## Sample calls",
    "",
    "| Tool | Arguments | Latency | Result | Top titles |",
    "| --- | --- | --- | --- | --- |",
    ...results.map(
      (result) =>
        `| \`${result.tool}\` | \`${cell(JSON.stringify(result.arguments))}\` | ${result.ms === null ? "-" : `${result.ms} ms`} | ${result.ok ? "ok" : cell(`failed${result.error ? `: ${result.error}` : ""}`)} | ${result.titles.length ? result.titles.map((title, index) => `${index + 1}. ${cell(title)}`).join("<br>") : "(no titles in the result)"} |`,
    ),
    "",
    "Titles and error messages are quoted as the server returned them. Verse and hadith texts are not reproduced here.",
    "",
    "## Tools",
    "",
  ];
  for (const tool of listed.tools) {
    lines.push(`### \`${tool.name}\``, "", tool.description ?? "", "", "```json", JSON.stringify(tool.inputSchema, null, 2), "```", "");
  }
  await writeFile(path.join(root, "docs", "MCP_TOOLS.md"), lines.join("\n"));
  console.log(`docs/MCP_TOOLS.md: ${listed.tools.length} tools, ${results.filter((result) => result.ok).length}/${results.length} sample calls ok.`);
}
