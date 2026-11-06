import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** POST /api/settings/revoke { id } —— 作废一把员工钥匙（登录态 + admin），立刻失效。 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  await db.agentKey.update({ where: { id: String(b?.id || "") }, data: { revokedAt: new Date() } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
