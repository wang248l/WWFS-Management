import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentKeyId } from "@/lib/agentKeys";
import { KNOWN_HOSTS } from "@/lib/devices";

/**
 * POST /api/devices/heartbeat（Bearer 机器钥匙）—— device_agent 每 30 秒报到一次。
 * { id, name?, os, phones:[{serial,state,model}], claude, agent, cwd }
 * 返回这台机器有没有排队的任务（有就马上来 /api/devices/claim 领）。
 */
export async function POST(req: NextRequest) {
  const keyId = await agentKeyId(req);
  if (!keyId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const id = String(b?.id || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 64);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const phones = Array.isArray(b?.phones)
    ? b.phones.slice(0, 20).map((p: any) => ({ serial: String(p?.serial || "").slice(0, 64), state: String(p?.state || "").slice(0, 32), model: String(p?.model || "").slice(0, 64) }))
    : [];
  const info = JSON.stringify({
    phones,
    claude: String(b?.claude || "").slice(0, 80),
    agent: String(b?.agent || "").slice(0, 40),
    cwd: String(b?.cwd || "").slice(0, 200),
    host: String(b?.host || "").slice(0, 80),
    error: b?.error ? String(b.error).slice(0, 300) : undefined,
  });
  const existing = await db.device.findUnique({ where: { id } });
  // 显示名：已有的保留（以后页面上可以改）；第一次用已知叫法，没有就用 agent 报的
  const name = existing?.name || KNOWN_HOSTS[id] || String(b?.name || b?.host || id).slice(0, 60);
  await db.device.upsert({
    where: { id },
    update: { os: String(b?.os || "").slice(0, 20), info, agentKeyId: keyId, lastSeenAt: new Date() },
    create: { id, name, os: String(b?.os || "").slice(0, 20), info, agentKeyId: keyId },
  });
  const queued = await db.deviceJob.count({ where: { deviceId: id, status: "queued" } });
  return NextResponse.json({ ok: true, queued });
}
