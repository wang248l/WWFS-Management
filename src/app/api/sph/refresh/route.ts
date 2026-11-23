import { NextRequest, NextResponse } from "next/server";
import { getSph, normAccount, saveSph } from "@/lib/sph";

/** 首页「换一张二维码」：记个请求，Omen 脚本 GET /api/agents/sph 看到后重新截图推上来。 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const account = normAccount(b?.account);
  if (!account) return NextResponse.json({ error: "bad account" }, { status: 400 });
  const now = new Date().toISOString();
  const s = (await getSph(account)) || {
    account, status: "expired" as const, qr: null, qrMime: "image/png", qrAt: null, loggedInAt: null, note: null, host: null, updatedAt: now, refreshRequestedAt: null,
  };
  await saveSph({ ...s, refreshRequestedAt: now });
  return NextResponse.json({ ok: true, refreshRequestedAt: now });
}
