import { useEffect, useState } from "react";
import { api } from "../api";
import { date, Empty, ErrorMessage, Icon, number } from "../components/ui";
import { eventLabel } from "../labels";

interface LogRow {
  event: string;
  success: boolean;
  employee_number: string | null;
  ip: string | null;
  created_at: string;
}
export function AuditPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    api<{ logs: LogRow[]; pagination: { total: number; pages: number } }>(
      `/admin/audit-logs?limit=12&page=${page}${result ? `&success=${result}` : ""}`,
    )
      .then((data) => {
        if (active) {
          setLogs(data.logs);
          setTotal(data.pagination.total);
          setPages(data.pagination.pages);
        }
      })
      .catch(() => {
        if (active) setError("تعذّر تحميل سجل النشاط.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [result, page, reload]);
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            مساحة العمل <span>/</span> سجل النشاط
          </p>
          <h1>
            كل حدث. <span>مسجّل بوضوح.</span>
          </h1>
          <p className="page-description">
            تابع أحداث الوصول وتحديثات الحسابات والصلاحيات.
          </p>
        </div>
        <button
          className="btn"
          disabled={busy}
          onClick={() => setReload((v) => v + 1)}
        >
          <Icon name="refresh" size={16} />
          تحديث
        </button>
      </div>
      <ErrorMessage message={error} />
      <section className="glass panel" aria-busy={busy}>
        <div className="directory-toolbar">
          <div>
            <h2>سجل التدقيق الأمني</h2>
            <span className="count-label">{number(total)} حدث مسجّل</span>
          </div>
          <select
            className="filter-select"
            aria-label="نتيجة الحدث"
            value={result}
            onChange={(e) => {
              setResult(e.target.value);
              setPage(1);
            }}
          >
            <option value="">جميع الأحداث</option>
            <option value="true">الأحداث الناجحة</option>
            <option value="false">المحاولات غير الناجحة</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الحدث</th>
                <th>التاريخ والوقت</th>
                <th>النتيجة</th>
                <th>رقم الموظف</th>
                <th>عنوان الاتصال</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={`${log.created_at}-${i}`}>
                  <td>
                    <div className="person-cell">
                      <span
                        className={`activity-dot ${log.success ? "success" : "danger"}`}
                      >
                        <Icon name={log.success ? "check" : "lock"} size={13} />
                      </span>
                      <div>
                        <strong>{eventLabel(log.event)}</strong>
                        <small dir="ltr">{log.event}</small>
                      </div>
                    </div>
                  </td>
                  <td className="date-cell">{date(log.created_at)}</td>
                  <td>
                    <span
                      className={`badge ${log.success ? "status-active" : "status-rejected"}`}
                    >
                      <i />
                      {log.success ? "ناجح" : "غير ناجح"}
                    </span>
                  </td>
                  <td className="mono">{log.employee_number ?? "—"}</td>
                  <td className="mono">
                    {log.ip === "unknown" ? "محلي" : (log.ip ?? "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!busy && !logs.length && <Empty>لا توجد أحداث ضمن هذا التصنيف.</Empty>}
        <div className="table-footer">
          <span>
            {busy
              ? "جارٍ التحميل…"
              : `الصفحة ${number(page)} من ${number(Math.max(1, pages))}`}
          </span>
          <div className="inline">
            <button
              className="btn small ghost"
              disabled={page <= 1 || busy}
              onClick={() => setPage(page - 1)}
            >
              السابق
            </button>
            <button
              className="btn small ghost"
              disabled={page >= pages || busy}
              onClick={() => setPage(page + 1)}
            >
              التالي
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
