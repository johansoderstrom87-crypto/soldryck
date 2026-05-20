import type { NextRequest } from "next/server";

/**
 * Returns true if the request carries valid Basic Auth credentials matching
 * the ADMIN_PASSWORD env var. User part is always "admin". Used by API routes
 * to gate methods that the proxy can't easily distinguish (e.g. GET on a
 * route that also has a public POST). The proxy already handles auth for
 * /admin/* pages and /api/admin/*.
 */
export function isAdminRequest(req: NextRequest): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Basic ")) return false;
  const expected = `Basic ${btoa(`admin:${password}`)}`;
  return auth === expected;
}

export function unauthorizedResponse(): Response {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Soldryck Admin", charset="UTF-8"',
    },
  });
}
