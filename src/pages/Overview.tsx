import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  Avatar,
  CountUp,
  date,
  Empty,
  ErrorMessage,
  Icon,
  number,
  Status,
  type IconName,
} from "../components/ui";
import { eventLabel } from "../labels";
import { FinancePanel } from "../components/FinancePanel";

interface Stats {
  users: Record<string, number>;
  employees: Record<string, number>;
  audit: Record<string, number>;
}
interface UserRow {
  user_id: string;
  full_name: string;
  employee_number: string | null;
  status: string;
  created_at: string;
}
interface LogRow {
  event: string;
  success: boolean;
  created_at: string;
  employee_number: string | null;
}

export function OverviewPage() {
  const { security, user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const [s, u, l] = await Promise.all([
        api<Stats>("/admin/stats"),
        api<{ users: UserRow[] }>("/admin/users?limit=5"),
        api<{ logs: LogRow[] }>("/admin/audit-logs?limit=5"),
      ]);
      setStats(s);
      setUsers(u.users);
      setLogs(l.logs);
    } catch {
      setError("تعذّر تحميل مساحة العمل. تحقق من اتصال الخدمة وأعد المحاولة.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const pending =
    (stats?.users.pending_approval ?? 0) +
    (stats?.users.pending_verification ?? 0);
  const total = stats?.users.total ?? 0;
  const active = stats?.users.active ?? 0;
  const remaining = Math.max(0, total - active - pending);
  const activeAngle = total ? (active / total) * 360 : 0;
  const pendingAngle = total ? ((active + pending) / total) * 360 : 0;
  const cards: {
    label: string;
    value: number | undefined;
    detail: string;
    icon: IconName;
    tone: string;
  }[] = [
    {
      label: "إجمالي الحسابات",
      value: stats?.users.total,
      detail: "جميع الحسابات المسجّلة",
      icon: "users",
      tone: "blue",
    },
    {
      label: "الحسابات النشطة",
      value: stats?.users.active,
      detail: "جاهزة للعمل على المنصة",
      icon: "shield",
      tone: "mint",
    },
    {
      label: "بانتظار المراجعة",
      value: stats ? pending : undefined,
      detail: "طلبات تحتاج إلى اهتمامك",
      icon: "clock",
      tone: "amber",
    },
    {
      label: "دليل الموظفين",
      value: stats?.employees.total,
      detail: "سجلات التعريف الوظيفي",
      icon: "grid",
      tone: "lilac",
    },
  ];
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            مساحة العمل <span>/</span> نظرة عامة
          </p>
          <h1>
            كل التفاصيل. <span>في مكان واحد.</span>
          </h1>
          <p className="page-description">
            أهلاً {user?.full_name.split(" ")[0]}، هذه نظرة على فريقك اليوم.
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="icon-button"
            onClick={() => void load()}
            disabled={busy}
            title="تحديث البيانات"
            aria-label="تحديث البيانات"
          >
            <Icon name="refresh" className={busy ? "spinning" : ""} />
          </button>
          <Link className="btn btn-primary" to="/people?create=1">
            <Icon name="plus" size={18} />
            إضافة محقق
          </Link>
        </div>
      </div>
      <ErrorMessage message={error} />
      <div className="metrics-grid" aria-busy={busy}>
        {cards.map((card) => (
          <article
            className={`glass metric metric-${card.tone}`}
            key={card.label}
          >
            <div className="metric-top">
              <span>{card.label}</span>
              <span className="metric-icon">
                <Icon name={card.icon} />
              </span>
            </div>
            <strong className={busy ? "loading-value" : ""}>
              {card.value === undefined ? "—" : <CountUp value={card.value} />}
            </strong>
            <p>
              <span className="small-indicator" />
              {card.detail}
            </p>
          </article>
        ))}
      </div>
      <FinancePanel />
      <div className="overview-layout">
        <div className="overview-primary">
          <section className="glass panel team-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">فريق جولدن باي</span>
                <h2>أحدث الحسابات</h2>
              </div>
              <Link className="text-link" to="/people">
                عرض الجميع <Icon name="arrow" size={16} />
              </Link>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>المحقق</th>
                    <th>رقم الموظف</th>
                    <th>الحالة</th>
                    <th>تاريخ التسجيل</th>
                    <th>
                      <span className="sr-only">عرض</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((person, i) => (
                    <tr key={person.user_id}>
                      <td>
                        <div className="person-cell">
                          <Avatar name={person.full_name} small color={i} />
                          <div>
                            <strong>{person.full_name}</strong>
                            <small>عضو فريق جولدن باي</small>
                          </div>
                        </div>
                      </td>
                      <td className="mono">{person.employee_number ?? "—"}</td>
                      <td>
                        <Status status={person.status} />
                      </td>
                      <td className="date-cell">
                        {new Date(person.created_at).toLocaleDateString(
                          document.documentElement.lang === "en" ? "en-US" : "ar-EG",
                          { day: "numeric", month: "short" },
                        )}
                      </td>
                      <td>
                        <Link
                          to={`/people?search=${encodeURIComponent(person.employee_number ?? person.full_name)}`}
                          className="table-arrow"
                          aria-label={`عرض ${person.full_name}`}
                        >
                          <Icon name="chevron" size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!busy && !users.length && (
              <Empty>لا توجد حسابات مسجّلة بعد.</Empty>
            )}
            <div className="panel-bottom">
              <span>
                <i className="live-dot" />
                بيانات مباشرة من خدمة الهوية
              </span>
              <Link to="/requests">
                مراجعة الطلبات <Icon name="arrow" size={15} />
              </Link>
            </div>
          </section>
          <div className="overview-bottom">
            <section className="glass panel distribution-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">صورة أوضح</span>
                  <h2>حالة الحسابات</h2>
                </div>
                <Icon name="grid" size={18} />
              </div>
              <div className="distribution-body">
                <div
                  className="donut"
                  role="img"
                  aria-label={`الحسابات: ${active} نشطة، ${pending} معلّقة، ${remaining} أخرى`}
                  style={{
                    background: `conic-gradient(var(--accent) 0deg ${activeAngle}deg, var(--accent-deep) ${activeAngle}deg ${pendingAngle}deg, #ffffff25 ${pendingAngle}deg 360deg)`,
                  }}
                >
                  <div>
                    <strong>{stats ? number(total) : "—"}</strong>
                    <span>إجمالي الحسابات</span>
                  </div>
                </div>
                <div className="chart-legend">
                  {[
                    ["نشطة", active, "blue"],
                    ["بانتظار المراجعة", pending, "amber"],
                    ["موقوفة / مرفوضة", remaining, "muted"],
                  ].map(([label, value, tone]) => (
                    <div key={String(label)}>
                      <i className={`legend-dot ${tone}`} />
                      <span>{label}</span>
                      <strong>{stats ? number(Number(value)) : "—"}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <section className="glass panel focus-panel">
              <span className="focus-icon">
                <Icon name="shield" size={25} />
              </span>
              <span className="eyebrow">مساحة أكثر أماناً</span>
              <h2>
                الثقة تبدأ
                <br />
                من كل تسجيل دخول.
              </h2>
              <p>
                {security?.mfa_required
                  ? "المصادقة بخطوتين مطلوبة لحسابك، لحماية مساحة عملك."
                  : "راجع سياسات الدخول وصلاحيات الفريق بانتظام للحفاظ على أمان بياناتك."}
              </p>
              <Link
                className="text-link"
                to={security?.is_owner ? "/administrators" : "/audit"}
              >
                {security?.is_owner ? "إدارة الوصول" : "مراجعة سجل النشاط"}
                <Icon name="arrow" size={16} />
              </Link>
            </section>
          </div>
        </div>
        <aside className="overview-side">
          <section className="glass panel profile-panel">
            <div className="panel-heading">
              <span className="eyebrow">ملفك الشخصي</span>
              <Icon name="shield" size={17} />
            </div>
            <Avatar name={user?.full_name ?? "جولدن باي"} />
            <h2>{user?.full_name}</h2>
            <p dir="ltr" className="profile-email">
              {user?.email}
            </p>
            <span className="badge status-active">
              <i />
              {security?.is_owner
                ? "المدير الرئيسي"
                : user?.roles.includes("admin")
                  ? "مدير النظام"
                  : "الموارد البشرية"}
            </span>
            <div className="profile-meta">
              <span>
                <Icon name="lock" size={15} />
                حماية الحساب
              </span>
              <strong>
                {security?.mfa_required
                  ? security.mfa_method === "email"
                    ? "رمز بالبريد الإلكتروني"
                    : security.mfa_method === "both"
                      ? "بريد + تطبيق المصادقة"
                      : "تطبيق المصادقة"
                  : "كلمة مرور"}
              </strong>
            </div>
            <div className="profile-meta">
              <span>
                <Icon name="globe" size={15} />
                نطاق العمل
              </span>
              <strong>جمهورية مصر العربية</strong>
            </div>
            <Link className="text-link" to="/security">
              إدارة حسابي
              <Icon name="arrow" size={16} />
            </Link>
          </section>
          <section className="glass panel activity-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">آخر التحديثات</span>
                <h2>نبض المنصة</h2>
              </div>
              <Link to="/audit" className="table-arrow" aria-label="سجل النشاط">
                <Icon name="arrow" size={17} />
              </Link>
            </div>
            <div className="activity-list">
              {logs.map((log, i) => (
                <div className="activity-item" key={`${log.created_at}-${i}`}>
                  <span
                    className={`activity-dot ${log.success ? "success" : "danger"}`}
                  >
                    <Icon name={log.success ? "check" : "lock"} size={12} />
                  </span>
                  <div>
                    <strong>{eventLabel(log.event)}</strong>
                    <small>{date(log.created_at)}</small>
                  </div>
                </div>
              ))}
            </div>
            {!busy && !logs.length && (
              <Empty>سيظهر النشاط هنا عند بدء استخدام المنصة.</Empty>
            )}
            <Link className="activity-all" to="/audit">
              كل النشاط <Icon name="chevron" size={14} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
