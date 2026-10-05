import { callAiService, clientAddress, isAiRoute, AI_ROUTES } from "@/lib/ai-proxy";

// Rafiq can take up to the proxy's 90 s budget to answer; the function may run as long.
export const maxDuration = 90;
export const dynamic = "force-dynamic";

const PASSED_HEADERS = ["content-type", "retry-after", "cache-control"];

async function forward(request: Request, path: string, method: "GET" | "POST"): Promise<Response> {
  if (!isAiRoute(path) || AI_ROUTES[path] !== method) {
    return Response.json({ error: { code: "not_found" } }, { status: 404 });
  }
  let upstream: Response;
  try {
    upstream = await callAiService(path, {
      body: method === "POST" ? request.body : undefined,
      contentType: request.headers.get("content-type"),
      client: clientAddress(request),
      signal: request.signal,
    });
  } catch {
    // Unreachable, or past the time budget: the page shows Rafiq as unavailable.
    return Response.json({ error: { code: "unavailable" } }, { status: 503 });
  }
  const headers = new Headers();
  for (const name of PASSED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  // The reply is streamed through as it arrives, never buffered here.
  return new Response(upstream.body, { status: upstream.status, headers });
}

export async function POST(request: Request, { params }: RouteContext<"/api/ai/[path]">) {
  return forward(request, (await params).path, "POST");
}

export async function GET(request: Request, { params }: RouteContext<"/api/ai/[path]">) {
  return forward(request, (await params).path, "GET");
}
