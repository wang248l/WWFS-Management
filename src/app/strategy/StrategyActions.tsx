"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function send(body: Record<string, unknown>) {
  await fetch("/api/office/strategy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

/** 老板自己（或找的人）做完了就勾一下；Kai 下周复盘读到。 */
export function DoneBox({ week, id, done }: { week: string; id: string; done: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(done);
  return (
    <button
      type="button"
      aria-label={on ? "标为没做完" : "标为做完了"}
      onClick={async () => {
        setOn(!on);
        await send({ week, id, done: !on });
        router.refresh();
      }}
      className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs transition ${on ? "bg-emerald-500 border-emerald-500 text-white" : "border-stone-300 hover:border-emerald-400"}`}
    >
      {on ? "✓" : ""}
    </button>
  );
}

/** 拍板：点一个选项就算定了，可以改。 */
export function DecisionButtons({ week, id, options, recommend, chosen }: { week: string; id: string; options: string[]; recommend?: number; chosen?: number }) {
  const router = useRouter();
  const [pick, setPick] = useState<number | undefined>(chosen);
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          onClick={async () => {
            setPick(i);
            await send({ week, id, choice: i });
            router.refresh();
          }}
          className={`rounded-lg border-2 px-3 py-1.5 text-sm text-left transition ${pick === i ? "border-emerald-500 bg-emerald-50 font-semibold" : "border-stone-200 hover:border-stone-400 bg-white"}`}
        >
          {pick === i && "✓ "}
          {o}
          {recommend === i && <span className="ml-1.5 text-xs text-brand-700">（推荐）</span>}
        </button>
      ))}
    </div>
  );
}
