import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha } from "@/lib/agentKeys";

/** POST /api/pair/poll { code, poll } —— 机器来问批了没；批了就把钥匙给它一次，然后清掉明文。 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const r = await db.pairRequest.findUnique({ where: { id: String(b?.code || "") } });
  if (!r || r.pollHash !== sha(String(b?.poll || ""))) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!r.approvedAt) return NextResponse.json({ status: "pending" });
  if (!r.keyPlain) return NextResponse.json({ status: "fetched" }, { status: 410 });
  await db.pairRequest.update({ where: { id: r.id }, data: { keyPlain: null, fetchedAt: new Date() } });
  return NextResponse.json({ status: "approved", key: r.keyPlain });
}
