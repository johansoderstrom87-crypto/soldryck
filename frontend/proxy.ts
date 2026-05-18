import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return new NextResponse(
      "Admin disabled — set ADMIN_PASSWORD env to enable.",
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  const expected = `Basic ${btoa(`admin:${password}`)}`;
  if (auth !== expected) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Soldryck Admin", charset="UTF-8"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  // Match /admin/claims (and sub-paths) and /api/admin/*.
  // Leave the existing /admin (feedback page with ?key=...) untouched.
  matcher: ["/admin/claims/:path*", "/api/admin/:path*"],
};
