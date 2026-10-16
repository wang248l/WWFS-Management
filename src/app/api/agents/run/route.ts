import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/agents/run — AI agent 打卡：每跑完一次（或开始/出错时）报一次。
 *
 * Auth: `Authorization: Bearer <INGEST_TOKEN>`（跟 /api/ingest 同一把；在 middleware PUBLIC_PATHS 里）。
 *
 * Body:
 * {
 *   "agent": "mac",                     // 必填，Agent.key；没登记过的会自动登记，名单页补职责/排程
 *   "task": "同步脚本到 Google Drive",   // 这次干的事
 *   "status": "ok",                      // ok | error | running，默认 ok
 *   "summary": "Amelia 3 条、Ishan 2 条", // 一句话产出
 *   "outputCount": 5,                    // 产出数量
 *   "startedAt": "2026-10-16T13:00:00Z"  // 可选；finishedAt 默认现在（status=running 时为空）
 * }
 */
export async function POST(req: NextRequest) {
  const token = process.env.INGEST_TOKEN;
  if (!token) return NextResponse.json({ error: "disabled (INGEST_TOKEN not set)" }, { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let b: any;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const key = String(b?.agent || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(key)) {
    return NextResponse.json({ error: "agent must be a short key like 'mac' or 'ryzen'" }, { status: 400 });
  }
  const status = ["ok", "error", "running"].includes(b?.status) ? b.status : "ok";
  const startedAt = b?.startedAt && !isNaN(Date.parse(b.startedAt)) ? new Date(b.startedAt) : new Date();
  const outputCount = Number.isFinite(Number(b?.outputCount)) && b?.outputCount !== null && b?.outputCount !== undefined ? Math.round(Number(b.outputCount)) : null;

  const agent = await db.agent.upsert({
    where: { key },
    update: {},
    create: { key, name: String(b?.name || key), duty: "（新 agent，自动登记——去名单页补职责和排程）" },
  });
  const run = await db.agentRun.create({
    data: {
      agentId: agent.id,
      task: b?.task ? String(b.task).slice(0, 200) : null,
      status,
      summary: b?.summary ? String(b.summary).slice(0, 500) : null,
      outputCount,
      startedAt,
      finishedAt: status === "running" ? null : new Date(),
    },
  });
  return NextResponse.json({ ok: true, agent: agent.key, runId: run.id });
}
