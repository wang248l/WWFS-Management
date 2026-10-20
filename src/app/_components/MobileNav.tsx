"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 手机上的导航（2026-10-20 Wallace：「手机版边栏太大做成隐藏的」）。
 * 顶部一条窄栏 + 菜单按钮；点开从左边滑出抽屉，点链接或遮罩自动收起。桌面端不渲染（md:hidden）。
 */
export default function MobileNav({ nav, userName }: { nav: { href: string; label: string }[]; userName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="md:hidden">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-stone-900 text-stone-100 px-3 h-12">
        <button
          type="button"
          aria-label="打开菜单"
          onClick={() => setOpen(true)}
          className="w-9 h-9 -ml-1 flex items-center justify-center rounded-md hover:bg-stone-800"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <img src="/icon.svg" alt="" className="w-6 h-6 rounded-md" />
        <span className="text-sm font-semibold">{nav.find((n) => n.href === pathname)?.label || "管理驾驶舱"}</span>
      </header>

      <div
        className={"fixed inset-0 z-40 bg-black/40 transition-opacity " + (open ? "opacity-100" : "opacity-0 pointer-events-none")}
        onClick={() => setOpen(false)}
      />
      <aside
        className={
          "fixed inset-y-0 left-0 z-50 w-64 max-w-[80vw] bg-stone-900 text-stone-100 flex flex-col transition-transform " +
          (open ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="px-5 py-4 border-b border-stone-800 flex items-center gap-3">
          <img src="/icon.svg" alt="" className="w-8 h-8 rounded-xl" />
          <div className="flex-1 text-base font-semibold">管理驾驶舱</div>
          <button type="button" aria-label="关闭菜单" onClick={() => setOpen(false)} className="text-stone-400 text-2xl leading-none px-1">
            ×
          </button>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={
                "block rounded-md px-3 py-2.5 text-[15px] " +
                (n.href === pathname ? "bg-stone-800 text-white" : "text-stone-200 hover:bg-stone-800")
              }
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-3 border-t border-stone-800 text-xs text-stone-400">
          已登录: <span className="text-stone-200">{userName}</span>
          <form action="/api/logout" method="post" className="mt-2">
            <button type="submit" className="underline hover:text-white">退出登录(全站点登出)</button>
          </form>
        </div>
      </aside>
    </div>
  );
}
