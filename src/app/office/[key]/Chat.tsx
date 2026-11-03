"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Msg = { id: string; fromRole: string; kind?: string; urgent?: boolean; text: string; readAt: string | null; createdAt: string };

// agent 发来的不同种类，用不同颜色的气泡
const AGENT_STYLE: Record<string, { cls: string; tag: string }> = {
  chat: { cls: "bg-stone-100 text-stone-900", tag: "" },
  progress: { cls: "bg-emerald-50 text-emerald-900 border border-emerald-200", tag: "✅ 进度" },
  blocker: { cls: "bg-red-50 text-red-900 border border-red-200", tag: "🚧 卡住了" },
  meeting: { cls: "bg-amber-50 text-amber-900 border border-amber-200", tag: "📅 请求开会" },
};

/** 工位上的对话框。配了 ANTHROPIC_API_KEY 当场回；没配就留言，agent 值班时取走回复。 */
export default function Chat({ agentKey, agentName, avatar, initial, canRun }: { agentKey: string; agentName: string; avatar: string; initial: Msg[]; canRun: boolean }) {
  const [kind, setKind] = useState<"instruction" | "chat">(canRun ? "instruction" : "chat");
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setText("");
    setMsgs((m) => [...m, { id: "tmp", fromRole: "owner", kind, text: t, readAt: null, createdAt: new Date().toISOString() }]);
    const res = await fetch("/api/office/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agent: agentKey, text: t, kind }) });
    const j = await res.json().catch(() => null);
    if (j?.messages) setMsgs(j.messages);
    setHint(
      kind === "instruction"
        ? `已交给 ${agentName}，看板上多了一张卡。${canRun ? "Mac 几分钟内开始做，" : ""}做完或卡住都会告诉你。`
        : j?.live
          ? ""
          : `已留言，${agentName} 下次值班时回复你。`,
    );
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="card flex flex-col h-[32rem]">
      <div className="px-4 py-3 border-b border-stone-200 font-medium">
        跟 {avatar} {agentName} 说话
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {!msgs.length && <p className="text-stone-400">还没说过话。交代一件事、问一句进度都行。</p>}
        {msgs.map((m, i) => {
          const st = AGENT_STYLE[m.kind || "chat"] || AGENT_STYLE.chat;
          return (
          <div key={m.id + i} className={"rise flex " + (m.fromRole === "owner" ? "justify-end" : "justify-start")}>
            <div className={"max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap " + (m.fromRole === "owner" ? "bg-brand-700 text-white" : st.cls)}>
              {m.fromRole === "owner" && m.kind === "instruction" && <div className="text-[10px] font-semibold opacity-80 mb-0.5">📌 交给他做</div>}
              {m.fromRole !== "owner" && st.tag && (
                <div className="text-[10px] font-semibold mb-0.5">
                  {st.tag}
                  {(m.kind === "blocker" || m.kind === "meeting") && (m.urgent ? " · 紧急" : " · 明天开会")}
                </div>
              )}
              {m.text}
              {m.fromRole === "owner" && <div className="text-[10px] opacity-70 mt-0.5 text-right">{m.readAt ? "已读" : "未读"}</div>}
            </div>
          </div>
          );
        })}
        {busy && <div className="text-xs text-stone-400">{agentName} 正在看…</div>}
        <div ref={end} />
      </div>
      {hint && <div className="px-4 pb-1 text-xs text-amber-700">{hint}</div>}
      <div className="px-3 pt-2 border-t border-stone-200 flex gap-1.5">
        {(
          [
            ["instruction", "📌 交给他做"],
            ["chat", "💬 只是聊聊"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={"rounded-full px-3 py-1 text-xs font-medium transition " + (kind === k ? "bg-brand-700 text-white shadow" : "bg-stone-100 text-stone-600 hover:bg-stone-200")}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={send} className="p-3 flex gap-2">
        <input
          className="input"
          placeholder={kind === "instruction" ? `交代 ${agentName} 一件事，比如：剪辑时把停顿留 0.3 秒` : `对 ${agentName} 说…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-primary shrink-0" disabled={busy || !text.trim()}>
          {kind === "instruction" ? "交给他" : "发送"}
        </button>
      </form>
    </div>
  );
}
