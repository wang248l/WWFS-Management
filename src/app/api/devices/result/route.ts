import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentKeyId } from "@/lib/agentKeys";

/**
 * POST /api/devices/result { jobId, output, exitCode?, done }（Bearer 机器钥匙）
 * 跑的过程中可以多次推（done=false 只更新输出，页面上能看到进度），最后 done=true 收尾。
 * 返回 cancelled=true 表示老板在页面上点了取消，agent 应该停掉 claude。
 */
export async function POST(req: NextRequest) {
  const keyId = await agentKeyId(req);
  if (!keyId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const job = await db.deviceJob.findUnique({ where: { id: String(b?.jobId || "") }, include: { device: true } });
  if (!job || (job.device.agentKeyId && job.device.agentKeyId !== keyId)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const output = String(b?.output ?? "").slice(-100_000);
  if (job.status === "cancelled") {
    if (b?.done) await db.deviceJob.update({ where: { id: job.id }, data: { output, finishedAt: job.finishedAt || new Date() } });
    return NextResponse.json({ ok: true, cancelled: true });
  }
  const done = !!b?.done;
  const exitCode = typeof b?.exitCode === "number" ? b.exitCode : null;
  await db.deviceJob.update({
    where: { id: job.id },
    data: done ? { output, exitCode, status: exitCode === 0 ? "done" : "failed", finishedAt: new Date() } : { output },
  });
  return NextResponse.json({ ok: true, cancelled: false });
}
