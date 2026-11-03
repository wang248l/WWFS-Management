"use client";

import { useEffect, useState } from "react";

/** 数字从 0 滚到目标值（约 0.9 秒）。非数字原样显示。 */
export default function CountUp({ value, className }: { value: number | string; className?: string }) {
  const target = typeof value === "number" ? value : NaN;
  const [n, setN] = useState(Number.isFinite(target) ? 0 : value);
  useEffect(() => {
    if (!Number.isFinite(target)) return setN(value);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, value]);
  return <span className={className}>{typeof n === "number" ? n.toLocaleString() : n}</span>;
}
