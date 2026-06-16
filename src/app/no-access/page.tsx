import { getCurrentUser, allowedRoles } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Shown to users who are authenticated (valid CRM SSO cookie) but whose role is
 * not in ALLOWED_ROLES. Middleware rewrites them here so no protected page —
 * and therefore no department data — is ever rendered for them.
 */
export default async function NoAccessPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="card p-8 max-w-md w-full text-center space-y-4">
        <img src="/icon.svg" alt="WWFS 管理" className="w-14 h-14 rounded-2xl shadow-md mx-auto" />
        <h1 className="text-xl font-semibold text-stone-900">无访问权限</h1>
        {user ? (
          <p className="text-sm text-stone-600">
            你已登录为 <span className="font-medium">{user.displayName || user.username}</span>
            (角色 <code className="font-mono">{user.role}</code>),但管理驾驶舱目前仅对{" "}
            <code className="font-mono">{allowedRoles().join(" / ")}</code> 开放。
          </p>
        ) : (
          <p className="text-sm text-stone-600">请先登录。</p>
        )}
        <p className="text-xs text-stone-500">如需开通,请联系系统管理员调整角色权限。</p>
        <form action="/api/logout" method="post">
          <button type="submit" className="btn-secondary">退出登录</button>
        </form>
      </div>
    </div>
  );
}
