/**
 * 卡通小人（2026-11-03 Wallace：「放上卡通动画，放上好看的动效果」）。纯 SVG + globals.css 里的关键帧：
 *   work  在岗：上下轻晃、眨眼、敲键盘，头顶灯绿色呼吸
 *   sleep 未上岗/停用：闭眼、飘 Zzz，灯灰
 *   alert 超时/出错：抖动、冒汗，灯红色快闪
 *   happy 有好消息（新留资 / 刚完成）：跳一下、冒星星
 */
export type Mood = "work" | "sleep" | "alert" | "happy";

const PALETTE: Record<string, [string, string]> = {
  mark: ["#3b82f6", "#1d4ed8"],
  leo: ["#f59e0b", "#d97706"],
  recruit: ["#14b8a6", "#0f766e"],
  mac: ["#a855f7", "#7e22ce"],
  ryzen: ["#64748b", "#334155"],
  human: ["#f472b6", "#db2777"],
};
const LIGHT: Record<Mood, string> = { work: "#22c55e", happy: "#22c55e", sleep: "#a8a29e", alert: "#ef4444" };

export default function Avatar({ who, mood, size = 72, human = false }: { who: string; mood: Mood; size?: number; human?: boolean }) {
  const [c1, c2] = PALETTE[human ? "human" : who] || ["#10b981", "#047857"];
  const id = `g-${who}`;
  const eyesClosed = mood === "sleep";
  return (
    <div className={`avatar avatar-${mood}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" width={size} height={size} aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c1} />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
        </defs>
        <ellipse cx="40" cy="76" rx="20" ry="3" fill="#000" opacity=".08" className="av-shadow" />
        <g className="av-body">
          {human ? null : (
            <g>
              <line x1="40" y1="12" x2="40" y2="4" stroke={c2} strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="40" cy="4" r="3.5" fill={LIGHT[mood]} className="av-light" />
            </g>
          )}
          <rect x="16" y="12" width="48" height="40" rx="18" fill={`url(#${id})`} />
          <rect x="22" y="20" width="36" height="24" rx="11" fill="#fff" opacity=".95" />
          {human && <path d="M15 30c0-12 10-20 25-20s25 8 25 20c-6-6-14-9-25-9s-19 3-25 9z" fill="#3f3f46" />}
          {eyesClosed ? (
            <g stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round">
              <path d="M28 32q4 3 8 0" fill="none" />
              <path d="M44 32q4 3 8 0" fill="none" />
            </g>
          ) : (
            <g className="av-eyes" fill="#1c1917">
              <ellipse cx="32" cy="31" rx="3" ry={mood === "happy" ? 2 : 3.6} />
              <ellipse cx="48" cy="31" rx="3" ry={mood === "happy" ? 2 : 3.6} />
              <circle cx="33" cy="29.6" r="1" fill="#fff" />
              <circle cx="49" cy="29.6" r="1" fill="#fff" />
            </g>
          )}
          {mood === "alert" ? (
            <ellipse cx="40" cy="39" rx="3" ry="2.4" fill="#1c1917" />
          ) : (
            <path d={mood === "happy" ? "M33 37q7 7 14 0" : "M35 38q5 3 10 0"} stroke="#1c1917" strokeWidth="2" fill={mood === "happy" ? "#fb7185" : "none"} strokeLinecap="round" />
          )}
          <circle cx="26" cy="38" r="2.6" fill="#fb7185" opacity=".45" />
          <circle cx="54" cy="38" r="2.6" fill="#fb7185" opacity=".45" />
          <rect x="24" y="52" width="32" height="18" rx="8" fill={`url(#${id})`} />
          <g className="av-hands" fill={c2}>
            <circle cx="22" cy="62" r="5" className="av-hand-l" />
            <circle cx="58" cy="62" r="5" className="av-hand-r" />
          </g>
          {mood === "alert" && <path d="M60 18q3 5 0 7q-3-2 0-7z" fill="#38bdf8" className="av-sweat" />}
        </g>
        {mood === "sleep" && (
          <g className="av-zzz" fill="#78716c" fontSize="10" fontWeight="700">
            <text x="60" y="16">z</text>
            <text x="66" y="8" fontSize="8">z</text>
          </g>
        )}
        {mood === "happy" && (
          <g className="av-stars" fill="#facc15">
            <path d="M8 14l2 4 4 1-4 1-2 4-2-4-4-1 4-1z" />
            <path d="M70 26l1.5 3 3 1-3 1-1.5 3-1.5-3-3-1 3-1z" />
          </g>
        )}
      </svg>
    </div>
  );
}

export function moodFor(status: string, happy = false): Mood {
  if (status === "late" || status === "error") return "alert";
  if (status === "never" || status === "paused") return "sleep";
  return happy ? "happy" : "work";
}
