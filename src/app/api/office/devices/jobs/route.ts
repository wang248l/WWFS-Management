import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { JOB_MODES } from "@/lib/devices";

/** POST /api/office/devices/jobs { deviceId, prompt, mode }（登录态 + admin，中间件管）—— 派一条 Claude 任务给某台电脑。 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const b = await req.json().catch(() => null);
  const deviceId = String(b?.deviceId || "");
  const prompt = String(b?.prompt || "").trim().slice(0, 20_000);
  const mode = (JOB_MODES as readonly string[]).includes(b?.mode) ? String(b.mode) : "auto";
  if (!prompt) return NextResponse.json({ error: "写一下要它做什么" }, { status: 400 });
  if (!(await db.device.findUnique({ where: { id: deviceId } }))) return NextResponse.json({ error: "没有这台电脑" }, { status: 404 });
  const job = await db.deviceJob.create({ data: { deviceId, prompt, mode, createdBy: user?.displayName || user?.username || "" } });
  return NextResponse.json({ ok: true, id: job.id });
}
