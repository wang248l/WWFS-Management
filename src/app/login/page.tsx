import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CRM_LOGIN_BASE = "https://crm.wallacewang.ca/login";
const MANAGEMENT_ORIGIN = "https://management.wallacewang.ca";

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const nextPath = searchParams.next && searchParams.next.startsWith("/") ? searchParams.next : "/";

  // If a valid CRM cookie is already present, skip the bounce.
  const user = await getCurrentUser();
  if (user) redirect(nextPath);

  const returnTo = MANAGEMENT_ORIGIN + nextPath;
  const crmLogin = CRM_LOGIN_BASE + "?next=" + encodeURIComponent(returnTo);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="card p-8 max-w-md w-full text-center space-y-5">
        <div className="flex flex-col items-center">
          <img src="/icon.svg" alt="WWFS 管理驾驶舱" className="w-16 h-16 rounded-2xl shadow-md mb-3" />
          <h1 className="text-2xl font-semibold text-stone-900">WWFS 管理驾驶舱</h1>
          <p className="text-sm text-stone-500 mt-1">各部门经营数据总览</p>
        </div>
        <div className="text-sm text-stone-700 space-y-2">
          <p>本系统与 WWFS-CRM 共用同一套账号体系。</p>
          <p>点下面的按钮去 CRM 登录,登录成功后会自动跳回来。</p>
        </div>
        <a
          href={crmLogin}
          className="inline-block bg-brand-700 hover:bg-brand-800 text-white font-medium px-5 py-2.5 rounded-md transition"
        >
          前往 CRM 登录 →
        </a>
        <p className="text-xs text-stone-400">
          目的地: <code className="font-mono">management.wallacewang.ca{nextPath}</code>
        </p>
      </div>
    </div>
  );
}
