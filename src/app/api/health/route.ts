import { NextResponse } from "next/server";
import { loadAiLog } from "@/lib/aiLog";
import { setting } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — 不用登录的连通检查，只回布尔值和条数，不回任何内容。
 * 2026-11-06「Mark 的工作记录完全没有在看板里面反映出来」：先要能从外面看出办公室有没有读到 AI 工作日志。
 */
export async function GET() {
  const ai = await loadAiLog();
  const per = Object.fromEntries(Object.entries(ai.byAgent).map(([k, v]) => [k, { entries: v.entries.length, lastAt: v.lastAt, stuck: v.stuck.length }]));
  return NextResponse.json({
    ok: true,
    marketingKey: !!(await setting("MARKETING_API_KEY")),
    aiLog: ai.ok,
    agents: per,
  });
}
