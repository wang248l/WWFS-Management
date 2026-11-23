import { NextRequest, NextResponse } from "next/server";
import { agentAuth } from "@/lib/office";
import { getSph, normAccount, saveSph, SPH_STATUSES, type SphState, type SphStatus } from "@/lib/sph";

export const dynamic = "force-dynamic";

/**
 * Omen PC 推视频号助手登录状态 + 二维码（Bearer agent 钥匙 / INGEST_TOKEN）。
 *
 * POST /api/agents/sph
 *   { "account": "wallace", "status": "need_scan", "qr": "<PNG base64 或 data:image/png;base64,...>", "note": "...", "host": "DESKTOP-MBG4J11" }
 *   { "account": "wallace", "status": "logged_in" }               // 扫码成功 / 每次发布前确认还登着
 *   { "account": "wallace", "status": "expired" | "error", "note": "..." }
 *   - status=need_scan 必须带 qr；登录成功后二维码自动清掉。
 *   - loggedInAt 可选（ISO 时间），不传就用服务器当前时间；已经是今天登录的，重复推 logged_in 不会改登录时间。
 *
 * GET /api/agents/sph?account=wallace
 *   → { status, loggedInAt, qrAt, refreshRequested: true|false, refreshRequestedAt }
 *   refreshRequested=true 表示 Wallace 在首页点了「换一张二维码」，脚本应重新截图推一次（推 need_scan 后自动清掉）。
 */
export async function POST(req: NextRequest) {
  const err = await agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return NextResponse.json({ error: "json body required" }, { status: 400 });
  const account = normAccount(b.account);
  if (!account) return NextResponse.json({ error: "bad account" }, { status: 400 });
  const status = String(b.status || "") as SphStatus;
  if (!SPH_STATUSES.includes(status)) return NextResponse.json({ error: `status must be one of ${SPH_STATUSES.join("|")}` }, { status: 400 });

  let qr: string | null = null;
  let qrMime = "image/png";
  if (b.qr) {
    const m = /^data:(image\/(?:png|jpeg|webp));base64,(.*)$/s.exec(String(b.qr));
    qr = (m ? m[2] : String(b.qr)).replace(/\s+/g, "");
    if (m) qrMime = m[1];
    if (!/^[A-Za-z0-9+/=]+$/.test(qr)) return NextResponse.json({ error: "qr must be base64" }, { status: 400 });
    if (qr.length > 1_400_000) return NextResponse.json({ error: "qr too large (max ~1MB)" }, { status: 413 });
    if (!m) {
      const head = Buffer.from(qr.slice(0, 16), "base64");
      if (head[0] === 0xff && head[1] === 0xd8) qrMime = "image/jpeg";
      else if (head.slice(8, 12).toString() === "WEBP") qrMime = "image/webp";
    }
  }
  if (status === "need_scan" && !qr) return NextResponse.json({ error: "need_scan requires qr" }, { status: 400 });

  const prev = await getSph(account);
  const now = new Date().toISOString();
  let loggedInAt = prev?.loggedInAt ?? null;
  if (status === "logged_in") {
    const given = b.loggedInAt && !isNaN(Date.parse(b.loggedInAt)) ? new Date(b.loggedInAt).toISOString() : null;
    // 已经是 logged_in 的就保留第一次登录时间（只是 Omen 例行确认），除非显式给了时间
    loggedInAt = given || (prev?.status === "logged_in" && prev.loggedInAt ? prev.loggedInAt : now);
  }
  const next: SphState = {
    account,
    status,
    qr: status === "need_scan" ? qr : null,
    qrMime: status === "need_scan" ? qrMime : prev?.qrMime || "image/png",
    qrAt: status === "need_scan" ? now : null,
    loggedInAt,
    note: b.note ? String(b.note).slice(0, 500) : null,
    host: b.host ? String(b.host).slice(0, 80) : prev?.host ?? null,
    updatedAt: now,
    refreshRequestedAt: status === "need_scan" || status === "logged_in" ? null : prev?.refreshRequestedAt ?? null,
  };
  await saveSph(next);
  return NextResponse.json({ ok: true, account, status, loggedInAt });
}

export async function GET(req: NextRequest) {
  const err = await agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: 401 });
  const account = normAccount(req.nextUrl.searchParams.get("account"));
  if (!account) return NextResponse.json({ error: "bad account" }, { status: 400 });
  const s = await getSph(account);
  return NextResponse.json({
    account,
    status: s?.status ?? null,
    loggedInAt: s?.loggedInAt ?? null,
    qrAt: s?.qrAt ?? null,
    refreshRequested: !!s?.refreshRequestedAt,
    refreshRequestedAt: s?.refreshRequestedAt ?? null,
  });
}
