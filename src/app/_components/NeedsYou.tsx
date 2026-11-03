import Link from "next/link";
import Avatar from "./Avatar";
import ResolveButton from "./ResolveButton";

export type Need = { id: string; kind: string; urgent: boolean; text: string; createdAt: Date; agent: { key: string; name: string; avatar: string | null } };

function when(d: Date) {
  return d.toLocaleString("zh-CN", { timeZone: "America/Vancouver", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** 「找你的事」：agent 卡住了 / 请求开会。紧急的红色闪，明天开会的琥珀色。 */
export default function NeedsYou({ needs, link = true }: { needs: Need[]; link?: boolean }) {
  if (!needs.length) return null;
  return (
    <section className="rise rounded-2xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-amber-50 p-4">
      <h2 className="font-semibold flex items-center gap-2">
        <span className="text-xl animate-bounce">🔔</span> 找你的事 <span className="badge bg-red-500 text-white">{needs.length}</span>
      </h2>
      <ul className="mt-3 space-y-2">
        {needs.map((n) => (
          <li key={n.id} className="card p-3 flex items-center gap-3">
            <Avatar who={n.agent.key} mood="alert" size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{n.agent.name}</span>
                {n.urgent ? (
                  <span className="badge bg-red-600 text-white animate-pulse">紧急 · 随时找你</span>
                ) : (
                  <span className="badge bg-amber-100 text-amber-800">📅 请求明天开会</span>
                )}
                <span className="badge bg-stone-100 text-stone-600">{n.kind === "blocker" ? "卡住了" : "想跟你聊"}</span>
                <span className="text-xs text-stone-400">{when(n.createdAt)}</span>
              </div>
              <div className="text-sm text-stone-800 mt-1 whitespace-pre-wrap line-clamp-3">{n.text}</div>
            </div>
            {link ? (
              <Link href={`/office/${n.agent.key}`} className="btn-primary shrink-0">
                去处理 →
              </Link>
            ) : (
              <ResolveButton id={n.id} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
