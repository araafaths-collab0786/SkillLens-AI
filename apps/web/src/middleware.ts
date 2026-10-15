/**
 * SkillLens AI — Route middleware
 *
 * Protects /dashboard, /resume, /match, /gap-analysis.
 * Unauthenticated users are redirected to /login?next=<path>.
 *
 * ?next= validation:
 * - Accepts only relative paths starting with "/"
 * - Must be on the ALLOWED_NEXT_PATHS allowlist
 * - Rejects "//", absolute URLs, backslashes, and encoded variants
 * - Prevents open-redirect attacks
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/resume", "/match", "/gap-analysis"];

/**
 * Allowlist of valid ?next= redirect targets.
 * Only same-origin relative paths that start with "/" and are in this list.
 */
const ALLOWED_NEXT_PATHS = new Set([
  "/dashboard",
  "/resume",
  "/match",
  "/gap-analysis",
]);

function isValidNextPath(next: string | null): boolean {
  if (!next) return false;

  // Reject empty, absolute URLs, protocol-relative, backslashes, encoded variants
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\") ||
    next.includes("%2F%2F") ||  // encoded //
    next.includes("%5C") ||      // encoded backslash
    /^\/\//.test(decodeURIComponent(next)) ||
    /^https?:\/\//i.test(next)
  ) {
    return false;
  }

  // Strip query params before allowlist check
  const pathOnly = next.split("?")[0].split("#")[0];
  return ALLOWED_NEXT_PATHS.has(pathOnly);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for auth cookie (httpOnly — we check its presence, not content)
  // Full JWT validation happens on the API. Middleware just gates routing.
  const hasAuthCookie = request.cookies.has("access_token");

  if (!hasAuthCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/resume/:path*", "/match/:path*", "/gap-analysis/:path*"],
};
