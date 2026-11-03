import Avatar, { type Mood } from "./Avatar";

/** 一个工位：卡通小人坐在桌子后面，桌上一台笔记本（在岗时屏幕亮着闪）。 */
export default function DeskScene({ who, mood, human = false }: { who: string; mood: Mood; human?: boolean }) {
  const on = mood === "work" || mood === "happy";
  return (
    <div className="relative w-[112px] h-[104px] shrink-0">
      <div className="absolute left-1/2 -translate-x-1/2 top-0">
        <Avatar who={who} mood={mood} size={76} human={human} />
      </div>
      <svg viewBox="0 0 112 40" className="absolute bottom-0 left-0 w-full" aria-hidden>
        <rect x="4" y="14" width="104" height="10" rx="3" fill="#b45309" />
        <rect x="4" y="14" width="104" height="3" rx="1.5" fill="#d97706" />
        <rect x="12" y="24" width="6" height="16" fill="#92400e" />
        <rect x="94" y="24" width="6" height="16" fill="#92400e" />
        <path d="M36 14l6-12h28l6 12z" fill="#44403c" />
        <path d="M40 12l4-8h24l4 8z" fill={on ? "#93c5fd" : "#57534e"} className={on ? "screen-on" : ""} />
        <circle cx="56" cy="8" r="1.6" fill="#fff" opacity={on ? 0.9 : 0.2} />
        <rect x="84" y="6" width="9" height="8" rx="1.5" fill="#fef3c7" stroke="#d6d3d1" />
      </svg>
    </div>
  );
}

/** 两个人共用一张长桌、一台 Mac（Mark + Chase）。 */
export function SharedDeskScene({ people }: { people: { who: string; mood: Mood }[] }) {
  const on = people.some((p) => p.mood === "work" || p.mood === "happy");
  return (
    <div className="relative w-full h-[112px]">
      <div className="absolute inset-x-0 top-0 flex justify-around px-6">
        {people.map((p) => (
          <Avatar key={p.who} who={p.who} mood={p.mood} size={80} />
        ))}
      </div>
      <svg viewBox="0 0 300 44" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-full h-[44px]" aria-hidden>
        <rect x="4" y="18" width="292" height="10" rx="3" fill="#b45309" />
        <rect x="4" y="18" width="292" height="3" rx="1.5" fill="#d97706" />
        <rect x="14" y="28" width="7" height="16" fill="#92400e" />
        <rect x="279" y="28" width="7" height="16" fill="#92400e" />
      </svg>
      <svg viewBox="0 0 60 44" className="absolute bottom-[14px] left-1/2 -translate-x-1/2 w-[64px]" aria-hidden>
        <rect x="6" y="2" width="48" height="30" rx="3" fill="#d6d3d1" />
        <rect x="9" y="5" width="42" height="24" rx="1.5" fill={on ? "#93c5fd" : "#57534e"} className={on ? "screen-on" : ""} />
        <path d="M26 32h8l2 8h-12z" fill="#a8a29e" />
        <rect x="20" y="40" width="20" height="2.5" rx="1" fill="#a8a29e" />
      </svg>
    </div>
  );
}
