import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canAccess, getCurrentUser } from "@/lib/auth";
import { isValidPeriod } from "@/lib/metrics";

/**
 * POST /api/values — manual single-value upsert from the 数据录入 page.
 * Requires an authorised session (ALLOWED_ROLES). Setting value to null/empty
 * deletes the row for that (metric, period).
 *
 * Body: { metricKey: string, period: "YYYY-MM", value: number|null, note?: string }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccess(user?.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const metricKey = String(body?.metricKey || "");
  const period = String(body?.period || "");
  if (!isValidPeriod(period)) {
    return NextResponse.json({ error: "period must be 'YYYY-MM'" }, { status: 400 });
  }

  const metric = await db.metric.findUnique({ where: { key: metricKey }, select: { id: true } });
  if (!metric) {
    return NextResponse.json({ error: "unknown metric key" }, { status: 400 });
  }

  const raw = body?.value;
  const note = body?.note ? String(body.note) : null;

  // Empty / null → delete the reading for this period.
  if (raw === null || raw === undefined || raw === "") {
    await db.metricValue
      .delete({ where: { metricId_period: { metricId: metric.id, period } } })
      .catch(() => null); // ignore "record not found"
    return NextResponse.json({ ok: true, deleted: true });
  }

  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: "value must be a number" }, { status: 400 });
  }

  await db.metricValue.upsert({
    where: { metricId_period: { metricId: metric.id, period } },
    update: { value: num, source: "manual", note },
    create: { metricId: metric.id, period, value: num, source: "manual", note },
  });

  return NextResponse.json({ ok: true });
}
