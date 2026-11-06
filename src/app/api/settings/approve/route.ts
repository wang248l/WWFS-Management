import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mint, sha } from "@/lib/agentKeys";

/** POST /api/settings/approve { code } —— 老板在「设置」页点批准（登录态 + admin）：发一把读写钥匙给这台机器。 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const r = await db.pairRequest.findUnique({ where: { id: String(b?.code || "") } });
  if (!r || r.approvedAt) return NextResponse.json({ error: "没有这个待批的配对" }, { status: 404 });
  const key = mint();
  await db.agentKey.create({ data: { label: r.label, tokenHash: sha(key), prefix: key.slice(0, 8) } });
  await db.pairRequest.update({ where: { id: r.id }, data: { approvedAt: new Date(), keyPlain: key } });
  return NextResponse.json({ ok: true });
}
