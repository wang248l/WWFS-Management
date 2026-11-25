type Row = {
  ip: string; platform: string; account: string; device: string; logged_in: string; last: string; days: number | null; status: string; reason: string;
  // 2026-11-25 Wallace：距上次发布天数（Omen 8:30 健康检查 post_age.py 推）
  days_since_post?: number | null; last_post_at?: string | null; last_title?: string | null; source?: string;
};
type Fix = { title: string; status: string; note?: string };
export type Board = { checked?: string; at?: string; red_days?: number; rows?: Row[]; fixes?: Fix[] };

/** 距上次发布天数：超过 redDays（默认 3）或没有记录 → 红。 */
function PostAge({ r, redDays }: { r: Row; redDays: number }) {
  const d = r.days_since_post !== undefined ? r.days_since_post : r.days;
  const red = d === null || d === undefined || d > redDays;
  const tip = [r.last_post_at, r.last_title, r.source].filter(Boolean).join(" · ");
  return (
    <span title={tip || undefined} className={`badge px-2 py-0.5 tabular-nums ${red ? "bg-red-50 text-red-700 font-semibold" : "bg-stone-100 text-stone-600"}`}>
      距上次发布 {d === null || d === undefined ? "无记录" : `${d} 天`}
    </span>
  );
}

const TONE: Record<string, string> = {
  通畅: "bg-emerald-50 text-emerald-700",
  有问题: "bg-amber-50 text-amber-700",
  断了: "bg-red-50 text-red-700",
};

/** Chase 的账号健康清单 + 发布修复进度（Omen 8:30 健康检查 post_age.py / Mac account_health.py 推；含距上次发布天数，超过 3 天标红）。 */
export default function AccountBoard({ board }: { board: Board }) {
  const rows = board.rows || [];
  const ips = Array.from(new Set(rows.map((r) => r.ip)));
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const redDays = board.red_days ?? 3;
  const stale = rows.filter((r) => {
    const d = r.days_since_post !== undefined ? r.days_since_post : r.days;
    return d === null || d === undefined || d > redDays;
  }).length;
  return (
    <section className="rise card p-4">
      <h2 className="font-semibold">🩺 账号通畅清单</h2>
      <p className="text-sm text-stone-500 mt-1">
        通畅 {count("通畅")} · 有问题 {count("有问题")} · 断了 {count("断了")}（检查 {board.checked || "未知"}）
        {" · "}<span className={stale ? "text-red-700 font-semibold" : ""}>超过 {redDays} 天没发 {stale} 个号</span>
      </p>
      {ips.map((ip) => (
        <div key={ip} className="mt-3">
          <h3 className="text-sm font-semibold">{ip}</h3>
          <ul className="mt-1 divide-y divide-stone-100">
            {rows.filter((r) => r.ip === ip).map((r) => (
              <li key={r.platform + r.device} className="py-1.5 text-sm flex flex-wrap items-center gap-x-2">
                <span className={`badge px-2 py-0.5 ${TONE[r.status] || ""}`}>{r.status}</span>
                <span className="font-medium">{r.platform}</span>
                <span className="text-stone-500">{r.account} · {r.device}</span>
                <PostAge r={r} redDays={redDays} />
                <span className="text-stone-500">最后发布 {r.last}{r.last_title ? ` · ${r.last_title}` : ""}</span>
                {r.status !== "通畅" && <span className="text-stone-700 w-full sm:w-auto">{r.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!!board.fixes?.length && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">🔧 发布修复进度</h3>
          <ul className="mt-1 divide-y divide-stone-100">
            {board.fixes.map((f) => (
              <li key={f.title} className="py-1.5 text-sm">
                <span className="font-medium">{f.status}</span> · {f.title}
                {f.note && <span className="text-stone-500"> — {f.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
