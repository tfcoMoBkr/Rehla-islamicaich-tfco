import { deleteAccountFor } from "@/lib/account/admin";

export const dynamic = "force-dynamic";

const STATUS = { deleted: 204, unauthorized: 401, unavailable: 503 } as const;

/**
 * Deletes the signed-in learner's account and all its data. The session token comes in the
 * Authorization header (never a cookie), so another site cannot make the browser send it.
 */
export async function POST(request: Request) {
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  const outcome = token ? await deleteAccountFor(token) : "unauthorized";
  return new Response(null, { status: STATUS[outcome], headers: { "cache-control": "no-store" } });
}
