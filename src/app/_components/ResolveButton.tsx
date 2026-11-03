"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ResolveButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="btn-secondary shrink-0"
      onClick={async () => {
        setBusy(true);
        await fetch("/api/office/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
        router.refresh();
      }}
    >
      ✓ 已处理
    </button>
  );
}
