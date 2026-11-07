import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { logoAspect, logoPolygon } from "../logoOutline";
import { currentTheme, motionEnabled, onAppearanceChange } from "../themes";

export type IconName =
  | "home"
  | "users"
  | "shield"
  | "activity"
  | "search"
  | "bell"
  | "plus"
  | "arrow"
  | "logout"
  | "check"
  | "clock"
  | "mail"
  | "lock"
  | "refresh"
  | "close"
  | "chevron"
  | "globe"
  | "key"
  | "grid"
  | "palette"
  | "inbox"
  | "badge"
  | "file"
  | "chart"
  | "history"
  | "star"
  | "message"
  | "tag";
const paths: Record<IconName, ReactNode> = {
  file: (
    <>
      <path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M9 13h6m-6 4h6" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5S14 15 15 15h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8Z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="11" cy="7.5" r="1" />
      <circle cx="15.5" cy="8.5" r="1" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13h5l1.5 3h5l1.5-3h5" />
      <path d="M6 4h12l3 9v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6Z" />
    </>
  ),
  badge: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="3" />
      <circle cx="9" cy="11" r="2" />
      <path d="M5.5 17c.6-2 2-3 3.5-3s2.900 1 3.500 3M15 10h3m-3 4h3M10 5V3h4v2" />
    </>
  ),
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 3 7v6c0 4 9 8 9 8s9-4 9-8V7Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  activity: (
    <>
      <path d="M3 3v18h18M6 14l4-5 4 3 6-7" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M10 22h4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M20 12H4m6-6-6 6 6 6" />,
  logout: (
    <>
      <path d="M9 4H4v16h5m5-8H8m8-5 5 5-5 5m5-5H11" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5 7a8 8 0 0 1 13-2l2 3M4 16l2 3a8 8 0 0 0 13-2" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  chevron: <path d="m14 6-6 6 6 6" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="m12 12 9 9m-5-5 3-3m0 6 3-3" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20h16" />
      <rect x="5.5" y="11" width="3" height="6" rx="1" />
      <rect x="10.5" y="6" width="3" height="11" rx="1" />
      <rect x="15.5" y="9" width="3" height="8" rx="1" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />,
  message: (
    <>
      <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M8 9h8M8 12.5h5" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1.5 1.5 0 0 1 0 2.1l-6.9 6.9a1.5 1.5 0 0 1-2.1 0Z" />
      <circle cx="8.3" cy="8.3" r="1.4" />
    </>
  ),
};
export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={name === "arrow" || name === "chevron" ? `icon-dir ${className}` : className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function Emblem({ className = "brand-mark" }: { className?: string }) {
  const gradient = `gold-${useId().replace(/:/g, "")}`;
  return (
    <svg
      className={className}
      viewBox={`0 0 100 ${100 / logoAspect}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradient} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#f8e7b8" />
          <stop offset="0.38" stopColor="#d9b56c" />
          <stop offset="0.68" stopColor="#a67c35" />
          <stop offset="1" stopColor="#e2c27c" />
        </linearGradient>
      </defs>
      <polygon points={logoPolygon} fill={`url(#${gradient})`} />
    </svg>
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <Emblem />
      {!compact && (
        <div>
          <strong>جولدن باي</strong>
          <small>GOLDEN PAY SERVICES</small>
        </div>
      )}
    </div>
  );
}
export function Ambient() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let mounted = true;
    let dispose = () => {};
    let unsubscribe = () => {};
    void import("../scene").then(({ mountScene }) => {
      if (!mounted || !canvas.current) return;
      try {
        const scene = mountScene(canvas.current, currentTheme(), motionEnabled());
        canvas.current.classList.add("ready");
        unsubscribe = onAppearanceChange(() =>
          scene.update(currentTheme(), motionEnabled()),
        );
        dispose = scene.dispose;
      } catch {
        // No WebGL: the CSS colour layers below remain as the background.
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
      dispose();
    };
  }, []);
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient-orb orb-one" />
      <div className="ambient-orb orb-two" />
      <div className="ambient-orb orb-three" />
      <canvas ref={canvas} className="ambient-canvas" />
      <div className="ambient-shade" />
      <div className="ambient-grain" />
    </div>
  );
}
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(motionEnabled() ? 0 : value);
  useEffect(() => {
    if (!motionEnabled()) {
      setShown(value);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / 900);
      setShown(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{number(shown)}</>;
}
export function Avatar({
  name,
  small = false,
  color = 0,
}: {
  name: string;
  small?: boolean;
  color?: number;
}) {
  return (
    <span
      className={`avatar ${small ? "avatar-small" : ""}`}
      style={
        { "--avatar-hue": [215, 166, 265, 32][color % 4] } as CSSProperties
      }
    >
      {name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0])
        .join("") || "ج"}
    </span>
  );
}
export const number = (value: number) =>
  new Intl.NumberFormat(document.documentElement.lang === "en" ? "en-US" : "ar-EG-u-nu-latn").format(value);
export const date = (value: string) =>
  new Intl.DateTimeFormat(document.documentElement.lang === "en" ? "en-US" : "ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export const statusLabels: Record<string, string> = {
  active: "نشط",
  pending_verification: "بانتظار التحقق",
  pending_approval: "بانتظار الموافقة",
  suspended: "موقوف",
  rejected: "مرفوض",
};
export function Status({ status }: { status: string }) {
  return (
    <span className={`badge status-${status}`}>
      <i />
      {statusLabels[status] ?? status}
    </span>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Icon name="check" size={26} />
      <p>{children}</p>
    </div>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p className="error" role="alert">
      <Icon name="bell" size={16} />
      {message}
    </p>
  ) : null;
}
