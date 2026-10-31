import { NextRequest, NextResponse } from "next/server";

const RESOURCE_DETAIL = /^\/resources\/([^/]+)$/;

/**
 * Returns a real HTTP 404 status for resource detail routes that the signed-in
 * user cannot see (missing, archived, or otherwise not visible). The decision
 * reuses the resource API's own authorization logic, so inaccessible resources
 * are indistinguishable from missing ones. The page body is the standard
 * not-found UI served through a rewrite so the branded 404 page is preserved.
 */
export async function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(RESOURCE_DETAIL);
  if (!match) return NextResponse.next();

  const cookie = request.headers.get("cookie");
  let upstream: Response;
  try {
    upstream = await fetch(
      new URL(`/api/resources/${encodeURIComponent(match[1])}`, request.nextUrl.origin),
      {
        headers: cookie ? { cookie } : undefined,
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.next();
  }

  if (upstream.status === 404) {
    return NextResponse.rewrite(new URL("/not-found-view", request.nextUrl.origin), {
      status: 404,
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/resources/:id"],
};
