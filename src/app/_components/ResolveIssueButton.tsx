"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ResolveIssueButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      title="这个问题已经解决：不再亮红，同一个问题 7 天内再报也不算"
      className="btn-secondary shrink-0 text-xs"
      onClick={async () => {
        setBusy(true);
        await fetch("/api/office/resolve-issue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
        router.refresh();
      }}
    >
      {busy ? "…" : "✓ 标记已解决"}
    </button>
  );
}
