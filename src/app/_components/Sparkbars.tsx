/** 7 根小柱子，最高的一根顶满；没数据的天是一条灰线。 */
export default function Sparkbars({ values, color = "#6366f1" }: { values: (number | null)[]; color?: string }) {
  const max = Math.max(1, ...values.map((v) => v || 0));
  return (
    <div className="flex items-end gap-[3px] h-8">
      {values.map((v, i) => (
        <div
          key={i}
          className="bar-grow w-2 rounded-sm"
          style={{ height: v ? `${Math.max(8, (v / max) * 100)}%` : "2px", background: v ? color : "#d6d3d1", animationDelay: `${i * 60}ms` }}
          title={v === null ? "没报" : String(v)}
        />
      ))}
    </div>
  );
}
