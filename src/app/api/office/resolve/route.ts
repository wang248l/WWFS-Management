import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** POST /api/office/resolve { id } — 老板把 agent 的「卡住 / 请求开会」标成已处理（登录态）。 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const m = await db.agentMessage.update({ where: { id: String(b?.id || "") }, data: { resolvedAt: new Date() } }).catch(() => null);
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
