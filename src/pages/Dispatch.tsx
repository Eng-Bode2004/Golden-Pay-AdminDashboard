import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiRequestError } from "../api";
import { LocationFields, type AreaNames } from "../components/AreaPicker";
import { minutesLabel } from "../components/Timing";
import { Avatar, date, Empty, ErrorMessage, Icon, number } from "../components/ui";

interface Policy {
  engine: "fair_broadcast" | "sequential" | "shadow";
  score_mode: "assignments" | "hybrid";
  window_days: number;
  active_weight: number;
  offer_minutes: number | null;
  max_active: number;
  manual_counts: boolean;
  newcomer_boost: boolean;
}

interface Investigator {
  user_id: string;
  full_name: string;
  employee_number: string | null;
  status: string;
  available: boolean;
  governorate: string | null;
  district: string | null;
  areas: number;
  newcomer: boolean;
  recent: number;
  total: number;
  completed: number;
  cancelled: number;
  reassigned_away: number;
  manual: number;
  active: number;
  open_offers: number;
  declined: number;
  expired: number;
  taken: number;
  avg_response_minutes: number | null;
  score: number;
}

interface Waiting {
  investigation_id: string;
  reference: string;
  status: string;
  subject_name: string;
  governorate: string | null;
  district: string | null;
  created_at: string;
  due_at: string | null;
  open_offers: number;
  expires_at: string | null;
  last_outcome: string | null;
}

interface Overview {
  policy: Policy;
  investigators: Investigator[];
  waiting: Waiting[];
  imbalance: { spread: number; stddev: number };
  exclusion_labels: Record<string, string>;
  metrics: {
    avg_minutes_to_assignment: number | null;
    pct_within_window: number | null;
    assigned: number;
    offers: { accepted: number; declined: number; expired: number; taken: number; open: number; acceptance_rate: number | null };
    conflicts: number;
    manual_interventions: number;
    escalations: number;
    excluded_by_workload: number;
    unassigned: number;
    waiting: number;
  };
}

interface Attempt {
  attempt_id: string;
  round: number;
  engine: string;
  shadow: boolean;
  tier: number | null;
  min_score: number | null;
  pool_size: number;
  offered: string[];
  eligible: { user_id: string; score: number; raw: number; active: number; tier: number; newcomer: boolean }[];
  excluded: { user_id: string; reason: string }[];
  outcome: string;
  created_at: string;
}

interface Decisions {
  attempts: Attempt[];
  ledger: {
    source: string;
    counts: boolean;
    assigned_at: string;
    ended_at: string | null;
    end_reason: string | null;
    note: string | null;
    full_name: string;
    assigned_by_name: string | null;
  }[];
  names: Record<string, { full_name: string; employee_number: string | null }>;
  exclusion_labels: Record<string, string>;
}

const ENGINES: Record<Policy["engine"], { label: string; hint: string }> = {
  fair_broadcast: { label: "توزيع عادل للجميع", hint: "يُرسل لكل المؤهلين الأقل حصولًا على استعلامات، وأول من يقبل يأخذه." },
  shadow: { label: "تجربة (ظل)", hint: "يعمل بالتوزيع القديم ويسجّل ما كان سيفعله التوزيع العادل للمقارنة." },
  sequential: { label: "التوزيع القديم", hint: "مستعلم واحد في كل مرة (للرجوع عند الحاجة)." },
};

const OUTCOMES: Record<string, string> = {
  offered: "عُرض",
  waiting: "بانتظار مستعلم متاح",
  exhausted: "لم يقبله أحد — يحتاج تدخلًا",
  shadow: "تجربة",
};

const SOURCES: Record<string, string> = {
  accepted: "قبِل العرض",
  preferred: "المستعلم المختار",
  manual: "إسناد يدوي",
  backfill: "قبل نظام العدالة",
};

const END_REASONS: Record<string, string> = {
  completed: "اكتمل",
  cancelled: "أُلغي",
  reassigned: "نُقل لمستعلم آخر",
};

function PolicyPanel({ policy, onSaved }: { policy: Policy; onSaved: (policy: Policy) => void }) {
  const [draft, setDraft] = useState(policy);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setDraft(policy), [policy]);
  const changed = JSON.stringify(draft) !== JSON.stringify(policy);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const data = await api<{ policy: Policy }>("/investigations/dispatch/policy", {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      onSaved(data.policy);
      setMessage("تم الحفظ. يُطبَّق على الخطوة التالية لكل استعلام.");
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass panel dispatch-policy">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">سياسة التوزيع</p>
          <h2>كيف تصل الاستعلامات للمستعلمين</h2>
        </div>
        <Icon name="shield" size={20} />
      </div>
      <div className="segmented engine-switch" role="radiogroup" aria-label="طريقة التوزيع">
        {(Object.keys(ENGINES) as Policy["engine"][]).map((engine) => (
          <button
            key={engine}
            type="button"
            role="radio"
            aria-checked={draft.engine === engine}
            className={draft.engine === engine ? "active" : ""}
            onClick={() => setDraft({ ...draft, engine })}
          >
            {ENGINES[engine].label}
          </button>
        ))}
      </div>
      <p className="field-hint">{ENGINES[draft.engine].hint}</p>
      <div className="form-row">
        <label className="field">
          <span>يُحسب عدد الاستعلامات خلال (يوم)</span>
          <input
            type="number"
            min={1}
            max={365}
            value={draft.window_days}
            onChange={(event) => setDraft({ ...draft, window_days: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>أقصى عدد استعلامات نشطة للمستعلم</span>
          <input
            type="number"
            min={1}
            max={50}
            value={draft.max_active}
            onChange={(event) => setDraft({ ...draft, max_active: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>مهلة القبول (دقيقة)</span>
          <input
            type="number"
            min={1}
            max={1440}
            placeholder="حسب نوع الاستعلام"
            value={draft.offer_minutes ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, offer_minutes: event.target.value === "" ? null : Number(event.target.value) })
            }
          />
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          <span>طريقة حساب الدور</span>
          <select
            value={draft.score_mode}
            onChange={(event) => setDraft({ ...draft, score_mode: event.target.value as Policy["score_mode"] })}
          >
            <option value="assignments">عدد الاستعلامات المسندة فقط</option>
            <option value="hybrid">الاستعلامات المسندة + العمل الجاري</option>
          </select>
        </label>
        {draft.score_mode === "hybrid" && (
          <label className="field">
            <span>وزن الاستعلام الجاري</span>
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={draft.active_weight}
              onChange={(event) => setDraft({ ...draft, active_weight: Number(event.target.value) })}
            />
          </label>
        )}
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={draft.manual_counts}
          onChange={(event) => setDraft({ ...draft, manual_counts: event.target.checked })}
        />
        الإسناد اليدوي يُحتسب في دور المستعلم
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={draft.newcomer_boost}
          onChange={(event) => setDraft({ ...draft, newcomer_boost: event.target.checked })}
        />
        المستعلم الجديد يبدأ قبل الأقل بدرجة (لا من الصفر)
      </label>
      {message && <p className="hint">{message}</p>}
      <button className="btn btn-primary" disabled={!changed || busy} onClick={() => void save()}>
        <Icon name="check" size={16} />
        {busy ? "جارٍ الحفظ…" : "حفظ السياسة"}
      </button>
    </section>
  );
}

/** Why a case went to whom, and a manual assignment with a reason. */
function CaseDecisions({
  item,
  investigators,
  onChanged,
}: {
  item: Waiting;
  investigators: Investigator[];
  onChanged: () => void;
}) {
  const [data, setData] = useState<Decisions | null>(null);
  const [error, setError] = useState("");
  const [assignee, setAssignee] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setData(null);
    api<Decisions>(`/investigations/${item.investigation_id}/dispatch`)
      .then(setData)
      .catch(() => setError("تعذّر تحميل قرارات التوزيع."));
  }, [item.investigation_id]);

  const name = (id: string) => data?.names[id]?.full_name ?? id;

  async function assign() {
    setBusy(true);
    setError("");
    try {
      await api(`/investigations/${item.investigation_id}/assign`, {
        method: "POST",
        body: JSON.stringify({ user_id: assignee, reason: reason.trim() }),
      });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر الإسناد.");
      setBusy(false);
    }
  }

  return (
    <div className="dispatch-decisions">
      <ErrorMessage message={error} />
      {!data && !error && <span className="image-skeleton" />}
      {data && !data.attempts.length && <p className="hint">لم يُسجَّل أي قرار توزيع لهذا الاستعلام بعد.</p>}
      {data?.attempts.map((attempt) => (
        <article key={attempt.attempt_id} className={`decision${attempt.shadow ? " shadow" : ""}`}>
          <header>
            <strong>{OUTCOMES[attempt.outcome] ?? attempt.outcome}</strong>
            <span className="badge">جولة {number(attempt.round)}</span>
            {attempt.min_score !== null && <span className="badge">أقل دور {number(attempt.min_score)}</span>}
            <small>{date(attempt.created_at)}</small>
          </header>
          {attempt.offered.length > 0 && (
            <p>
              <b>عُرض على:</b> {attempt.offered.map(name).join("، ")}
            </p>
          )}
          {attempt.eligible.length > 0 && (
            <p className="decision-list">
              <b>المؤهلون ودورهم:</b>{" "}
              {attempt.eligible
                .slice()
                .sort((a, b) => a.score - b.score)
                .map((entry) => `${name(entry.user_id)} (${number(entry.score)}${entry.newcomer ? "، جديد" : ""})`)
                .join("، ")}
            </p>
          )}
          {attempt.excluded.length > 0 && (
            <p className="decision-list muted">
              <b>استُبعد:</b>{" "}
              {attempt.excluded
                .map((entry) => `${name(entry.user_id)} — ${data.exclusion_labels[entry.reason] ?? entry.reason}`)
                .join("، ")}
            </p>
          )}
        </article>
      ))}
      {data && data.ledger.length > 0 && (
        <div className="decision ledger">
          <header>
            <strong>سجل الإسناد</strong>
          </header>
          {data.ledger.map((row) => (
            <p key={row.assigned_at}>
              {row.full_name} — {SOURCES[row.source] ?? row.source}
              {row.end_reason && ` · ${END_REASONS[row.end_reason] ?? row.end_reason}`}
              {!row.counts && " · لا يُحتسب في الدور"}
              {row.note && ` · ${row.note}`}
            </p>
          ))}
        </div>
      )}
      <div className="manual-assign">
        <label className="field">
          <span>إسناد يدوي</span>
          <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">اختر مستعلمًا</option>
            {investigators
              .filter((person) => person.status === "active")
              .map((person) => (
                <option key={person.user_id} value={person.user_id}>
                  {person.full_name} — دوره {number(person.score)} · نشط {number(person.active)}
                  {person.governorate ? ` · ${person.governorate}` : ""}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          <span>السبب (يُسجَّل في سجل النشاط)</span>
          <input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        </label>
        <button className="btn btn-primary" disabled={busy || !assignee || reason.trim().length < 3} onClick={() => void assign()}>
          {busy ? "جارٍ الإسناد…" : "إسناد"}
        </button>
      </div>
    </div>
  );
}

/** Extra areas an investigator serves (the primary one follows the app). */
function ServiceAreas({ userId }: { userId: string }) {
  const [areas, setAreas] = useState<
    { area_id: string; is_primary: boolean; governorate: string; district: string | null; local_unit: string | null; main_village: string | null; sub_village: string | null; active: boolean }[]
  >([]);
  const [draft, setDraft] = useState<AreaNames>({});
  const [error, setError] = useState("");
  const load = useCallback(() => {
    api<{ areas: typeof areas }>(`/investigators/${userId}/areas`)
      .then((data) => setAreas(data.areas))
      .catch(() => setError("تعذّر تحميل المناطق."));
  }, [userId]);
  useEffect(load, [load]);

  async function add() {
    setError("");
    try {
      await api(`/investigators/${userId}/areas`, { method: "POST", body: JSON.stringify(draft) });
      setDraft({});
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّرت الإضافة.");
    }
  }
  async function remove(areaId: string) {
    setError("");
    try {
      await api(`/investigators/${userId}/areas/${areaId}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر الحذف.");
    }
  }

  return (
    <div className="service-areas">
      <ErrorMessage message={error} />
      <ul>
        {areas
          .filter((area) => area.active)
          .map((area) => (
            <li key={area.area_id}>
              {[area.governorate, area.district, area.local_unit, area.main_village, area.sub_village].filter(Boolean).join(" - ")}
              {area.is_primary ? (
                <span className="badge">الأساسية (من التطبيق)</span>
              ) : (
                <button className="btn ghost btn-danger btn-small" onClick={() => void remove(area.area_id)}>
                  إزالة
                </button>
              )}
            </li>
          ))}
      </ul>
      <LocationFields value={draft} onChange={setDraft} />
      <button className="btn ghost" disabled={!draft.governorate} onClick={() => void add()}>
        <Icon name="plus" size={15} /> إضافة منطقة يخدمها
      </button>
    </div>
  );
}

export function DispatchPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [openCase, setOpenCase] = useState<string | null>(null);
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    api<Overview>("/investigations/dispatch/overview")
      .then((next) => {
        setData(next);
        setError("");
      })
      .catch(() => setError("تعذّر تحميل بيانات التوزيع."));
  }, []);
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  /** Per governorate, the lowest score among those who could get the next offer. */
  const nextInLine = useMemo(() => {
    const lowest = new Map<string, number>();
    for (const person of data?.investigators ?? []) {
      if (person.status !== "active" || !person.available || person.active >= (data?.policy.max_active ?? 1)) continue;
      const key = person.governorate ?? "";
      lowest.set(key, Math.min(lowest.get(key) ?? Infinity, person.score));
    }
    return lowest;
  }, [data]);

  const people = (data?.investigators ?? []).filter(
    (person) => !search.trim() || `${person.full_name} ${person.employee_number ?? ""} ${person.governorate ?? ""} ${person.district ?? ""}`.includes(search.trim()),
  );
  const metrics = data?.metrics;

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            مساحة العمل <span>/</span> التوزيع والعدالة
          </p>
          <h1>
            كل استعلام لمن عليه الدور. <span>وأول من يقبل يأخذه.</span>
          </h1>
          <p className="page-description">
            يُعرض الاستعلام على كل المستعلمين المؤهلين في المنطقة الأقل حصولًا على استعلامات خلال آخر{" "}
            {number(data?.policy.window_days ?? 30)} يومًا. الرفض وانتهاء المهلة وقبول غيره أولًا لا تُحتسب على أحد.
          </p>
        </div>
        <button className="btn ghost" onClick={load}>
          <Icon name="refresh" size={16} /> تحديث
        </button>
      </div>
      <ErrorMessage message={error} />

      <div className="metrics-grid">
        {[
          { label: "متوسط وقت الإسناد", value: minutesLabel(metrics?.avg_minutes_to_assignment ?? null), hint: `${number(metrics?.assigned ?? 0)} استعلام خلال 30 يومًا` },
          { label: "أُسند خلال المهلة الأولى", value: metrics?.pct_within_window == null ? "—" : `${number(Math.round(metrics.pct_within_window))}٪`, hint: "من وقت الإرسال حتى القبول" },
          { label: "نسبة قبول العروض", value: metrics?.offers.acceptance_rate == null ? "—" : `${number(metrics.offers.acceptance_rate)}٪`, hint: `${number(metrics?.offers.declined ?? 0)} رفض · ${number(metrics?.offers.expired ?? 0)} انتهت مهلته` },
          { label: "تفاوت التوزيع", value: number(data?.imbalance.spread ?? 0), hint: `الانحراف المعياري ${number(data?.imbalance.stddev ?? 0)} (صفر = متساوٍ)` },
          { label: "بانتظار مستعلم", value: number((metrics?.waiting ?? 0) + (metrics?.unassigned ?? 0)), hint: `${number(metrics?.unassigned ?? 0)} لم يقبلها أحد` },
          { label: "قبول متزامن", value: number(metrics?.conflicts ?? 0), hint: "حاول القبول بعد أن قبِله غيره" },
          { label: "تدخل يدوي", value: number(metrics?.manual_interventions ?? 0), hint: "إسناد أو نقل أو إعادة توزيع" },
          { label: "استُبعدوا لكثرة العمل", value: number(metrics?.excluded_by_workload ?? 0), hint: `الحد ${number(data?.policy.max_active ?? 1)} استعلام نشط` },
        ].map((card) => (
          <article className="glass metric" key={card.label}>
            <div className="metric-top">
              <span>{card.label}</span>
            </div>
            <strong>{card.value}</strong>
            <p>
              <span className="small-indicator" />
              {card.hint}
            </p>
          </article>
        ))}
      </div>

      {data && <PolicyPanel policy={data.policy} onSaved={(policy) => setData({ ...data, policy })} />}

      <section className="glass panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">بانتظار الإسناد</p>
            <h2>استعلامات لم يقبلها أحد بعد</h2>
          </div>
          <Icon name="clock" size={20} />
        </div>
        {data && !data.waiting.length && <Empty>كل الاستعلامات مسندة.</Empty>}
        {data?.waiting.map((item) => (
          <div key={item.investigation_id} className="waiting-row">
            <button className="waiting-head" onClick={() => setOpenCase(openCase === item.investigation_id ? null : item.investigation_id)}>
              <span className="mono">{item.reference}</span>
              <strong>{item.subject_name}</strong>
              <small>{[item.governorate, item.district].filter(Boolean).join(" - ")}</small>
              <span className={item.status === "unassigned" ? "badge badge-danger" : "badge"}>
                {item.status === "unassigned"
                  ? "لم يقبله أحد"
                  : item.open_offers
                    ? `معروض على ${number(item.open_offers)}`
                    : OUTCOMES[item.last_outcome ?? ""] ?? "قيد التوزيع"}
              </span>
              <Icon name="chevron" size={15} />
            </button>
            {openCase === item.investigation_id && (
              <>
                <Link to={`/investigations?case=${item.investigation_id}`} className="link-small">
                  فتح الاستعلام
                </Link>
                <CaseDecisions
                  item={item}
                  investigators={data.investigators}
                  onChanged={() => {
                    setOpenCase(null);
                    load();
                  }}
                />
              </>
            )}
          </div>
        ))}
      </section>

      <section className="glass panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">المستعلمون</p>
            <h2>الدور وحجم العمل</h2>
          </div>
          <label className="search-field">
            <Icon name="search" size={15} />
            <input placeholder="بحث بالاسم أو المنطقة" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>المستعلم</th>
                <th>المنطقة</th>
                <th>الحالة</th>
                <th>الدور</th>
                <th>نشط</th>
                <th>الإجمالي</th>
                <th>اكتمل</th>
                <th>أُلغي</th>
                <th>رفض</th>
                <th>انتهت مهلته</th>
                <th>قبِله غيره</th>
                <th>زمن الرد</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person, index) => {
                const next =
                  person.status === "active" &&
                  person.available &&
                  person.active < (data?.policy.max_active ?? 1) &&
                  nextInLine.get(person.governorate ?? "") === person.score;
                return [
                  <tr key={person.user_id} className={next ? "next-in-line" : undefined}>
                    <td>
                      <Link to={`/people/${person.user_id}`} className="person-cell">
                        <Avatar name={person.full_name} small color={index} />
                        <div>
                          <strong>{person.full_name}</strong>
                          <small>{person.employee_number ?? "—"}</small>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <button className="link-small" onClick={() => setOpenPerson(openPerson === person.user_id ? null : person.user_id)}>
                        {[person.governorate, person.district].filter(Boolean).join(" - ") || "—"}
                        {person.areas > 1 && ` (+${number(person.areas - 1)})`}
                      </button>
                    </td>
                    <td>
                      {person.status !== "active" ? (
                        <span className="badge badge-danger">موقوف</span>
                      ) : !person.available ? (
                        <span className="badge">غير متاح</span>
                      ) : next ? (
                        <span className="badge badge-ok">عليه الدور</span>
                      ) : (
                        <span className="badge">متاح</span>
                      )}
                      {person.newcomer && <span className="badge">جديد</span>}
                    </td>
                    <td>
                      <strong>{number(person.score)}</strong>
                    </td>
                    <td>{number(person.active)}</td>
                    <td>{number(person.total)}</td>
                    <td>{number(person.completed)}</td>
                    <td>{number(person.cancelled)}</td>
                    <td>{number(person.declined)}</td>
                    <td>{number(person.expired)}</td>
                    <td>{number(person.taken)}</td>
                    <td>{minutesLabel(person.avg_response_minutes)}</td>
                  </tr>,
                  openPerson === person.user_id ? (
                    <tr key={`${person.user_id}-areas`}>
                      <td colSpan={12}>
                        <ServiceAreas userId={person.user_id} />
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>
        </div>
        {data && !people.length && <Empty>لا يوجد مستعلمون مطابقون.</Empty>}
      </section>
    </div>
  );
}
