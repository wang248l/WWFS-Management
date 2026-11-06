import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mint, sha } from "@/lib/agentKeys";

/**
 * POST /api/settings/keys { label } —— 老板在「设置」页给某个员工（比如 Bob 的 Claude project）发一把读写钥匙（登录态 + admin）。
 * 明文只在这次返回里出现一次，库里只存哈希（2026-11-06「钥匙我批量的贴给其他的对话就可以了」）。
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const label = String(b?.label || "").trim().slice(0, 80);
  if (!label) return NextResponse.json({ error: "写一下这把钥匙给谁用" }, { status: 400 });
  const key = mint();
  await db.agentKey.create({ data: { label, tokenHash: sha(key), prefix: key.slice(0, 8) } });
  return NextResponse.json({ ok: true, key });
}
