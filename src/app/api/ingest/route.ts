import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidPeriod } from "@/lib/metrics";

/**
 * POST /api/ingest — bulk upsert metric values for a period.
 *
 * Auth: `Authorization: Bearer <INGEST_TOKEN>`. Used by the month-end Claude
 * scheduled task that scrapes platform metrics (流量/私信/粉丝...) and pushes
 * them here. Carries its own auth (no session cookie); listed in middleware
 * PUBLIC_PATHS.
 *
 * Body:
 * {
 *   "period": "2026-06",
 *   "source": "cron",                       // optional, default "cron"
 *   "values": [
 *     { "key": "traffic", "value": 128000 },
 *     { "key": "dm_count", "value": 342, "note": "小红书 210 / 抖音 132" }
 *   ]
 * }
 *
 * Unknown metric keys are skipped and reported back in `skipped` so a typo in
 * the scraper doesn't silently lose data.
 */
export async function POST(req: NextRequest) {
  const token = process.env.INGEST_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "ingest disabled (INGEST_TOKEN not set)" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const period = String(body?.period || "");
  if (!isValidPeriod(period)) {
    return NextResponse.json({ error: "period must be 'YYYY-MM'" }, { status: 400 });
  }
  const source = typeof body?.source === "string" && body.source ? body.source : "cron";
  const values = Array.isArray(body?.values) ? body.values : null;
  if (!values) {
    return NextResponse.json({ error: "values must be an array" }, { status: 400 });
  }

  const metrics = await db.metric.findMany({ select: { id: true, key: true } });
  const byKey = new Map(metrics.map((m) => [m.key, m.id]));

  const written: string[] = [];
  const skipped: { key: string; reason: string }[] = [];

  for (const v of values) {
    const key = String(v?.key || "");
    const num = Number(v?.value);
    if (!byKey.has(key)) {
      skipped.push({ key, reason: "unknown metric key" });
      continue;
    }
    if (!Number.isFinite(num)) {
      skipped.push({ key, reason: "value is not a finite number" });
      continue;
    }
    const metricId = byKey.get(key)!;
    await db.metricValue.upsert({
      where: { metricId_period: { metricId, period } },
      update: { value: num, source, note: v?.note ? String(v.note) : null },
      create: { metricId, period, value: num, source, note: v?.note ? String(v.note) : null },
    });
    written.push(key);
  }

  return NextResponse.json({ ok: true, period, written, skipped });
}
