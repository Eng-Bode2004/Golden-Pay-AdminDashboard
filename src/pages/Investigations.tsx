import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { api, apiBlob, ApiRequestError } from "../api";
import { SecureImage } from "../components/ReviewDrawer";
import { money } from "../components/Finance";
import { between, EVENT_LABEL, minutesLabel, OFFER_RESPONSE, Stamp } from "../components/Timing";
import { TRAIL_LABEL, type TrailPoint } from "../components/TrailMap";
import { date, Empty, ErrorMessage, Icon, number } from "../components/ui";

// The map library loads only when a case with a location trail is opened.
const TrailMap = lazy(() => import("../components/TrailMap"));

const distanceKm = (a: [number, number], b: [number, number]) => {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b[0] - a[0]) * rad) / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(((b[1] - a[1]) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

interface Row {
  investigation_id: string;
  reference: string;
  status: string;
  target_mode: string;
  subject_name: string;
  address: string;
  governorate: string | null;
  district: string | null;
  client_name: string;
  form_title: string;
  pdf_status: string;
  created_at: string;
  assignee_name: string | null;
  recipients: number;
  service_name: string | null;
  offered_to: string | null;
  offer_expires_at: string | null;
  outcome: string;
  due_at: string | null;
  client_price: number;
  investigator_price: number;
}

const OPEN = ["open", "assigned", "in_progress", "returned"];
const overdue = (row: Row) => Boolean(row.due_at && OPEN.includes(row.status) && new Date(row.due_at) < new Date());

function Deadline({ row }: { row: Row }) {
  if (!row.due_at) return <>—</>;
  return (
    <span className={overdue(row) ? "deadline late" : "deadline"}>
      <Icon name="clock" size={13} />
      {date(row.due_at)}
    </span>
  );
}
interface Field {
  key: string;
  label: string;
  type: string;
  statement?: string;
  columns?: { key: string; label: string }[];
}

/** What the reviewer sees before approving: gaps, unsupported statements, the template used. */
interface CaseCheck {
  issues: { key: string; label: string; message: string }[];
  report_issues: { kind: string; label: string; message: string }[];
  report_layout: string | null;
  report_error: string | null;
  template: { version_no: number | null; layout_mode: string; title: string; matches: boolean };
  evidence: { photos: Record<string, number>; locations: number };
}

function AnswerValue({ field, value }: { field: Field; value: unknown }) {
  if (field.type === "attestation") {
    return <span className="answer-statement">✓ {field.statement ?? field.label}</span>;
  }
  if (field.type === "table" && Array.isArray(value)) {
    const columns = field.columns ?? [];
    return (
      <table className="answer-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(value as Record<string, unknown>[]).map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.key}>{row[column.key] === undefined ? "—" : String(row[column.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (Array.isArray(value)) return <>{value.map(String).join("، ")}</>;
  return <>{String(value)}</>;
}

const REPORT_ISSUE: Record<string, string> = {
  missing: "ناقص",
  unsupported_statement: "حُذفت لعدم وجود دليل",
  unconfirmed_statement: "لم تُؤكَّد",
  unplaced: "في ملحق التقرير",
  awaiting_approval: "بعد الاعتماد",
};
interface Detail extends Row {
  sections: { title: string; fields: Field[] }[];
  answers: Record<string, unknown>;
  images: { image_id: string; field_key: string }[];
  review_note: string | null;
  landmark: string | null;
  submit_lat: number | null;
  submit_lng: number | null;
  submitted_at: string | null;
  assignee: { full_name: string; employee_number: string | null; phone: string } | null;
  claimed_at: string | null;
  lat: number | null;
  lng: number | null;
  negative_reasons: string[] | null;
  negative_note: string | null;
  locations?: TrailPoint[];
  created_at: string;
  reviewed_at: string | null;
  events?: { type: string; note: string | null; created_at: string; user_name: string | null; actor_name: string | null }[];
  offers?: {
    tier_label: string;
    round: number;
    offered_at: string;
    expires_at: string;
    seen_at: string | null;
    responded_at: string | null;
    response: string | null;
    reason: string | null;
    full_name: string;
    employee_number: string | null;
  }[];
}

const STATUS: Record<string, string> = {
  open: "بانتظار القبول",
  unassigned: "لم يقبله أحد",
  assigned: "مسند",
  in_progress: "قيد التنفيذ",
  submitted: "بانتظار المراجعة",
  returned: "معاد للتعديل",
  approved: "معتمد",
  cancelled: "ملغي",
};
const TABS = ["", "submitted", "open", "unassigned", "assigned", "in_progress", "returned", "approved"];

function CaseStatus({ status }: { status: string }) {
  return (
    <span className={`badge case-${status}`}>
      <i />
      {STATUS[status] ?? status}
    </span>
  );
}

function CaseDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [item, setItem] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState("");
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [check, setCheck] = useState<CaseCheck | null>(null);
  const panel = useRef<HTMLElement>(null);

  async function load() {
    try {
      const data = await api<{ investigation: Detail }>(`/investigations/${id}`);
      setItem(data.investigation);
    } catch {
      setError("تعذّر تحميل الاستعلام.");
    }
  }
  useEffect(() => {
    void load();
    panel.current?.focus();
  }, [id]);
  useEffect(() => {
    if (!item?.submitted_at || item.pdf_status === "generating") return;
    api<CaseCheck>(`/investigations/${id}/check`)
      .then(setCheck)
      .catch(() => setCheck(null));
  }, [id, item?.submitted_at, item?.pdf_status, item?.status]);
  useEffect(() => {
    if (item?.pdf_status !== "generating") return;
    const timer = window.setTimeout(() => void load(), 1800);
    return () => window.clearTimeout(timer);
  }, [item]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomed((current) => (current ? null : (onClose(), null)));
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);

  async function act(path: string, body: object = {}) {
    setBusy(true);
    setError("");
    try {
      await api(`/investigations/${id}/${path}`, { method: "POST", body: JSON.stringify(body) });
      onChanged();
      await load();
      setReturning(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر تنفيذ الإجراء.");
    } finally {
      setBusy(false);
    }
  }

  async function openPdf(kind: "pdf" | "report.docx" = "pdf") {
    try {
      const url = URL.createObjectURL(await apiBlob(`/investigations/${id}/${kind}`));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${item?.reference}.${kind === "pdf" ? "pdf" : "docx"}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError("تعذّر تنزيل التقرير.");
    }
  }

  const submitted = item?.status === "submitted";
  const cancellable = item && ["open", "unassigned", "assigned", "in_progress", "returned"].includes(item.status);
  const accepted = item?.offers?.find((offer) => offer.response === "accepted");

  return createPortal(
    <div className="drawer-root" dir={document.documentElement.dir}>
      <button className="drawer-scrim" aria-label="إغلاق" onClick={onClose} />
      <aside className="review-drawer case-drawer" role="dialog" aria-modal="true" aria-label="تفاصيل الاستعلام" tabIndex={-1} ref={panel}>
        <header className="drawer-head">
          <div>
            <span className="eyebrow mono">{item?.reference ?? "…"}</span>
            <h2>{item?.subject_name ?? "…"}</h2>
          </div>
          <button className="icon-button" aria-label="إغلاق" onClick={onClose}>
            <Icon name="close" size={17} />
          </button>
        </header>
        <div className="drawer-body">
          <ErrorMessage message={error} />
          {item && (
            <>
              <section className="case-summary">
                <span className="status-line">
                  <CaseStatus status={item.status} />
                  {item.outcome === "negative" && item.submitted_at && <span className="badge negative-badge">استعلام سلبي</span>}
                </span>
                <p>
                  {item.client_name} · {item.form_title}
                </p>
                <small>{item.address}</small>
                {item.assignee && (
                  <small>
                    المستعلم: {item.assignee.full_name}
                    {item.assignee.employee_number ? ` (${item.assignee.employee_number})` : ""}
                  </small>
                )}
                {item.review_note && <small className="case-note">ملاحظة المراجع: {item.review_note}</small>}
                <dl className="case-money">
                  <div>
                    <dt>النوع</dt>
                    <dd>{item.service_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>الموعد النهائي</dt>
                    <dd>
                      <Deadline row={item} />
                    </dd>
                  </div>
                  <div>
                    <dt>سعر العميل</dt>
                    <dd>{money(item.client_price)}</dd>
                  </div>
                  <div>
                    <dt>أجر المستعلم</dt>
                    <dd>{money(item.investigator_price)}</dd>
                  </div>
                </dl>
              </section>
              {item.submitted_at && (
                <section className="pdf-card">
                  <Icon name="file" size={24} />
                  <div>
                    <strong>تقرير PDF</strong>
                    <small>
                      {item.pdf_status === "ready"
                        ? "جاهز للتنزيل"
                        : item.pdf_status === "failed"
                          ? "تعذّر إنشاء التقرير"
                          : "جارٍ إنشاء التقرير…"}
                    </small>
                  </div>
                  {item.pdf_status === "ready" ? (
                    <span className="pdf-actions">
                      {check?.report_layout === "docx" && (
                        <button className="btn small" onClick={() => void openPdf("report.docx")}>
                          Word
                        </button>
                      )}
                      <button className="btn small btn-primary" onClick={() => void openPdf()}>
                        تنزيل
                      </button>
                    </span>
                  ) : item.pdf_status === "failed" ? (
                    <button className="btn small" onClick={() => void act("pdf").then(load)}>
                      إعادة المحاولة
                    </button>
                  ) : null}
                </section>
              )}
              {check && (
                <section className={`case-check ${check.issues.length ? "has-issues" : "clean"}`}>
                  <h3>التحقق قبل الاعتماد</h3>
                  <p className="case-check-template">
                    {check.template.title}
                    {check.template.version_no ? ` — الإصدار ${check.template.version_no}` : ""}
                    {check.template.layout_mode === "docx" ? " · بتصميم العميل" : " · التصميم الموحّد"}
                    {!check.template.matches && <b> · لا يطابق الإصدار المعتمد!</b>}
                  </p>
                  {check.report_error && <p className="hint">{check.report_error}</p>}
                  {!check.issues.length && !check.report_issues.some((issue) => issue.kind !== "awaiting_approval") && (
                    <p className="case-check-ok">
                      <Icon name="check" size={15} /> لا بيانات ناقصة، وكل عبارة مطبوعة مدعومة بدليل مسجّل.
                    </p>
                  )}
                  <ul>
                    {check.issues.map((issue, index) => (
                      <li key={`i${index}`} className="bad">
                        {issue.message}
                      </li>
                    ))}
                    {check.report_issues
                      .filter((issue) => issue.kind !== "awaiting_approval")
                      .map((issue, index) => (
                        <li key={`r${index}`} className={`k-${issue.kind}`}>
                          <span>{REPORT_ISSUE[issue.kind] ?? issue.kind}</span>
                          {issue.label.length > 60 ? `${issue.label.slice(0, 58)}…` : issue.label}
                        </li>
                      ))}
                  </ul>
                </section>
              )}
              {item.sections.map((section) => {
                const isImage = (field: Field) => field.type === "photos" || field.type === "signature";
                const rows = section.fields.filter(
                  (field) =>
                    (isImage(field) && item.images.some((image) => image.field_key === field.key)) ||
                    (!isImage(field) && item.answers[field.key] !== undefined && item.answers[field.key] !== "" && item.answers[field.key] !== false),
                );
                if (!rows.length) return null;
                return (
                  <section key={section.title}>
                    <h3>{section.title}</h3>
                    <dl className="review-facts answer-list">
                      {rows.map((field) =>
                        isImage(field) ? (
                          <div className="photo-row" key={field.key}>
                            <dt>{field.label}</dt>
                            <dd className="photo-strip">
                              {item.images
                                .filter((image) => image.field_key === field.key)
                                .map((image) => (
                                  <span className="id-frame" key={image.image_id}>
                                    <SecureImage
                                      path={`/investigations/${id}/images/${image.image_id}`}
                                      alt={field.label}
                                      fallback={<span className="hint">غير متوفرة</span>}
                                      onOpen={setZoomed}
                                    />
                                  </span>
                                ))}
                            </dd>
                          </div>
                        ) : (
                          <div key={field.key}>
                            <dt>{field.label}</dt>
                            <dd>
                              <AnswerValue field={field} value={item.answers[field.key]} />
                            </dd>
                          </div>
                        ),
                      )}
                    </dl>
                  </section>
                );
              })}
              {!item.submitted_at && <p className="hint">لم يُرسل المستعلم تقريره بعد.</p>}
              {item.outcome === "negative" && item.submitted_at && (
                <section className="negative-report">
                  <h3>استعلام سلبي — لم يُعثر على الشخص</h3>
                  <ul>
                    {item.negative_reasons?.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <p>{item.negative_note}</p>
                </section>
              )}
              {!!item.locations?.length && (
                <section>
                  <h3>موقع المستعلم أثناء الاستعلام</h3>
                  <Suspense fallback={<span className="image-skeleton drawer-skeleton" />}>
                    <TrailMap points={item.locations} target={item.lat !== null && item.lng !== null ? [item.lat, item.lng] : null} />
                  </Suspense>
                  <ol className="event-log trail-list">
                    {item.locations.map((point, index) => (
                      <li key={index}>
                        <b>{TRAIL_LABEL[point.kind] ?? point.kind}</b>
                        <a href={`https://maps.google.com/?q=${point.lat},${point.lng}`} target="_blank" rel="noreferrer" dir="ltr">
                          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                        </a>
                        {point.accuracy ? <em> (±{Math.round(point.accuracy)} م)</em> : null}
                        {item.lat !== null && item.lng !== null && (
                          <em> — يبعد {distanceKm([point.lat, point.lng], [item.lat, item.lng]).toFixed(1)} كم عن العنوان</em>
                        )}
                        <small>{date(point.created_at)}</small>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {!!item.offers?.length && (
                <section>
                  <h3>رحلة الاستعلام</h3>
                  <div className="journey">
                    {[
                      ["أُنشئ", item.created_at, null],
                      ["شاهده المستعلم", accepted?.seen_at, accepted?.offered_at],
                      ["قبِله", item.claimed_at, accepted?.seen_at ?? accepted?.offered_at],
                      ["أرسل التقرير", item.submitted_at, item.claimed_at],
                      ["اعتُمد", item.status === "approved" ? item.reviewed_at : null, item.submitted_at],
                    ].map(([label, at, after]) => (
                      <div className={at ? "journey-step done" : "journey-step"} key={label as string}>
                        <i />
                        <span>{label}</span>
                        <Stamp at={at} after={after} />
                      </div>
                    ))}
                  </div>
                  {accepted && item.submitted_at && (
                    <p className="hint">من المشاهدة حتى إرسال التقرير: {between(accepted.seen_at ?? accepted.offered_at, item.submitted_at)}</p>
                  )}
                </section>
              )}
              {!!item.offers?.length && (
                <section>
                  <h3>العروض على المستعلمين</h3>
                  <div className="table-wrap offers-table">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>المستعلم</th>
                          <th>المستوى</th>
                          <th>عُرض</th>
                          <th>شاهده</th>
                          <th>الرد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.offers.map((offer) => (
                          <tr key={offer.offered_at}>
                            <td>
                              <strong>{offer.full_name}</strong>
                            </td>
                            <td>{offer.tier_label}</td>
                            <td>
                              <Stamp at={offer.offered_at} />
                            </td>
                            <td>
                              <Stamp at={offer.seen_at} after={offer.offered_at} />
                            </td>
                            <td>
                              {offer.response ? (
                                <span className={`offer-${offer.response}`}>
                                  {OFFER_RESPONSE[offer.response] ?? offer.response}
                                  <small>بعد {between(offer.offered_at, offer.responded_at)}</small>
                                  {offer.reason && <small>{offer.reason}</small>}
                                </span>
                              ) : (
                                <span className="offer-pending">
                                  ينتظر الرد
                                  <small>تنتهي بعد {minutesLabel((new Date(offer.expires_at).getTime() - Date.now()) / 60000)}</small>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {!!item.events?.length && (
                <section>
                  <h3>السجل الكامل</h3>
                  <ol className="event-log">
                    {item.events.map((event, index) => (
                      <li key={index}>
                        <b>{EVENT_LABEL[event.type] ?? event.type}</b>
                        {event.user_name && <span> {event.user_name}</span>}
                        {event.actor_name && <span> — {event.actor_name}</span>}
                        {event.note && <em> ({event.note})</em>}
                        <small>{new Date(event.created_at).toLocaleString(document.documentElement.lang === "en" ? "en-US" : "ar-EG")}</small>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          )}
        </div>
        {(submitted || cancellable) && (
          <footer className="drawer-foot">
            {returning ? (
              <>
                <label className="field">
                  <span>ما المطلوب تعديله؟</span>
                  <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} autoFocus />
                </label>
                <div className="drawer-actions">
                  <button className="btn btn-primary" disabled={busy || !note.trim()} onClick={() => void act("return", { note })}>
                    إعادة إلى المستعلم
                  </button>
                  <button className="btn ghost" onClick={() => setReturning(false)}>
                    تراجع
                  </button>
                </div>
              </>
            ) : submitted ? (
              <div className="drawer-actions">
                <button className="btn btn-primary" disabled={busy} onClick={() => void act("approve")}>
                  <Icon name="check" size={17} />
                  اعتماد التقرير
                </button>
                <button className="btn ghost" onClick={() => setReturning(true)}>
                  طلب تعديل
                </button>
              </div>
            ) : (
              <div className="drawer-actions">
                {(item?.status === "unassigned" || item?.status === "open") && (
                  <button className="btn btn-primary" disabled={busy} onClick={() => void act("redispatch")}>
                    <Icon name="refresh" size={16} />
                    إعادة التوزيع
                  </button>
                )}
                <button
                  className="btn ghost btn-danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("هل تريد إلغاء هذا الاستعلام؟")) void act("cancel");
                  }}
                >
                  إلغاء الاستعلام
                </button>
              </div>
            )}
          </footer>
        )}
      </aside>
      {zoomed && (
        <button className="image-zoom" aria-label="إغلاق" onClick={() => setZoomed(null)}>
          <img src={zoomed} alt="" />
        </button>
      )}
    </div>,
    document.body,
  );
}

export function InvestigationsPage() {
  const [params] = useSearchParams();
  const sent = params.get("sent");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setBusy(true);
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (search.trim()) query.set("search", search.trim());
    api<{ investigations: Row[]; counts: Record<string, number> }>(`/investigations?${query}`)
      .then((data) => {
        if (!active) return;
        setRows(data.investigations);
        setCounts(data.counts);
        setError("");
      })
      .catch(() => {
        if (active) setError("تعذّر تحميل الاستعلامات.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [status, search, reload]);

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            مساحة العمل <span>/</span> الاستعلامات
          </p>
          <h1>
            كل استعلام. <span>من الإرسال إلى التقرير.</span>
          </h1>
          <p className="page-description">تابع حالة كل استعلام، وراجع التقارير، ونزّلها بصيغة PDF.</p>
        </div>
        <Link className="btn btn-primary" to="/investigations/new">
          <Icon name="plus" size={18} />
          استعلام جديد
        </Link>
      </div>
      <ErrorMessage message={error} />
      {sent && (
        <div className="success-message" role="status">
          تم إرسال الاستعلام <bdi className="mono">{sent}</bdi> بنجاح.
        </div>
      )}
      <div className="requests-toolbar">
        <div className="segmented status-tabs">
          {TABS.map((tab) => (
            <button key={tab} className={status === tab ? "active" : ""} onClick={() => setStatus(tab)}>
              {tab ? STATUS[tab] : "الكل"}
              <b>{number(tab ? (counts[tab] ?? 0) : total)}</b>
            </button>
          ))}
        </div>
        <label className="search-input">
          <Icon name="search" size={17} />
          <input
            aria-label="بحث في الاستعلامات"
            placeholder="الاسم أو رقم الاستعلام"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      <section className="glass panel" aria-busy={busy}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>رقم الاستعلام</th>
                <th>المستعلم عنه</th>
                <th>الجهة والنوع</th>
                <th>المنطقة</th>
                <th>النوع والموعد</th>
                <th>المستعلم</th>
                <th>الحالة</th>
                <th>
                  <span className="sr-only">عرض</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.investigation_id} className="clickable" onClick={() => setOpen(row.investigation_id)}>
                  <td className="mono">{row.reference}</td>
                  <td>
                    <div className="person-cell">
                      <div>
                        <strong>{row.subject_name}</strong>
                        <small>{date(row.created_at)}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="person-cell">
                      <div>
                        <strong>{row.client_name}</strong>
                        <small>{row.form_title}</small>
                      </div>
                    </div>
                  </td>
                  <td>{[row.governorate, row.district].filter(Boolean).join(" - ") || "—"}</td>
                  <td>
                    <div className="person-cell">
                      <div>
                        <strong>{row.service_name ?? "—"}</strong>
                        <small>
                          <Deadline row={row} />
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {row.assignee_name ??
                      (row.offered_to ? (
                        <span className="offer-pending">
                          معروض على {row.offered_to}
                          <small>
                            تنتهي بعد{" "}
                            {minutesLabel(row.offer_expires_at ? (new Date(row.offer_expires_at).getTime() - Date.now()) / 60000 : null)}
                          </small>
                        </span>
                      ) : row.status === "open" ? (
                        <span className="offer-pending">بانتظار مستعلم متاح</span>
                      ) : (
                        "—"
                      ))}
                  </td>
                  <td>
                    <CaseStatus status={row.status} />
                    {row.outcome === "negative" && <span className="badge negative-badge">سلبي</span>}
                  </td>
                  <td>
                    <span className="table-arrow">
                      <Icon name="chevron" size={17} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!busy && !rows.length && <Empty>لا توجد استعلامات هنا بعد.</Empty>}
      </section>
      {open && (
        <CaseDrawer id={open} onClose={() => setOpen(null)} onChanged={() => setReload((value) => value + 1)} />
      )}
    </div>
  );
}
