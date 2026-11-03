import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentAuth, PROMO_FIELDS } from "@/lib/office";

/**
 * POST /api/agents/metrics — Mark / Leo 报当天线上宣发数字（Bearer INGEST_TOKEN），同一天重报覆盖，没报的字段不动。
 * { "agent": "mark", "date": "2026-11-03", "posts": 6, "impressions": 12000, "followers": 40, "dms": 12, "leads": 3, "signups": 0 }
 */
export async function POST(req: NextRequest) {
  const err = agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: err === "unauthorized" ? 401 : 503 });
  const b = await req.json().catch(() => null);
  const agentKey = String(b?.agent || "").trim().toLowerCase();
  if (!(await db.agent.findUnique({ where: { key: agentKey } }))) return NextResponse.json({ error: "no such agent" }, { status: 404 });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.date || "")) ? String(b.date) : new Date().toISOString().slice(0, 10);
  const data: Record<string, number> = {};
  for (const f of PROMO_FIELDS) {
    const v = b?.[f.key];
    if (v !== undefined && v !== null && Number.isFinite(Number(v))) data[f.key] = Math.round(Number(v));
  }
  const row = await db.promoDaily.upsert({ where: { agentKey_date: { agentKey, date } }, update: data, create: { agentKey, date, ...data } });
  return NextResponse.json({ ok: true, row });
}
