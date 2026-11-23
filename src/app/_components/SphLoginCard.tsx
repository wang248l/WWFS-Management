"use client";

import { useEffect, useState } from "react";
import type { SphView } from "@/lib/sph";

/**
 * 首页「视频号扫码」卡片（2026-11-23）：Omen 推上来的视频号助手登录二维码，每 4 秒刷新一次；
 * 今天已经登录过就显示「今日已登录」和时间。Wallace 每天早上打开首页，用微信扫一下。
 */
function agoText(iso: string | null | undefined, now: number) {
  if (!iso || !now) return ""; // now=0：还没挂载，服务器渲染不出相对时间，免得水合不一致
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} 秒前`;
  if (s < 3600) return `${Math.round(s / 60)} 分钟前`;
  if (s < 172800) return `${Math.round(s / 3600)} 小时前`;
  return `${Math.floor(s / 86400)} 天前`;
}

export default function SphLoginCard({ initial }: { initial: SphView }) {
  const [v, setV] = useState<SphView>(initial);
  const [now, setNow] = useState(0);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/sph?account=${encodeURIComponent(initial.account)}`, { cache: "no-store" });
        if (r.ok && alive) setV(await r.json());
      } catch {}
      if (alive) setNow(Date.now());
    };
    // 还没登录就 4 秒刷一次（随时可能来新码），登录后 30 秒
    const ms = v.state === "logged_in" ? 30000 : 4000;
    const id = setInterval(tick, ms);
    setNow(Date.now());
    const clock = setInterval(() => alive && setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(clock);
    };
  }, [initial.account, v.state]);

  const askNew = async () => {
    setAsking(true);
    await fetch("/api/sph/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: v.account }) }).catch(() => {});
    setTimeout(() => setAsking(false), 120_000);
  };

  const refreshPending = !!v.refreshRequestedAt;
  const ok = v.state === "logged_in";
  const tone = ok ? "border-emerald-300 bg-emerald-50" : v.state === "scan" ? "border-green-500 bg-white" : "border-amber-300 bg-amber-50";

  return (
    <section className={"rise rounded-2xl border-2 p-4 " + tone}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-semibold flex items-center gap-2">
          <span className="text-xl">📱</span> 视频号扫码
          <span className="text-xs font-normal text-stone-500">{v.label}</span>
        </h2>
        {ok ? (
          <span className="badge bg-emerald-600 text-white">✅ 今日已登录 {v.loggedInTime}</span>
        ) : v.state === "scan" ? (
          <span className="badge bg-green-600 text-white animate-pulse">请用微信扫码</span>
        ) : (
          <span className="badge bg-amber-500 text-white">今天还没登录</span>
        )}
      </div>

      {ok && (
        <p className="mt-2 text-sm text-emerald-900">
          今天 {v.loggedInTime} 登录成功，今晚的视频号会从 Omen 自动发。登录大约 24 小时有效，明天早上这里会再出二维码。
        </p>
      )}

      {v.state === "scan" && (
        <div className="mt-3 flex flex-col sm:flex-row items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/sph/qr?account=${encodeURIComponent(v.account)}&v=${v.qrVersion}`}
            alt="视频号助手登录二维码"
            className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl border border-stone-200 bg-white"
          />
          <div className="text-sm text-stone-700 space-y-1">
            <div className="font-medium">打开微信 → 扫一扫 → 扫这个二维码 → 在手机上点「确认登录」</div>
            <div className="text-xs text-stone-500">二维码 {agoText(v.qrAt, now)} 由 {v.host || "Omen PC"} 截取，页面每 4 秒自动刷新。扫完这里会变成「今日已登录」。</div>
            <div className="text-xs text-stone-500 sm:hidden">在这台手机上看？先截屏，再打开微信「扫一扫」→ 右上角相册 → 选这张截图。</div>
            {v.note && <div className="text-xs text-stone-500">备注：{v.note}</div>}
            <button type="button" className="btn-secondary text-xs mt-1" disabled={asking || refreshPending} onClick={askNew}>
              {asking || refreshPending ? "已请求，等 Omen 换码…" : "扫不了？换一张二维码"}
            </button>
          </div>
        </div>
      )}

      {!ok && v.state !== "scan" && (
        <div className="mt-2 text-sm text-stone-700 space-y-2">
          <div>
            {v.state === "none" && "Omen PC 还没推送过视频号登录状态。Omen 的发布脚本跑起来后，二维码会出现在这里。"}
            {v.state === "qr_stale" && `二维码已经过期（${agoText(v.qrAt, now)}截的），正在等 Omen 推一张新的。`}
            {v.state === "logged_in_old" && `上次登录是 ${agoText(v.loggedInAt, now)}，今天还没扫码，等 Omen 推新二维码。`}
            {v.state === "expired" && "登录已过期，等 Omen 推新二维码。"}
            {v.state === "error" && `Omen 截二维码出错${v.note ? "：" + v.note : ""}。`}
          </div>
          {v.note && v.state !== "error" && <div className="text-xs text-stone-500">备注：{v.note}</div>}
          <button type="button" className="btn-secondary text-xs" disabled={asking || refreshPending} onClick={askNew}>
            {asking || refreshPending ? `已请求新二维码${v.refreshRequestedAt ? "（" + agoText(v.refreshRequestedAt, now) + "）" : ""}，等 Omen…` : "让 Omen 现在出一张二维码"}
          </button>
        </div>
      )}
    </section>
  );
}
