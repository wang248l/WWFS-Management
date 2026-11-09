type Row = { ip: string; platform: string; account: string; device: string; logged_in: string; last: string; days: number | null; status: string; reason: string };
type Fix = { title: string; status: string; note?: string };
export type Board = { checked?: string; at?: string; rows?: Row[]; fixes?: Fix[] };

const TONE: Record<string, string> = {
  通畅: "bg-emerald-50 text-emerald-700",
  有问题: "bg-amber-50 text-amber-700",
  断了: "bg-red-50 text-red-700",
};

/** Chase 的账号健康清单 + 发布修复进度（Mac 上 account_health.py 每天推一次）。 */
export default function AccountBoard({ board }: { board: Board }) {
  const rows = board.rows || [];
  const ips = Array.from(new Set(rows.map((r) => r.ip)));
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return (
    <section className="rise card p-4">
      <h2 className="font-semibold">🩺 账号通畅清单</h2>
      <p className="text-sm text-stone-500 mt-1">
        通畅 {count("通畅")} · 有问题 {count("有问题")} · 断了 {count("断了")}（手机登录 {board.checked || "未知"} 实查）
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
                <span className="text-stone-500">最后发布 {r.last}</span>
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
