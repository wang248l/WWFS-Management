import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { sha } from "@/lib/agentKeys";

/**
 * POST /api/pair/request { label, poll } —— 机器来登记配对（不用登录）。poll 是机器自己生成的随机口令，只存哈希。
 * 返回 6 位短码；老板在「设置」页看到同一个短码，点批准。每小时最多 5 个待批，过期 1 小时。
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const label = String(b?.label || "").trim().slice(0, 80);
  const poll = String(b?.poll || "");
  if (!label || poll.length < 32) return NextResponse.json({ error: "label and poll required" }, { status: 400 });
  const hourAgo = new Date(Date.now() - 3600_000);
  await db.pairRequest.deleteMany({ where: { createdAt: { lt: hourAgo }, fetchedAt: null } });
  if ((await db.pairRequest.count({ where: { approvedAt: null } })) >= 5) return NextResponse.json({ error: "too many pending" }, { status: 429 });
  const code = String(randomInt(100000, 999999));
  await db.pairRequest.create({ data: { id: code, label, pollHash: sha(poll) } });
  return NextResponse.json({ ok: true, code });
}
