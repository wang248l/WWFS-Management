import { NextRequest, NextResponse } from "next/server";
import { resolveIssue } from "@/lib/aiLog";

/** POST /api/office/resolve-issue { id } —— 老板点「标记已解决」（登录态 + admin，middleware 把关）。 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const ok = await resolveIssue(String(b?.id || ""), "owner");
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
