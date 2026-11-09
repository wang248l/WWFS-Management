import { NextRequest, NextResponse } from "next/server";
import { agentAuth } from "@/lib/office";
import { resolveIssue } from "@/lib/aiLog";

/** POST /api/agents/resolve { id }（Bearer 钥匙）—— agent 复查确认好了，把这条问题标记已解决。 */
export async function POST(req: NextRequest) {
  const err = await agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: 401 });
  const b = await req.json().catch(() => null);
  const ok = await resolveIssue(String(b?.id || ""), "agent");
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
