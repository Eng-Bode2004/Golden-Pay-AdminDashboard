import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiRequestError } from "../api";
import { Empty, ErrorMessage, Icon, number } from "../components/ui";
import "../intake.css";

interface OpenCase {
  investigation_id: string;
  reference: string;
  status: string;
  subject_name: string;
  client_name: string | null;
  governorate: string | null;
  district: string | null;
  service_name: string | null;
  due_at: string | null;
  created_at: string;
  source: string;
  assignee_name: string | null;
  reason: string;
  level: "late" | "stuck" | "waiting" | "working";
}
interface MailWaiting {
  case_id: string;
  status: string;
  reason: string | null;
  subject_name: string | null;
  governorate: string | null;
  district: string | null;
  release_at: string | null;
  client_name: string | null;
  received_at: string;
}
interface FollowUp {
  cases: OpenCase[];
  mail_cases: MailWaiting[];
  counts: Record<"late" | "stuck" | "waiting" | "working" | "mail", number>;
}
interface Coverage {
  governorates: { name: string; investigators: number; whole: number; cases: number; unassigned: number }[];
  uncovered_governorates: number;
  uncovered_districts: { governorate: string; district: string; cases: number; unassigned: number }[];
}
interface Person {
  user_id: string;
  full_name: string;
  status: string;
  active: number;
  governorate: string | null;
}

const LEVELS: { key: OpenCase["level"] | "all"; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "stuck", label: "لم يقبلها أحد" },
  { key: "late", label: "متأخرة" },
  { key: "waiting", label: "في الانتظار" },
  { key: "working", label: "قيد التنفيذ" },
];
const when = (value: string | null) => (value ? new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "—");

function Resend({ item, people, onDone }: { item: OpenCase; people: Person[]; onDone: () => void }) {
  const [choosing, setChoosing] = useState(false);
  const [user, setUser] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = item.status === "open" || item.status === "unassigned";

  async function run(path: string, body: object) {
    setBusy(true);
    setError("");
    try {
      await api(`/investigations/${item.investigation_id}/${path}`, { method: "POST", body: JSON.stringify(body) });
      setChoosing(false);
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر التنفيذ.");
    } finally {
      setBusy(false);
    }
  }
  // Investigators in the case's governorate first.
  const sorted = [...people].sort(
    (a, b) => Number(b.governorate === item.governorate) - Number(a.governorate === item.governorate) || a.active - b.active,
  );
  return (
    <div className="resend">
      {choosing ? (
        <>
          <select value={user} onChange={(event) => setUser(event.target.value)}>
            <option value="">اختر مستعلمًا</option>
            {sorted.map((person) => (
              <option key={person.user_id} value={person.user_id}>
                {person.full_name}
                {person.governorate ? ` · ${person.governorate}` : ""} · نشط {number(person.active)}
              </option>
            ))}
          </select>
          <button
            className="btn small btn-primary"
            disabled={busy || !user}
            onClick={() => void run("assign", { user_id: user, reason: `إعادة إرسال من المتابعة: ${item.reason}`.slice(0, 500) })}
          >
            إرسال
          </button>
          <button className="btn small ghost" onClick={() => setChoosing(false)}>
            تراجع
          </button>
        </>
      ) : (
        <>
          {open && (
            <button className="btn small" disabled={busy} onClick={() => void run("redispatch", {})} title="يُعرض من جديد على مستعلمي المنطقة">
              <Icon name="refresh" size={14} /> تلقائي
            </button>
          )}
          <button className="btn small ghost" disabled={busy} onClick={() => setChoosing(true)}>
            {open ? "لمستعلم محدد" : "نقل لمستعلم آخر"}
          </button>
        </>
      )}
      {error && <small className="row-reason bad">{error}</small>}
    </div>
  );
}

export function FollowUpPage() {
  const [data, setData] = useState<FollowUp | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [level, setLevel] = useState<OpenCase["level"] | "all">("all");
  const [showAllGov, setShowAllGov] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<FollowUp>("/investigations/follow-up")
      .then(setData)
      .catch(() => setError("تعذّر تحميل المتابعة."));
    api<Coverage>("/investigations/coverage")
      .then(setCoverage)
      .catch(() => setError("تعذّر تحميل التغطية."));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    api<{ investigators: Person[] }>("/investigations/dispatch/overview")
      .then((d) => setPeople(d.investigators.filter((p) => p.status === "active")))
      .catch(() => undefined);
  }, []);

  const shown = (data?.cases ?? []).filter((c) => level === "all" || c.level === level);
  const governorates = (coverage?.governorates ?? []).filter((g) => showAllGov || g.investigators === 0 || g.unassigned > 0);

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            مساحة العمل <span>/</span> المتابعة
          </p>
          <h1>
            ما لم يُنجز بعد. <span>ولماذا، ومن يغطي كل منطقة.</span>
          </h1>
          <p className="page-description">
            كل استعلام لم يُعتمد تقريره بعد مع سبب تأخره، وإعادة إرساله تلقائيًا أو لمستعلم بعينه، ثم المحافظات والمراكز التي لا يغطيها أي مستعلم.
          </p>
        </div>
        <button className="btn ghost" onClick={load}>
          <Icon name="refresh" size={16} /> تحديث
        </button>
      </div>
      <ErrorMessage message={error} />

      <div className="metrics-grid">
        {[
          { label: "لم يقبلها أحد", value: data?.counts.stuck ?? 0, hint: "تحتاج إعادة إرسال" },
          { label: "متأخرة", value: data?.counts.late ?? 0, hint: "تجاوزت الموعد النهائي" },
          { label: "في الانتظار", value: data?.counts.waiting ?? 0, hint: "عرض أو مراجعة" },
          { label: "من البريد ولم تُنشأ", value: data?.counts.mail ?? 0, hint: "مراجعة أو مجدولة أو فشلت" },
          { label: "محافظات بلا مستعلم", value: coverage?.uncovered_governorates ?? 0, hint: `${number(coverage?.uncovered_districts.filter((d) => d.cases).length ?? 0)} مركز عليه طلب بلا تغطية` },
        ].map((card) => (
          <article className="glass metric" key={card.label}>
            <div className="metric-top">
              <span>{card.label}</span>
            </div>
            <strong>{number(card.value)}</strong>
            <p>
              <span className="small-indicator" />
              {card.hint}
            </p>
          </article>
        ))}
      </div>

      <section className="glass panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">لم تُنجز بعد</p>
            <h2>الاستعلامات المفتوحة وسبب كل منها</h2>
          </div>
          <div className="segmented">
            {LEVELS.map((item) => (
              <button key={item.key} type="button" className={level === item.key ? "active" : ""} onClick={() => setLevel(item.key)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>العميل / الجهة</th>
                <th>المنطقة</th>
                <th>الموعد</th>
                <th>السبب</th>
                <th>إعادة الإرسال</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <tr key={item.investigation_id} className={`followup-${item.level}`}>
                  <td>
                    <Link to={`/investigations?case=${item.investigation_id}`} className="mono">
                      {item.reference}
                    </Link>
                    {item.source === "email" && <small className="row-reason">من البريد</small>}
                  </td>
                  <td>
                    {item.subject_name}
                    <small className="row-reason">{item.client_name}</small>
                  </td>
                  <td>{[item.governorate, item.district].filter(Boolean).join(" - ") || "—"}</td>
                  <td>{when(item.due_at)}</td>
                  <td>
                    <span className={`reason-tag ${item.level}`}>{item.reason}</span>
                  </td>
                  <td>{item.status !== "submitted" && <Resend item={item} people={people} onDone={load} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!shown.length && <Empty>لا يوجد شيء هنا.</Empty>}
      </section>

      {!!data?.mail_cases.length && (
        <section className="glass panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">من البريد</p>
              <h2>طلبات وصلت ولم تصبح استعلامات بعد</h2>
            </div>
            <Link className="btn small" to="/inbox">
              فتح البريد الوارد
            </Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>وصل</th>
                  <th>الاسم / الجهة</th>
                  <th>المنطقة</th>
                  <th>السبب</th>
                </tr>
              </thead>
              <tbody>
                {data.mail_cases.map((item) => (
                  <tr key={item.case_id}>
                    <td>{when(item.received_at)}</td>
                    <td>
                      {item.subject_name ?? "—"}
                      <small className="row-reason">{item.client_name}</small>
                    </td>
                    <td>{[item.governorate, item.district].filter(Boolean).join(" - ") || "—"}</td>
                    <td>
                      <span className={`reason-tag ${item.status === "failed" ? "stuck" : item.status === "ready" ? "waiting" : "late"}`}>
                        {item.status === "ready" ? `مجدولة: ${when(item.release_at)}` : (item.reason ?? "تحتاج مراجعة")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="glass panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">التغطية</p>
            <h2>المحافظات والمراكز بلا مستعلمين</h2>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={showAllGov} onChange={(event) => setShowAllGov(event.target.checked)} />
            عرض كل المحافظات
          </label>
        </div>
        <div className="coverage-grid">
          {governorates.map((g) => (
            <div key={g.name} className={`coverage-cell ${g.investigators ? "" : "none"}`}>
              <strong>{g.name}</strong>
              <span>{g.investigators ? `${number(g.investigators)} مستعلم` : "لا يوجد مستعلم"}</span>
              <small>
                {number(g.cases)} استعلام خلال 90 يومًا{g.unassigned ? ` · ${number(g.unassigned)} لم يقبلها أحد` : ""}
              </small>
            </div>
          ))}
          {!governorates.length && <Empty>كل المحافظات فيها مستعلم واحد على الأقل.</Empty>}
        </div>
        <h3 className="coverage-sub">مراكز لا يغطيها أحد {coverage ? `(${number(coverage.uncovered_districts.length)})` : ""}</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>المحافظة</th>
                <th>المركز / الحي</th>
                <th>استعلامات خلال 90 يومًا</th>
                <th>لم يقبلها أحد الآن</th>
              </tr>
            </thead>
            <tbody>
              {(coverage?.uncovered_districts ?? []).slice(0, 150).map((d) => (
                <tr key={`${d.governorate}|${d.district}`} className={d.cases ? "followup-stuck" : ""}>
                  <td>{d.governorate}</td>
                  <td>{d.district}</td>
                  <td>{number(d.cases)}</td>
                  <td>{number(d.unassigned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
