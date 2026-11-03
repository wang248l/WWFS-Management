"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { id: string; fromRole: string; text: string; readAt: string | null; createdAt: string };

/** 工位上的对话框。配了 ANTHROPIC_API_KEY 当场回；没配就留言，agent 值班时取走回复。 */
export default function Chat({ agentKey, agentName, avatar, initial }: { agentKey: string; agentName: string; avatar: string; initial: Msg[] }) {
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
    setMsgs((m) => [...m, { id: "tmp", fromRole: "owner", text: t, readAt: null, createdAt: new Date().toISOString() }]);
    const res = await fetch("/api/office/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agent: agentKey, text: t }) });
    const j = await res.json().catch(() => null);
    if (j?.messages) setMsgs(j.messages);
    setHint(j?.live ? "" : `已留言，${agentName} 下次值班时回复你。`);
    setBusy(false);
  }

  return (
    <div className="card flex flex-col h-[28rem]">
      <div className="px-4 py-3 border-b border-stone-200 font-medium">
        跟 {avatar} {agentName} 说话
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {!msgs.length && <p className="text-stone-400">还没说过话。交代一件事、问一句进度都行。</p>}
        {msgs.map((m, i) => (
          <div key={m.id + i} className={"flex " + (m.fromRole === "owner" ? "justify-end" : "justify-start")}>
            <div className={"max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap " + (m.fromRole === "owner" ? "bg-brand-700 text-white" : "bg-stone-100 text-stone-900")}>
              {m.text}
              {m.fromRole === "owner" && <div className="text-[10px] opacity-70 mt-0.5 text-right">{m.readAt ? "已读" : "未读"}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="text-xs text-stone-400">{agentName} 正在看…</div>}
        <div ref={end} />
      </div>
      {hint && <div className="px-4 pb-1 text-xs text-amber-700">{hint}</div>}
      <form onSubmit={send} className="p-3 border-t border-stone-200 flex gap-2">
        <input className="input" placeholder={`对 ${agentName} 说…`} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={busy || !text.trim()}>
          发送
        </button>
      </form>
    </div>
  );
}
