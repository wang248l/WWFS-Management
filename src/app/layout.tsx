import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getCurrentUser, canAccess } from "@/lib/auth";

export const metadata: Metadata = {
  title: "WWFS 管理驾驶舱",
  description: "Wallace Wang Financial Services 各部门经营数据总览",
  manifest: "/manifest.webmanifest",
  applicationName: "WWFS 管理驾驶舱",
  appleWebApp: { capable: true, title: "WWFS 管理", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#1d4ed8" };

const NAV = [
  { href: "/", label: "每日仪表盘" },
  { href: "/calls", label: "通话分析" },
  { href: "/kpi", label: "月度经营总览" },
  { href: "/data", label: "数据录入" },
  { href: "/team", label: "人员与 Agent 名单" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const authorised = canAccess(user?.role);

  return (
    <html lang="zh">
      <body>
        {user && authorised ? (
          <div className="min-h-screen flex flex-col md:flex-row">
            <aside className="md:w-56 shrink-0 bg-stone-900 text-stone-100 flex flex-col">
              <div className="px-4 py-3 md:px-6 md:py-5 border-b border-stone-800 flex items-center gap-3">
                <img src="/icon.svg" alt="WWFS 管理" className="w-9 h-9 rounded-xl shadow-md shrink-0" />
                <div>
                  <div className="text-base font-semibold">管理驾驶舱</div>
                  <div className="text-xs text-stone-400 mt-0.5">各部门经营数据</div>
                </div>
              </div>
              <nav className="md:flex-1 px-3 py-2 md:py-4 flex md:block gap-1 md:space-y-1 overflow-x-auto">
                {NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="block shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm text-stone-200 hover:bg-stone-800 hover:text-white"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
              <div className="hidden md:block px-4 py-3 border-t border-stone-800 text-xs text-stone-400">
                <div>
                  已登录: <span className="text-stone-200">{user.displayName || user.username}</span>
                </div>
                <form action="/api/logout" method="post" className="mt-2">
                  <button type="submit" className="text-stone-400 hover:text-white underline">
                    退出登录(全站点登出)
                  </button>
                </form>
              </div>
            </aside>
            <main className="flex-1 min-w-0 overflow-x-hidden">
              <div className="max-w-7xl mx-auto p-4 md:p-8">{children}</div>
            </main>
          </div>
        ) : (
          // Not authorised (or not logged in): render the page bare. Protected
          // routes are gated in middleware, so this branch only serves public
          // pages — /login and /no-access — which provide their own full UI.
          children
        )}
      </body>
    </html>
  );
}
