import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import { GlassNav, type NavItem } from "../components/GlassNav";
import { clock, PointBadges, type Tally } from "../components/Points";
import { Ambient, Avatar, Brand, Icon, number } from "../components/ui";
import { Preferences } from "../preferences";

export function Shell() {
  const { user, security, logout } = useAuth();
  const [health, setHealth] = useState<"checking" | "ok" | "offline">(
    "checking",
  );
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const [replies, setReplies] = useState(0);
  const [today, setToday] = useState<{ tracked: boolean; summary?: Tally; today?: { first_seen: string; late_minutes: number } | null } | null>(null);
  const popover = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const links: NavItem[] = [
    { to: "/", label: "نظرة عامة", icon: "home" },
    { to: "/investigations", label: "الاستعلامات", icon: "file" },
    { to: "/requests", label: "طلبات التفعيل", icon: "inbox", badge: pending },
    { to: "/people", label: "المحققون", icon: "users" },
    { to: "/performance", label: "الأداء", icon: "chart" },
    { to: "/forms", label: "النماذج", icon: "grid" },
    { to: "/pricing", label: "الأسعار", icon: "tag" },
    { to: "/audit", label: "سجل النشاط", icon: "history" },
    ...(security?.is_owner
      ? [{ to: "/administrators", label: "إدارة الفريق", icon: "shield" } as NavItem]
      : []),
  ];
  useEffect(() => {
    let active = true;
    const load = () => {
      api<{ status: string; database: string }>("/health", { auth: false })
        .then((data) => {
          if (active)
            setHealth(data.database === "connected" ? "ok" : "offline");
        })
        .catch(() => {
          if (active) setHealth("offline");
        });
      api<{ users: Record<string, number> }>("/admin/stats")
        .then((data) => {
          if (active)
            setPending(
              (data.users.pending_approval ?? 0) +
                (data.users.pending_verification ?? 0),
            );
        })
        .catch(() => {
          if (active) setPending(null);
        });
      api<{ unread: number }>("/complaints/mine?kind=message")
        .then((data) => active && setReplies(data.unread))
        .catch(() => {});
      api<{ tracked: boolean; summary?: Tally; today?: { first_seen: string; late_minutes: number } | null }>("/points/me")
        .then((data) => active && setToday(data))
        .catch(() => active && setToday(null));
    };
    load();
    const interval = window.setInterval(load, 60000);
    window.addEventListener("gp-requests-changed", load);
    window.addEventListener("gp-messages-changed", load);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("gp-requests-changed", load);
      window.removeEventListener("gp-messages-changed", load);
    };
  }, []);
  useEffect(() => {
    // Attendance: head office counts the first and last activity of each day.
    const ping = () => void api("/attendance/ping", { method: "POST", body: JSON.stringify({ platform: "web" }) }).catch(() => {});
    ping();
    const interval = window.setInterval(ping, 5 * 60000);
    const visible = () => document.visibilityState === "visible" && ping();
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    // Light follows the pointer across glass surfaces; metric cards also tilt.
    const reset = (surface: HTMLElement) => {
      surface.style.setProperty("--rx", "0deg");
      surface.style.setProperty("--ry", "0deg");
    };
    let last: HTMLElement | null = null;
    const move = (event: PointerEvent) => {
      const surface = (event.target as Element).closest<HTMLElement>(".glass, .card");
      if (last && last !== surface) reset(last);
      last = surface;
      if (!surface) return;
      const box = surface.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      surface.style.setProperty("--mx", `${x * 100}%`);
      surface.style.setProperty("--my", `${y * 100}%`);
      if (surface.classList.contains("metric")) {
        surface.style.setProperty("--rx", `${(0.5 - y) * 11}deg`);
        surface.style.setProperty("--ry", `${(x - 0.5) * 11}deg`);
      }
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => document.removeEventListener("pointermove", move);
  }, []);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!popover.current?.contains(event.target as Node))
        setNotifications(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotifications(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    setNotifications(false);
  }, [location.pathname, location.search]);

  return (
    <div className="app" dir={document.documentElement.dir}>
      <Ambient />
      <a href="#main-content" className="skip-link">
        انتقل إلى المحتوى
      </a>
      <header className="workspace-header">
        <Link to="/" className="brand-link">
          <Brand />
          <span className="sr-only"> — الرئيسية</span>
        </Link>
        <GlassNav items={links} label="التنقل الرئيسي" className="pill-nav" />
        <div className="header-tools">
          <form
            className="global-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(`/people?search=${encodeURIComponent(search)}`);
            }}
          >
            <input
              aria-label="ابحث عن محقق أو رقم موظف"
              placeholder="ابحث عن محقق…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button aria-label="بحث" type="submit">
              <Icon name="search" size={17} />
            </button>
          </form>
          <NavLink
            to="/messages"
            className="icon-button header-link"
            title="رسائل الإدارة العليا"
            aria-label="رسائل الإدارة العليا"
          >
            <Icon name="message" />
            {!!replies && <i className="notification-dot" />}
          </NavLink>
          <NavLink to="/my-points" className="icon-button header-link" title="نقاطي" aria-label="نقاطي">
            <Icon name="star" />
          </NavLink>
          <div className="notification-anchor" ref={popover}>
            <button
              className="icon-button"
              title="الإشعارات"
              aria-label="الإشعارات"
              aria-expanded={notifications}
              onClick={() => setNotifications(!notifications)}
            >
              <Icon name="bell" />
              {!!((pending ?? 0) + replies) && <i className="notification-dot" />}
            </button>
            {notifications && (
              <div className="notification-popover notify-center glass" role="dialog" aria-label="الإشعارات">
                <header>
                  <h3>الإشعارات</h3>
                  {!!((pending ?? 0) + replies) && <span className="nav-badge">{number((pending ?? 0) + replies)}</span>}
                </header>
                <Link to="/requests" className={`notify-row${pending ? " unread" : ""}`}>
                  <span className="notify-icon">
                    <Icon name="inbox" size={18} />
                  </span>
                  <span>
                    <strong>طلبات التفعيل</strong>
                    <small>
                      {pending === null
                        ? "تعذّر تحميل الطلبات حالياً."
                        : pending
                          ? `${number(pending)} طلب بانتظار مراجعتك`
                          : "لا توجد طلبات معلّقة"}
                    </small>
                  </span>
                </Link>
                <Link to="/messages" className={`notify-row${replies ? " unread" : ""}`}>
                  <span className="notify-icon">
                    <Icon name="message" size={18} />
                  </span>
                  <span>
                    <strong>رسائل الإدارة العليا</strong>
                    <small>{replies ? `${number(replies)} رد جديد من الإدارة العليا` : "لا ردود جديدة"}</small>
                  </span>
                </Link>
                {today?.tracked && (
                  <Link to="/my-points" className="notify-row">
                    <span className="notify-icon">
                      <Icon name="clock" size={18} />
                    </span>
                    <span>
                      <strong>حضوري اليوم</strong>
                      <small>
                        {today.today
                          ? today.today.late_minutes > 0
                            ? `حضرت ${clock(today.today.first_seen)} — تأخير ${number(today.today.late_minutes)} دقيقة`
                            : `حضرت ${clock(today.today.first_seen)} — في الموعد`
                          : "لم يُسجَّل حضور اليوم"}
                      </small>
                    </span>
                    <PointBadges summary={today.summary} compact />
                  </Link>
                )}
              </div>
            )}
          </div>
          <Preferences />
          <Link
            to="/security"
            className="header-avatar"
            title={`إدارة حسابي — ${user?.full_name ?? ""}`}
            aria-label="إدارة حسابي"
          >
            <Avatar name={user?.full_name ?? "جولدن باي"} small />
            <i />
          </Link>
        </div>
      </header>

      <aside className="icon-rail">
        <Brand compact />
        <GlassNav
          items={links}
          label="اختصارات مساحة العمل"
          className="rail-links"
          iconOnly
        />
        <div
          className={`rail-connection ${health}`}
          title={
            health === "ok"
              ? "متصل بالخدمة وقاعدة البيانات"
              : "التحقق من الاتصال"
          }
        >
          <i />
        </div>
        <button
          className="rail-logout"
          onClick={() => void logout()}
          aria-label="تسجيل الخروج"
          title="تسجيل الخروج"
        >
          <Icon name="logout" />
        </button>
      </aside>
      <main className="main" id="main-content" tabIndex={-1}>
        <div className="route-stage" key={location.pathname}>
          <Outlet />
        </div>
      </main>
      <footer className="workspace-footer">
        <span>
          جولدن باي للخدمات <i>·</i> مساحة عملك، برؤية أوضح.
        </span>
        <span className={`connection ${health}`}>
          <i />
          {health === "ok"
            ? "الخدمة وقاعدة البيانات متصلتان"
            : health === "offline"
              ? "تعذّر الاتصال بالخدمة"
              : "جارٍ التحقق من الاتصال"}
        </span>
      </footer>
    </div>
  );
}
