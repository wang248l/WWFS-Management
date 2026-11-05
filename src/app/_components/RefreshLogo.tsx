"use client";

import { useState } from "react";

/**
 * 点左上角 logo = 整页刷新（2026-11-05 Wallace：「Management 页面也把左上角 logo 变成刷新按钮」，跟 Marketing 一样）。
 * 用 location.reload() 不用 router.refresh()：加到手机主屏当 App 用时没有浏览器刷新按钮；部署新版本后也只有整页重载才拿到新 JS。
 */
export default function RefreshLogo({ className }: { className: string }) {
  const [spinning, setSpinning] = useState(false);
  return (
    <button
      type="button"
      title="刷新"
      aria-label="刷新页面"
      onClick={() => {
        setSpinning(true);
        window.location.reload();
      }}
      className="shrink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      <img src="/icon.svg" alt="" className={className + (spinning ? " animate-spin" : "")} />
    </button>
  );
}
