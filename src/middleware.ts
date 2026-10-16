import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const CRM_COOKIE = "crm_session";
const MGMT_COOKIE = "wwfs_management_session";

// /api/ingest and /api/agents/run (AI agent 打卡) carry their own bearer-token auth (INGEST_TOKEN) for the
// month-end Claude scheduled task — no session cookie available there.
// /no-access is the friendly "你没权限" screen for authenticated-but-unauthorised
// users; it must be public or the rewrite below would loop.
const PUBLIC_PATHS = ["/login", "/api/login", "/api/ingest", "/api/agents/run", "/no-access"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function allowedRoles(): string[] {
  return (process.env.ALLOWED_ROLES || "admin")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(CRM_COOKIE)?.value || req.cookies.get(MGMT_COOKIE)?.value;
  if (!token) return redirectToLogin(req);

  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error("AUTH_SECRET missing");
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));

    // Role gating happens HERE, not in the layout. The page is a React Server
    // Component whose rendered output Next.js serialises into the HTML's RSC
    // payload — so hiding it in the layout still ships its data to the browser.
    // Diverting in middleware means the protected page never runs at all.
    const role = String(payload.role || "member").toLowerCase();
    if (!allowedRoles().includes(role)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/no-access";
      url.search = "";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  } catch {
    return redirectToLogin(req);
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  if (url.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg|manifest.webmanifest|logo.png|robots.txt).*)",
  ],
};
