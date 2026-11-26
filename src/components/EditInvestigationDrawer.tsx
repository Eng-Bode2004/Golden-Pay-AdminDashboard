import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api, ApiRequestError } from "../api";
import { AREA_LEVELS, LocationFields, type AreaNames } from "./AreaPicker";
import { ErrorMessage, Icon } from "./ui";
import type { ServiceLevel } from "../headoffice/Pricing";

/** What the case drawer already has about the investigation. */
export interface EditableCase {
  investigation_id: string;
  reference: string;
  status: string;
  subject_name: string;
  subject_phone: string | null;
  client_reference?: string | null;
  address: string;
  landmark: string | null;
  admin_notes?: string | null;
  governorate: string | null;
  district: string | null;
  local_unit?: string | null;
  main_village?: string | null;
  sub_village?: string | null;
  service_level?: string | null;
  appointment_at?: string | null;
  customer_knowledge?: string | null;
  template_id?: string | null;
  client_id?: string | null;
  client_name: string;
  form_title: string;
  assignee: { full_name: string } | null;
  answers?: Record<string, unknown> | null;
}

interface Client {
  client_id: string;
  name: string;
}
interface Template {
  template_id: string;
  title: string;
  category: string;
  type_name: string | null;
}
interface Change {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}
interface Preview {
  saved: boolean;
  changes: Change[];
  notes: string[];
  resent: boolean;
  dropped_answers: string[];
}

const TEXTS = [
  { key: "subject_name", label: "اسم العميل", required: true },
  { key: "subject_phone", label: "الهاتف (لا يظهر للمستعلم)", ltr: true },
  { key: "client_reference", label: "رقم العميل لدى الجهة", ltr: true },
  { key: "address", label: "العنوان بالتفصيل", required: true },
  { key: "landmark", label: "علامة مميزة" },
] as const;
const RESENDABLE = ["open", "unassigned", "assigned"];
const KNOWLEDGE: Record<string, string> = { with: "بعلم العميل", without: "بدون علم العميل" };

/** "2026-11-26T10:30" in the browser's time, for a datetime-local input. */
function localInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Edits a sent investigation: the subject's details, the area, the type and the form.
 * The admin first sees what will change (prices and deadline too, for those allowed to see
 * money), then saves. Approved and cancelled cases are not editable.
 */
export function EditInvestigationDrawer({
  item,
  onClose,
  onSaved,
}: {
  item: EditableCase;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = useMemo(
    () => ({
      texts: Object.fromEntries(TEXTS.map((field) => [field.key, (item[field.key] as string | null) ?? ""])) as Record<string, string>,
      notes: item.admin_notes ?? "",
      place: Object.fromEntries(AREA_LEVELS.map((level) => [level.key, (item[level.key] as string | null) ?? ""])) as AreaNames,
      level: item.service_level ?? "",
      appointment: localInput(item.appointment_at),
      knowledge: item.customer_knowledge ?? "",
      client: item.client_id ?? "",
      template: item.template_id ?? "",
    }),
    [item],
  );
  const [texts, setTexts] = useState(initial.texts);
  const [notes, setNotes] = useState(initial.notes);
  const [place, setPlace] = useState<AreaNames>(initial.place);
  const [level, setLevel] = useState(initial.level);
  const [appointment, setAppointment] = useState(initial.appointment);
  const [knowledge, setKnowledge] = useState(initial.knowledge);
  const [client, setClient] = useState(initial.client);
  const [template, setTemplate] = useState(initial.template);
  const [resend, setResend] = useState(false);
  const [levels, setLevels] = useState<ServiceLevel[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ levels: ServiceLevel[] }>("/investigations/service-levels")
      .then((data) => setLevels(data.levels.filter((row) => row.active || row.code === initial.level)))
      .catch(() => setError("تعذّر تحميل أنواع الاستعلام."));
    api<{ clients: Client[] }>("/forms/clients")
      .then((data) => setClients(data.clients))
      .catch(() => setError("تعذّر تحميل الجهات."));
  }, [initial.level]);
  useEffect(() => {
    if (!client) return;
    api<{ templates: Template[] }>(`/forms/templates?client=${client}`)
      .then((data) => setTemplates(data.templates))
      .catch(() => setError("تعذّر تحميل النماذج."));
  }, [client]);

  const chosenLevel = levels.find((row) => row.code === level);
  const needsAppointment = chosenLevel ? chosenLevel.delivery_hours === null : false;
  const placeChanged =
    AREA_LEVELS.some((row) => (place[row.key] ?? "") !== (initial.place[row.key] ?? "")) || texts.address !== initial.texts.address;
  const canResend = RESENDABLE.includes(item.status) && placeChanged;
  const answered = Object.values(item.answers ?? {}).some((value) => value !== null && value !== "");

  /** Only what the admin changed goes to the server. */
  function changedBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    for (const field of TEXTS) if (texts[field.key] !== initial.texts[field.key]) body[field.key] = texts[field.key].trim();
    if (notes !== initial.notes) body.admin_notes = notes.trim();
    if (AREA_LEVELS.some((row) => (place[row.key] ?? "") !== (initial.place[row.key] ?? ""))) {
      for (const row of AREA_LEVELS) body[row.key] = place[row.key] || null;
    }
    if (level !== initial.level) body.service_level = level;
    if (appointment !== initial.appointment) body.appointment_at = appointment ? new Date(appointment).toISOString() : null;
    if (knowledge !== initial.knowledge) body.customer_knowledge = knowledge || null;
    if (template && template !== initial.template) body.template_id = template;
    if (canResend && resend) body.resend = true;
    return body;
  }

  const levelName = (code: unknown) => levels.find((row) => row.code === code)?.name_ar ?? String(code ?? "—");
  function shown(change: Change, value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (change.field === "service_level") return levelName(value);
    if (change.field === "customer_knowledge") return KNOWLEDGE[value as string] ?? String(value);
    if (change.field === "appointment_at" || change.field === "due_at") {
      return new Date(value as string).toLocaleString(document.documentElement.lang === "en" ? "en-US" : "ar-EG");
    }
    if (/price/.test(change.field)) return `${Number(value).toLocaleString("ar-EG")} ج.م`;
    return String(value);
  }

  async function send(dry: boolean) {
    const body = changedBody();
    if (!Object.keys(body).length) {
      setError("لم تغيّر شيئًا بعد.");
      return;
    }
    if (client !== initial.client && (!template || template === initial.template)) {
      setError("اختر نموذجًا من الجهة الجديدة.");
      return;
    }
    if (needsAppointment && !appointment) {
      setError("هذا النوع بموعد: حدد الموعد.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<Preview>(`/investigations/${item.investigation_id}/details`, {
        method: "PATCH",
        body: JSON.stringify({ ...body, preview: dry }),
      });
      if (dry) setPreview(result);
      else onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر حفظ التعديل.");
    } finally {
      setBusy(false);
    }
  }

  // Any change after a preview needs a fresh preview before saving.
  useEffect(() => setPreview(null), [texts, notes, place, level, appointment, knowledge, template, resend]);

  const grouped = useMemo(() => {
    const map = new Map<string, Template[]>();
    for (const row of templates) {
      const group = row.type_name ?? row.category;
      map.set(group, [...(map.get(group) ?? []), row]);
    }
    return [...map];
  }, [templates]);

  return createPortal(
    <div className="drawer-root" dir={document.documentElement.dir}>
      <button className="drawer-scrim" aria-label="إغلاق" onClick={onClose} />
      <aside className="review-drawer" role="dialog" aria-modal="true" aria-label="تعديل الاستعلام">
        <header className="drawer-head">
          <div>
            <span className="eyebrow mono">تعديل · {item.reference}</span>
            <h2>{item.subject_name}</h2>
          </div>
          <button className="icon-button" aria-label="إغلاق" onClick={onClose}>
            <Icon name="close" size={17} />
          </button>
        </header>
        <div className="drawer-body">
          <section>
            <h3>بيانات العميل</h3>
            {TEXTS.map((field) => (
              <label className="field" key={field.key}>
                <span>{field.label}</span>
                <input
                  dir={"ltr" in field ? "ltr" : undefined}
                  value={texts[field.key]}
                  required={"required" in field}
                  onChange={(event) => setTexts({ ...texts, [field.key]: event.target.value })}
                />
              </label>
            ))}
            <label className="field">
              <span>ملاحظات الإدارة للمستعلم</span>
              <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </section>

          <section>
            <h3>المنطقة</h3>
            <LocationFields value={place} onChange={setPlace} />
            {canResend && (
              <label className="check-row">
                <input type="checkbox" checked={resend} onChange={(event) => setResend(event.target.checked)} />
                <span>
                  أعد الإرسال للمنطقة الجديدة
                  <small>
                    {item.assignee
                      ? ` (يُسحب من ${item.assignee.full_name} ويُعرض على مستعلمي المنطقة الجديدة)`
                      : " (تُغلق العروض الحالية ويُعرض على مستعلمي المنطقة الجديدة)"}
                  </small>
                </span>
              </label>
            )}
            {placeChanged && !RESENDABLE.includes(item.status) && item.assignee && (
              <p className="hint">بدأ {item.assignee.full_name} العمل، فيبقى الاستعلام معه ويُنبَّه بالتعديل. للنقل استخدم «نقل إلى».</p>
            )}
          </section>

          <section>
            <h3>نوع الاستعلام والموعد</h3>
            <label className="field">
              <span>النوع</span>
              <select value={level} onChange={(event) => setLevel(event.target.value)}>
                {levels.map((row) => (
                  <option key={row.code} value={row.code}>
                    {row.name_ar} — {row.delivery_label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>
                موعد الزيارة {needsAppointment ? "" : <small>(اختياري: يصبح هو الموعد النهائي)</small>}
              </span>
              <input type="datetime-local" dir="ltr" value={appointment} onChange={(event) => setAppointment(event.target.value)} />
            </label>
            <label className="field">
              <span>علم العميل</span>
              <select value={knowledge} onChange={(event) => setKnowledge(event.target.value)}>
                <option value="">غير محدد</option>
                <option value="without">بدون علم العميل</option>
                <option value="with">بعلم العميل</option>
              </select>
            </label>
          </section>

          <section>
            <h3>الجهة والنموذج</h3>
            <label className="field">
              <span>الجهة</span>
              <select
                value={client}
                onChange={(event) => {
                  setClient(event.target.value);
                  setTemplate(event.target.value === initial.client ? initial.template : "");
                  setTemplates([]);
                }}
              >
                {!clients.some((row) => row.client_id === client) && <option value={client}>{item.client_name}</option>}
                {clients.map((row) => (
                  <option key={row.client_id} value={row.client_id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>النموذج</span>
              <select value={template} onChange={(event) => setTemplate(event.target.value)}>
                <option value="">اختر النموذج</option>
                {template === initial.template && !templates.some((row) => row.template_id === template) && (
                  <option value={initial.template}>{item.form_title}</option>
                )}
                {grouped.map(([group, rows]) => (
                  <optgroup key={group} label={group}>
                    {rows.map((row) => (
                      <option key={row.template_id} value={row.template_id}>
                        {row.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {template !== initial.template && answered && (
              <p className="hint">كتب المستعلم إجابات: تبقى إجابات الحقول الموجودة في النموذج الجديد، ويُحذف الباقي. الصور تبقى.</p>
            )}
          </section>

          {preview && (
            <section className="case-check clean">
              <h3>{preview.changes.length ? "ما الذي سيتغير" : "لا تغيير"}</h3>
              {preview.changes.length > 0 && (
                <ul className="hint">
                  {preview.changes.map((change) => (
                    <li key={change.field}>
                      <b>{change.label}:</b> {shown(change, change.before)} ← {shown(change, change.after)}
                    </li>
                  ))}
                </ul>
              )}
              {preview.notes.map((line) => (
                <p className="hint" key={line}>
                  {line}
                </p>
              ))}
            </section>
          )}
          <ErrorMessage message={error} />
        </div>
        <footer className="drawer-foot">
          {preview ? (
            <>
              <button className="btn ghost" disabled={busy} onClick={() => setPreview(null)}>
                رجوع للتعديل
              </button>
              <button
                className="btn btn-primary"
                disabled={busy || (!preview.changes.length && !preview.resent)}
                onClick={() => void send(false)}
              >
                <Icon name="check" size={16} />
                {busy ? "جارٍ الحفظ…" : "حفظ التعديل"}
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-block" disabled={busy} onClick={() => void send(true)}>
              {busy ? "جارٍ المراجعة…" : "راجع التغييرات"}
            </button>
          )}
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
