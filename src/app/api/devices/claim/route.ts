import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentKeyId } from "@/lib/agentKeys";

/** POST /api/devices/claim { id }（Bearer 机器钥匙）—— 领一条排队的任务，标成 running。只能领自己这台的。 */
export async function POST(req: NextRequest) {
  const keyId = await agentKeyId(req);
  if (!keyId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const id = String(b?.id || "").trim().toLowerCase();
  const dev = await db.device.findUnique({ where: { id } });
  if (!dev || (dev.agentKeyId && dev.agentKeyId !== keyId)) return NextResponse.json({ error: "not your device" }, { status: 403 });
  const job = await db.deviceJob.findFirst({ where: { deviceId: id, status: "queued" }, orderBy: { createdAt: "asc" } });
  if (!job) return NextResponse.json({ job: null });
  const r = await db.deviceJob.updateMany({ where: { id: job.id, status: "queued" }, data: { status: "running", startedAt: new Date() } });
  if (!r.count) return NextResponse.json({ job: null });
  return NextResponse.json({ job: { id: job.id, prompt: job.prompt, mode: job.mode } });
}
