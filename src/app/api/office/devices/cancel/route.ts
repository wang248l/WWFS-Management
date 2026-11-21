import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** POST /api/office/devices/cancel { jobId }（登录态）—— 取消排队或正在跑的任务；正在跑的由 agent 下次回报时停掉。 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const r = await db.deviceJob.updateMany({
    where: { id: String(b?.jobId || ""), status: { in: ["queued", "running"] } },
    data: { status: "cancelled", finishedAt: new Date() },
  });
  return NextResponse.json({ ok: !!r.count });
}
