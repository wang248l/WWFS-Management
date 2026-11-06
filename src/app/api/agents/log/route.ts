import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentKeyOk } from "@/lib/agentKeys";

const STATUS = new Set(["ok", "fail", "run"]);
const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : v == null ? "" : String(v).slice(0, n));
const opt = (v: unknown, n: number) => (v == null || v === "" ? null : str(v, n));

/**
 * POST /api/agents/log { entries: [...] } —— Mac 的 ailog 直接推过来（配对钥匙，2026-11-06）。按 Mac 的 id upsert，重推不会重复。
 * 一次最多 500 条；只留最近 30 天。
 */
export async function POST(req: NextRequest) {
  if (!(await agentKeyOk(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { entries?: Record<string, unknown>[] } | null;
  const entries = Array.isArray(body?.entries) ? body!.entries.slice(0, 500) : [];
  let saved = 0;
  for (const e of entries) {
    const id = str(e.id, 64);
    const ts = new Date(str(e.ts, 40));
    if (!id || Number.isNaN(ts.getTime())) continue;
    const data = {
      ts,
      source: str(e.source, 160),
      status: STATUS.has(str(e.status, 8)) ? str(e.status, 8) : "run",
      task: str(e.task, 40) || "其他",
      ip: str(e.ip, 60) || "-",
      platform: str(e.platform, 40) || "-",
      video: str(e.video, 300),
      msg: str(e.msg, 600),
      where: opt(e.where, 600),
      why: opt(e.why, 600),
      fix: opt(e.fix, 600),
    };
    await db.aiLogEntry.upsert({ where: { id }, update: data, create: { id, ...data } });
    saved++;
  }
  await db.aiLogEntry.deleteMany({ where: { ts: { lt: new Date(Date.now() - 30 * 86400_000) } } });
  return NextResponse.json({ ok: true, saved });
}
