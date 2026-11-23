import { NextRequest, NextResponse } from "next/server";
import { getSph, normAccount } from "@/lib/sph";

export const dynamic = "force-dynamic";

/** 二维码图片本体（登录后的会话才看得到）。 */
export async function GET(req: NextRequest) {
  const account = normAccount(req.nextUrl.searchParams.get("account"));
  const s = account ? await getSph(account) : null;
  if (!s?.qr) return new NextResponse("no qr", { status: 404, headers: { "cache-control": "no-store" } });
  return new NextResponse(Buffer.from(s.qr, "base64"), { headers: { "content-type": s.qrMime || "image/png", "cache-control": "no-store" } });
}
