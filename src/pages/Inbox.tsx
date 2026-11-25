import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api, apiBlob, ApiRequestError } from "../api";
import { IntakeCheck, IntakeSetup } from "../components/IntakeSetup";
import { ClientFilter, useSavedClients, type FilterClient } from "../components/ClientFilter";
import { useAuth } from "../auth";
import { Empty, ErrorMessage, Icon, number } from "../components/ui";
import "../intake.css";

// The same types as the backend (intake/rules.ts KIND_LABELS): one form slot each.
const KIND_LABELS = {
  home: "سكن",
  work: "عمل",
  home_work: "سكن وعمل",
  finishing: "تشطيب وحدة",
  business_owner: "صاحب نشاط / أصحاب الأعمال",
  sme: "شركات صغيرة ومتوسطة",
  company: "شركات",
  supplier: "موردين ووكلاء",
  site_visit: "زيارة ميدانية / مفاجئة",
  clinic: "عيادات وصيدليات",
  dealer_coding: "تكويد معرض",
  merchant_coding: "تكويد تاجر / تجار",
  company_coding: "تكويد شركات وكيانات",
  follow_up: "متابعة",
  business: "ميداني (غير محدد)",
} as const;
type Kind = keyof typeof KIND_LABELS;
const INBOX_LABELS: Record<string, string> = { retail: "Retail", info: "Info", sme: "SME" };
const MESSAGE_STATUS: Record<string, string> = {
  new: "جديد",
  processing: "تتم قراءته",
  cases: "أصبح استعلامات",
  review: "يحتاج مراجعة",
  reply: "رد على رسالة سابقة",
  ignored: "ليس طلبًا",
  unknown_sender: "جهة غير معروفة",
  failed: "تعذّرت قراءته",
};
const CASE_STATUS: Record<string, string> = {
  review: "تحتاج مراجعة",
  ready: "مجدولة",
  sending: "تُرسل الآن",
  sent: "أُرسلت",
  failed: "فشل الإرسال",
  rejected: "مرفوضة",
};

interface Overview {
  inboxes: { name: string; configured: boolean; last_poll_at?: string; last_ok_at?: string; last_error?: string | null }[];
  ai: { configured: boolean; model: string };
  intake_off?: boolean;
  attention?: number;
  cases: Record<string, { count: number; next_release: string | null }>;
  today: { received?: number; requests?: number; ai_read?: number; sent: number };
  unknown_domains: { domain: string; count: number; last_at: string; last_subject: string }[];
  clients?: FilterClient[];
  rule: string;
}

interface Fields {
  subject_name: string | null;
  national_id: string | null;
  phone: string | null;
  address: string | null;
  home_address: string | null;
  work_address: string | null;
  company: string | null;
  governorate: string | null;
  district: string | null;
  client_reference: string | null;
  notes: string | null;
}

type Knowledge = "with" | "without";
const KNOWLEDGE_LABELS: Record<Knowledge, string> = { with: "بعلم العميل", without: "بدون علم العميل" };

/** A stored time as the value of a datetime-local input (the admin's own clock, Cairo). */
function localInput(value: string | null | undefined): string {
  if (!value) return "";
  const at = new Date(value);
  return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

interface MailCase {
  case_id: string;
  message_id: string;
  kind: Kind | null;
  fast: boolean;
  fields: Fields;
  confidence: number | null;
  doubts: string[];
  source: string | null;
  status: string;
  reason: string | null;
  release_at: string | null;
  investigation_id: string | null;
  client_id?: string | null;
  template_id?: string | null;
  assignee_id?: string | null;
  knowledge?: Knowledge | null;
  appointment_at?: string | null;
  reference?: string | null;
  client_name?: string | null;
  subject?: string;
  from_address?: string;
  inbox?: string;
  received_at?: string;
}

interface Message {
  message_id: string;
  inbox: string;
  from_address: string | null;
  from_name: string | null;
  from_domain: string | null;
  subject: string;
  received_at: string;
  status: string;
  reason: string | null;
  ai_used: boolean;
  client_name: string | null;
  attachments: number | { index: number; name: string; type: string; bytes: number }[];
  cases?: number;
  waiting?: number;
  body_text?: string | null;
  cc_addresses?: string[];
}

const when = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "—";

function releaseLabel(item: MailCase): string {
  if (!item.release_at) return "—";
  const at = new Date(item.release_at);
  return at.getTime() <= Date.now() ? "فورًا" : `الساعة ${at.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })} ${at.toLocaleDateString("ar-EG", { weekday: "long" })}`;
}

/** Email body for display: tables kept readable, tags removed. */
function bodyText(value: string | null | undefined): string {
  if (!value) return "";
  if (!/<[a-z][\s\S]*>/i.test(value)) return value;
  return value
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "   ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

// ───────────── one attachment, fetched with the admin's token ─────────────

/** Types safe to show in this origin. Anything else from an email is only downloaded, never opened. */
const VIEWABLE = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "application/pdf"];

function Attachment({ messageId, file }: { messageId: string; file: { index: number; name: string; type: string; bytes: number } }) {
  const [url, setUrl] = useState<string | null>(null);
  const type = file.type.toLowerCase();
  const viewable = VIEWABLE.includes(type);
  const image = viewable && type.startsWith("image/");
  useEffect(() => {
    if (!image) return;
    let revoked: string | null = null;
    apiBlob(`/investigations/intake/messages/${messageId}/files/${file.index}`)
      .then((blob) => {
        revoked = URL.createObjectURL(new Blob([blob], { type }));
        setUrl(revoked);
      })
      .catch(() => setUrl(null));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [messageId, file.index, image, type]);
  async function open() {
    const blob = await apiBlob(`/investigations/intake/messages/${messageId}/files/${file.index}`);
    const url = URL.createObjectURL(new Blob([blob], { type: viewable ? type : "application/octet-stream" }));
    if (viewable) window.open(url, "_blank", "noopener");
    else {
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  if (image && file.bytes < 15_000) return null;
  return image ? (
    <button type="button" className="mail-attachment image" onClick={() => void open()} title={file.name}>
      {url ? <img src={url} alt={file.name} /> : <span className="image-skeleton" />}
    </button>
  ) : (
    <button type="button" className="mail-attachment" onClick={() => void open()}>
      <Icon name="file" size={18} />
      <span dir="auto">{file.name}</span>
      <small>{number(Math.max(1, Math.round(file.bytes / 1024)))} KB</small>
    </button>
  );
}

// ───────────── reviewing one email and its people ─────────────

const FIELD_LABELS: [keyof Fields, string, boolean?][] = [
  ["subject_name", "الاسم"],
  ["national_id", "الرقم القومي"],
  ["phone", "الموبايل (لا يظهر للمستعلم)"],
  ["address", "عنوان الزيارة"],
  ["governorate", "المحافظة"],
  ["district", "المركز / الحي"],
  ["company", "جهة العمل"],
  ["client_reference", "مرجع العميل"],
  ["notes", "ملاحظات للمستعلم", true],
];

interface Choices {
  forms: { template_id: string; title: string; client_id: string }[];
  people: { user_id: string; full_name: string; governorate: string | null }[];
}

function CaseEditor({ item, choices, onChanged }: { item: MailCase; choices: Choices; onChanged: () => void }) {
  const [fields, setFields] = useState<Fields>(item.fields);
  const [kind, setKind] = useState<Kind | "">(item.kind ?? "");
  const [fast, setFast] = useState(item.fast);
  const [templateId, setTemplateId] = useState(item.template_id ?? "");
  const [assigneeId, setAssigneeId] = useState(item.assignee_id ?? "");
  const [knowledge, setKnowledge] = useState<Knowledge | "">(item.knowledge ?? "");
  const [appointment, setAppointment] = useState(localInput(item.appointment_at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const editable = ["review", "failed", "ready"].includes(item.status);
  useEffect(() => {
    setFields(item.fields);
    setKind(item.kind ?? "");
    setFast(item.fast);
    setTemplateId(item.template_id ?? "");
    setAssigneeId(item.assignee_id ?? "");
    setKnowledge(item.knowledge ?? "");
    setAppointment(localInput(item.appointment_at));
    // Approving one person reloads the email: what is being typed on the others must stay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.case_id, item.status]);
  const forms = choices.forms.filter((form) => form.client_id === item.client_id);
  const people = [...choices.people].sort(
    (a, b) => Number(b.governorate === fields.governorate) - Number(a.governorate === fields.governorate),
  );

  async function save(): Promise<boolean> {
    try {
      await api(`/investigations/intake/cases/${item.case_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fields,
          kind: kind || null,
          fast,
          template_id: templateId || null,
          assignee_id: assigneeId || null,
          knowledge: knowledge || null,
          appointment_at: knowledge === "with" && appointment ? new Date(appointment).toISOString() : null,
        }),
      });
      return true;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر الحفظ.");
      return false;
    }
  }

  async function approve(sendNow: boolean) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      if (!(await save())) return;
      const result = await api<{ status: string; reason: string | null; reference: string | null; release_at: string }>(
        `/investigations/intake/cases/${item.case_id}/approve`,
        { method: "POST", body: JSON.stringify({ send_now: sendNow }) },
      );
      setNote(
        result.status === "sent"
          ? `أُرسل للمستعلمين: ${result.reference}`
          : result.status === "ready"
            ? `مجدول: يُرسل ${new Date(result.release_at).toLocaleString("ar-EG")}`
            : result.reason ?? "",
      );
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر الاعتماد.");
    } finally {
      setBusy(false);
    }
  }

  // The same person, the other visit: the email asked for work and home but was read as one.
  const otherVisit: Kind | null = item.kind === "work" ? "home" : item.kind === "home" ? "work" : null;
  async function addVisit(next: Kind) {
    setBusy(true);
    setError("");
    try {
      // What was typed on this case goes into the copy too.
      if (editable && !(await save())) return;
      await api(`/investigations/intake/cases/${item.case_id}/visit`, { method: "POST", body: JSON.stringify({ kind: next }) });
      setNote(`أُضيفت زيارة «${KIND_LABELS[next]}» أسفل هذه الحالة: راجع عنوانها واعتمدها.`);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر إضافة الزيارة.");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    const reason = window.prompt("سبب الرفض (اختياري)") ?? undefined;
    if (reason === undefined) return;
    setBusy(true);
    try {
      await api(`/investigations/intake/cases/${item.case_id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر الرفض.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`mail-case ${item.status}`}>
      <header>
        <strong>{fields.subject_name || "بلا اسم"}</strong>
        <span className={`badge ${item.status === "sent" ? "badge-ok" : item.status === "review" || item.status === "failed" ? "badge-danger" : ""}`}>
          {CASE_STATUS[item.status] ?? item.status}
        </span>
        {item.source === "ai" && item.confidence !== null && (
          <span className="badge" title="ثقة القراءة الذكية">
            قراءة ذكية {Math.round(item.confidence * 100)}٪
          </span>
        )}
        {item.reference && item.investigation_id && (
          <Link className="badge badge-ok" to={`/investigations?case=${item.investigation_id}`}>
            {item.reference}
          </Link>
        )}
      </header>
      {item.reason && <p className="mail-reason">{item.reason}</p>}
      <div className="mail-case-grid">
        {FIELD_LABELS.map(([key, label, wide]) => (
          <label key={key} className={`field${wide ? " wide" : ""}`}>
            <span>{label}</span>
            {wide ? (
              <textarea rows={3} disabled={!editable} value={fields[key] ?? ""} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} />
            ) : (
              <input
                disabled={!editable}
                dir={key === "national_id" || key === "phone" ? "ltr" : "auto"}
                value={fields[key] ?? ""}
                onChange={(event) => setFields({ ...fields, [key]: event.target.value })}
              />
            )}
          </label>
        ))}
        <label className="field">
          <span>نوع الاستعلام</span>
          <select disabled={!editable} value={kind} onChange={(event) => setKind(event.target.value as Kind | "")}>
            <option value="">— اختر —</option>
            {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>النموذج</span>
          <select disabled={!editable} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">حسب النوع</option>
            {forms.map((form) => (
              <option key={form.template_id} value={form.template_id}>
                {form.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>يُرسل إلى</span>
          <select disabled={!editable} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            <option value="">تلقائي (مستعلمو المنطقة)</option>
            {people.map((person) => (
              <option key={person.user_id} value={person.user_id}>
                {person.full_name}
                {person.governorate ? ` · ${person.governorate}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>علم العميل</span>
          <select disabled={!editable} value={knowledge} onChange={(event) => setKnowledge(event.target.value as Knowledge | "")}>
            <option value="">غير مذكور</option>
            <option value="without">{KNOWLEDGE_LABELS.without}</option>
            <option value="with">{KNOWLEDGE_LABELS.with}</option>
          </select>
        </label>
        {knowledge === "with" && (
          <label className="field">
            <span>موعد الزيارة (بعد الاتصال بالعميل)</span>
            <input
              type="datetime-local"
              dir="ltr"
              disabled={!editable}
              value={appointment}
              onChange={(event) => setAppointment(event.target.value)}
            />
          </label>
        )}
        <label className="check-row">
          <input type="checkbox" disabled={!editable} checked={fast} onChange={(event) => setFast(event.target.checked)} />
          استعلام سريع
        </label>
      </div>
      {knowledge === "with" && editable && !appointment && (
        <p className="hint">اتصل بالعميل على رقمه أعلاه واتفق على موعد، ثم اكتبه هنا واعتمد الحالة.</p>
      )}
      <ErrorMessage message={error} />
      {note && <p className="hint ok-text">{note}</p>}
      {editable && (
        <div className="drawer-actions">
          <button className="btn btn-primary" disabled={busy} onClick={() => void approve(false)}>
            <Icon name="check" size={16} />
            اعتماد (حسب المواعيد)
          </button>
          <button className="btn" disabled={busy} onClick={() => void approve(true)}>
            إرسال الآن
          </button>
          <button className="btn ghost btn-danger" disabled={busy} onClick={() => void reject()}>
            رفض
          </button>
          {otherVisit && (
            <button className="btn ghost" disabled={busy} onClick={() => void addVisit(otherVisit)}>
              <Icon name="plus" size={14} /> إضافة زيارة {KIND_LABELS[otherVisit]}
            </button>
          )}
        </div>
      )}
      {!editable && item.status !== "rejected" && otherVisit && (
        <div className="drawer-actions">
          <button className="btn ghost" disabled={busy} onClick={() => void addVisit(otherVisit)}>
            <Icon name="plus" size={14} /> إضافة زيارة {KIND_LABELS[otherVisit]}
          </button>
        </div>
      )}
    </article>
  );
}

function MessageDrawer({ messageId, onClose, onChanged }: { messageId: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ message: Message; cases: MailCase[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    api<{ message: Message; cases: MailCase[] }>(`/investigations/intake/messages/${messageId}`)
      .then(setData)
      .catch(() => setError("تعذّر تحميل البريد."));
  }, [messageId]);
  useEffect(load, [load]);
  const [choices, setChoices] = useState<Choices>({ forms: [], people: [] });
  useEffect(() => {
    api<{ templates: Choices["forms"] }>("/investigations/intake/profiles")
      .then((result) => setChoices((current) => ({ ...current, forms: result.templates })))
      .catch(() => setError("تعذّر تحميل النماذج."));
    api<{ investigators: (Choices["people"][number] & { status: string })[] }>("/investigations/dispatch/overview")
      .then((result) => setChoices((current) => ({ ...current, people: result.investigators.filter((person) => person.status === "active") })))
      .catch(() => setError("تعذّر تحميل المستعلمين."));
  }, []);

  async function act(path: "reprocess" | "ignore" | "cases") {
    setBusy(true);
    setError("");
    try {
      await api(`/investigations/intake/messages/${messageId}/${path}`, { method: "POST", body: "{}" });
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر التنفيذ.");
    } finally {
      setBusy(false);
    }
  }

  const message = data?.message;
  const files = Array.isArray(message?.attachments) ? message.attachments : [];
  return createPortal(
    <div className="drawer-root" dir={document.documentElement.dir}>
      <button className="drawer-scrim" aria-label="إغلاق" onClick={onClose} />
      <aside className="review-drawer mail-drawer" role="dialog" aria-modal="true">
        <header className="drawer-head">
          <div>
            <span className="eyebrow">
              {message?.client_name ?? message?.from_domain ?? "بريد"} · {INBOX_LABELS[message?.inbox ?? ""] ?? message?.inbox}
            </span>
            <h2 dir="auto">{message?.subject || "…"}</h2>
          </div>
          <button className="icon-button" aria-label="إغلاق" onClick={onClose}>
            <Icon name="close" size={17} />
          </button>
        </header>
        <div className="drawer-body mail-drawer-body">
          <ErrorMessage message={error} />
          {message && (
            <>
              <section className="mail-source">
                <p className="mail-meta">
                  <span dir="ltr">{message.from_address}</span> · {when(message.received_at)} ·{" "}
                  <b>{MESSAGE_STATUS[message.status] ?? message.status}</b>
                  {message.ai_used && <span className="badge">قُرئ بالذكاء الاصطناعي</span>}
                </p>
                {message.reason && <p className="mail-reason">{message.reason}</p>}
                {files.length > 0 && (
                  <div className="mail-attachments">
                    {files.map((file) => (
                      <Attachment key={file.index} messageId={message.message_id} file={file} />
                    ))}
                  </div>
                )}
                <pre className="mail-body" dir="auto">
                  {bodyText(message.body_text).slice(0, 6000)}
                </pre>
                <div className="drawer-actions">
                  <button className="btn small" disabled={busy} onClick={() => void act("reprocess")}>
                    <Icon name="refresh" size={14} /> إعادة القراءة
                  </button>
                  {message.status !== "ignored" && (
                    <button className="btn small ghost" disabled={busy} onClick={() => void act("ignore")}>
                      ليس طلبًا
                    </button>
                  )}
                </div>
              </section>
              <section className="mail-cases">
                <div className="mail-cases-head">
                  <h3>الأشخاص في هذا البريد ({number(data?.cases.length ?? 0)})</h3>
                  <button className="btn small" disabled={busy} onClick={() => void act("cases")}>
                    <Icon name="plus" size={14} /> إضافة شخص يدويًا
                  </button>
                </div>
                {data?.cases.map((item) => (
                  <CaseEditor
                    key={item.case_id}
                    item={item}
                    choices={choices}
                    onChanged={() => {
                      load();
                      onChanged();
                    }}
                  />
                ))}
                {!data?.cases.length && <Empty>لم يُستخرج أي شخص من هذا البريد. أضفه يدويًا.</Empty>}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

// ───────────── client settings ─────────────

interface Profile {
  client_id: string;
  client_name: string;
  domains: string[];
  templates: Partial<Record<Kind, string>>;
  fast_words: string[];
  normal_level: string;
  fast_level: string;
  auto_send: boolean;
  two_visits?: boolean;
  inbox_kinds?: Record<string, Kind>;
  ignore_words: string[];
  notes: string | null;
  active: boolean;
}
interface ProfilesData {
  profiles: Profile[];
  clients: { client_id: string; name: string }[];
  templates: { template_id: string; title: string; client_id: string; type_name: string | null }[];
  levels: { code: string; name_ar: string }[];
}

function ProfileForm({
  data,
  initial,
  onSaved,
  onCancel,
}: {
  data: ProfilesData;
  initial: Partial<Profile> & { client_id: string };
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    client_id: initial.client_id,
    domains: (initial.domains ?? []).join(", "),
    templates: initial.templates ?? {},
    fast_words: (initial.fast_words ?? []).join("، "),
    ignore_words: (initial.ignore_words ?? []).join("، "),
    normal_level: initial.normal_level ?? "normal",
    fast_level: initial.fast_level ?? "urgent",
    auto_send: initial.auto_send ?? false,
    two_visits: initial.two_visits ?? false,
    inbox_kinds: initial.inbox_kinds ?? {},
    active: initial.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const forms = data.templates.filter((t) => t.client_id === form.client_id);

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api(`/investigations/intake/profiles/${form.client_id}`, {
        method: "POST",
        body: JSON.stringify({ ...form, domains: form.domains, fast_words: form.fast_words, ignore_words: form.ignore_words }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="profile-form">
      <div className="form-row">
        <label className="field">
          <span>الجهة</span>
          <select
            value={form.client_id}
            onChange={(event) => {
              const id = event.target.value;
              const saved = data.profiles.find((profile) => profile.client_id === id);
              // Linking a new domain to a client that is already set up adds to it.
              setForm({
                ...form,
                client_id: id,
                domains: [...new Set([...(saved?.domains ?? []), ...(initial.client_name ? [] : (initial.domains ?? []))])].join(", "),
                templates: saved?.templates ?? {},
                inbox_kinds: saved?.inbox_kinds ?? {},
                auto_send: saved?.auto_send ?? form.auto_send,
                two_visits: saved?.two_visits ?? form.two_visits,
              });
            }}
          >
            {data.clients.map((client) => (
              <option key={client.client_id} value={client.client_id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>دومين البريد (يمكن أكثر من واحد)</span>
          <input dir="ltr" placeholder="bank.com.eg" value={form.domains} onChange={(event) => setForm({ ...form, domains: event.target.value })} />
        </label>
      </div>
      <div className="field">
        <span>النموذج لكل نوع طلب</span>
        <div className="kind-templates">
          {(Object.keys(KIND_LABELS) as Kind[]).map((kind) => (
            <label key={kind} className="field">
              <span>{KIND_LABELS[kind]}</span>
              <select
                value={form.templates[kind] ?? ""}
                onChange={(event) => setForm({ ...form, templates: { ...form.templates, [kind]: event.target.value || undefined } })}
              >
                <option value="">— لا يُستقبل —</option>
                {forms.map((t) => (
                  <option key={t.template_id} value={t.template_id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {!forms.length && <small className="field-hint">لا توجد نماذج معتمدة لهذه الجهة بعد.</small>}
      </div>
      <div className="field">
        <span>النوع عندما لا يذكر البريد نوعًا، حسب الصندوق الذي وصل إليه</span>
        <div className="kind-templates">
          {Object.keys(INBOX_LABELS).map((inbox) => (
            <label key={inbox} className="field">
              <span>{INBOX_LABELS[inbox]}</span>
              <select
                value={form.inbox_kinds[inbox] ?? ""}
                onChange={(event) => {
                  const next = { ...form.inbox_kinds };
                  if (event.target.value) next[inbox] = event.target.value as Kind;
                  else delete next[inbox];
                  setForm({ ...form, inbox_kinds: next });
                }}
              >
                <option value="">— ينتظر المراجعة —</option>
                {(Object.keys(KIND_LABELS) as Kind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>
      <div className="form-row three">
        <label className="field">
          <span>النوع العادي</span>
          <select value={form.normal_level} onChange={(event) => setForm({ ...form, normal_level: event.target.value })}>
            {data.levels.map((level) => (
              <option key={level.code} value={level.code}>
                {level.name_ar}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>النوع السريع</span>
          <select value={form.fast_level} onChange={(event) => setForm({ ...form, fast_level: event.target.value })}>
            {data.levels.map((level) => (
              <option key={level.code} value={level.code}>
                {level.name_ar}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>كلمات الاستعجال (اختياري)</span>
          <input placeholder="عاجل، استعجال، Fast Track" value={form.fast_words} onChange={(event) => setForm({ ...form, fast_words: event.target.value })} />
        </label>
      </div>
      <label className="field">
        <span>كلمات تعني «ليس طلبًا» (اختياري)</span>
        <input placeholder="تذكير، شكرًا" value={form.ignore_words} onChange={(event) => setForm({ ...form, ignore_words: event.target.value })} />
      </label>
      <label className="check-row">
        <input type="checkbox" checked={form.auto_send} onChange={(event) => setForm({ ...form, auto_send: event.target.checked })} />
        إرسال تلقائي للمستعلمين عندما تكون القراءة مؤكدة (وإلا ينتظر كل طلب المراجعة)
      </label>
      <label className="check-row">
        <input type="checkbox" checked={form.two_visits} onChange={(event) => setForm({ ...form, two_visits: event.target.checked })} />
        «سكن وعمل» زيارتان بتقريرين وسعرين وأجرين، وتُرسلان تلقائيًا
      </label>
      <label className="check-row">
        <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
        استقبال بريد هذه الجهة
      </label>
      <ErrorMessage message={error} />
      <div className="drawer-actions">
        <button className="btn btn-primary" disabled={busy || !form.domains.trim()} onClick={() => void save()}>
          حفظ
        </button>
        <button className="btn ghost" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

function ProfilesPanel({ unknown, onChanged }: { unknown: Overview["unknown_domains"]; onChanged: () => void }) {
  const [data, setData] = useState<ProfilesData | null>(null);
  const [editing, setEditing] = useState<(Partial<Profile> & { client_id: string }) | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    api<ProfilesData>("/investigations/intake/profiles")
      .then(setData)
      .catch(() => setError("تعذّر تحميل إعدادات الجهات."));
  }, []);
  useEffect(load, [load]);
  const templateTitle = (id: string | undefined) => data?.templates.find((t) => t.template_id === id)?.title ?? "—";
  if (!data) return <ErrorMessage message={error} />;
  return (
    <section className="glass panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">جهات البريد</p>
          <h2>من أين يأتي البريد، وأي نموذج لكل طلب</h2>
        </div>
        {!editing && data.clients[0] && (
          <button className="btn small btn-primary" onClick={() => setEditing({ client_id: data.clients[0]!.client_id })}>
            <Icon name="plus" size={15} /> ربط جهة
          </button>
        )}
      </div>
      <IntakeSetup
        kinds={KIND_LABELS}
        onDone={() => {
          load();
          onChanged();
        }}
      />
      {editing && (
        <ProfileForm
          // Choosing another client to edit starts from that client's own settings.
          key={`${editing.client_id}:${(editing.domains ?? []).join(",")}`}
          data={data}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            onChanged();
          }}
        />
      )}
      {unknown.length > 0 && (
        <div className="unknown-domains">
          <h3>بريد من جهات غير مربوطة</h3>
          {unknown.map((row) => (
            <div key={row.domain} className="unknown-domain">
              <span dir="ltr">@{row.domain}</span>
              <small>
                {number(row.count)} رسالة · آخرها «{row.last_subject.slice(0, 60)}»
              </small>
              <button
                className="btn small"
                onClick={() => {
                  const existing = data.profiles.find((p) => p.domains.some((d) => row.domain === d || row.domain.endsWith(`.${d}`)));
                  setEditing(existing ?? { client_id: data.clients[0]?.client_id ?? "", domains: [row.domain] });
                }}
              >
                ربط بجهة
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>الجهة</th>
              <th>الدومين</th>
              <th>النماذج</th>
              <th>الإرسال</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.profiles.map((profile) => (
              <tr key={profile.client_id}>
                <td>{profile.client_name}</td>
                <td dir="ltr">{profile.domains.join(", ")}</td>
                <td>
                  <small>
                    {(Object.keys(profile.templates) as Kind[]).map((k) => `${KIND_LABELS[k]}: ${templateTitle(profile.templates[k])}`).join(" · ") || "—"}
                  </small>
                </td>
                <td>{!profile.active ? "متوقف" : profile.auto_send ? "تلقائي" : "مراجعة يدوية"}</td>
                <td>
                  <button className="btn small ghost" onClick={() => setEditing(profile)}>
                    تعديل
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.profiles.length && <Empty>لم تُربط أي جهة بعد. اربط كل بنك أو شركة بدومين بريدها ليبدأ الاستقبال التلقائي.</Empty>}
    </section>
  );
}

// ───────────── the page ─────────────

type Tab = "review" | "ready" | "sent" | "messages" | "settings";

export function InboxPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tab, setTab] = useState<Tab>("review");
  const [cases, setCases] = useState<MailCase[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageFilter, setMessageFilter] = useState("");
  const [attention, setAttention] = useState<Message[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  // The same companies and banks the administrator chose on the investigations page.
  const { user } = useAuth();
  const [chosenClients, setChosenClients] = useSavedClients(user?.user_id ?? "");
  const clientKey = chosenClients.join(",");

  const load = useCallback(() => {
    const only = clientKey ? `clients=${encodeURIComponent(clientKey)}` : "";
    const withClients = (path: string) => (only ? `${path}${path.includes("?") ? "&" : "?"}${only}` : path);
    api<Overview>(withClients("/investigations/intake/overview"))
      .then(setOverview)
      .catch(() => setError("تعذّر تحميل حالة البريد."));
    if (tab === "messages") {
      api<{ messages: Message[] }>(withClients(`/investigations/intake/messages${messageFilter ? `?status=${messageFilter}` : ""}`))
        .then((data) => setMessages(data.messages))
        .catch(() => setError("تعذّر تحميل الرسائل."));
    } else if (tab !== "settings") {
      if (tab === "review") {
        // Emails that need a person and have no one extracted from them yet.
        api<{ messages: Message[] }>(withClients("/investigations/intake/messages?status=attention"))
          .then((data) => setAttention(data.messages))
          .catch(() => setError("تعذّر تحميل الرسائل."));
      }
      const status = tab === "review" ? "review,failed" : tab === "ready" ? "ready,sending" : "sent";
      api<{ cases: MailCase[] }>(withClients(`/investigations/intake/cases?status=${status}`))
        .then((data) => setCases(data.cases))
        .catch(() => setError("تعذّر تحميل الطلبات."));
    }
  }, [tab, messageFilter, clientKey]);
  useEffect(load, [load]);
  // The inbox is read every minute: keep the page current while it is open.
  useEffect(() => {
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const count = (status: string) => overview?.cases[status]?.count ?? 0;
  const tabs: { key: Tab; label: string; badge?: number }[] = useMemo(
    () => [
      { key: "review", label: "تحتاج مراجعة", badge: count("review") + count("failed") + (overview?.attention ?? 0) },
      { key: "ready", label: "مجدولة", badge: count("ready") },
      { key: "sent", label: "أُرسلت" },
      { key: "messages", label: "كل الرسائل" },
      { key: "settings", label: "الربط والفحص", badge: overview?.unknown_domains.length },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overview],
  );

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            مساحة العمل <span>/</span> البريد الوارد
          </p>
          <h1>
            طلبات البنوك والشركات. <span>من البريد إلى المستعلم مباشرة.</span>
          </h1>
          <p className="page-description">{overview?.rule}. ما لا يُقرأ بثقة ينتظر هنا مع السبب، ولا يصل لأي مستعلم قبل اعتمادك.</p>
        </div>
        <button className="btn ghost" onClick={load}>
          <Icon name="refresh" size={16} /> تحديث
        </button>
      </div>
      <ErrorMessage message={error} />
      {overview?.intake_off && (
        <p className="mail-reason">الاستقبال التلقائي متوقف على الخادم: احذف MAIL_INTAKE=off ثم أعد النشر.</p>
      )}

      {overview && (
        <div className="inbox-status">
          {overview.inboxes.map((inbox) => (
            <span key={inbox.name} className={`inbox-chip ${!inbox.configured ? "off" : inbox.last_error ? "bad" : "ok"}`} title={inbox.last_error ?? ""}>
              <Icon name="mail" size={14} />
              {INBOX_LABELS[inbox.name] ?? inbox.name}
              <small>{!inbox.configured ? "غير مضبوط" : inbox.last_error ? "خطأ في الاتصال" : `آخر فحص ${when(inbox.last_ok_at)}`}</small>
            </span>
          ))}
          {!overview.inboxes.length && <span className="inbox-chip off">لا يوجد بريد مضبوط على الخادم (MAIL_INBOXES)</span>}
          <span className={`inbox-chip ${overview.ai.configured ? "ok" : "off"}`}>
            <Icon name="activity" size={14} />
            القراءة الذكية
            <small>{overview.ai.configured ? "مفعّلة" : "غير مفعّلة: الصور والملفات الممسوحة تنتظر المراجعة"}</small>
          </span>
        </div>
      )}

      {overview?.clients && overview.clients.length > 0 && tab !== "settings" && (
        <ClientFilter clients={overview.clients} value={chosenClients} onChange={setChosenClients} />
      )}

      <div className="metrics-grid">
        {[
          { label: "وصل اليوم", value: number(overview?.today.received ?? 0), hint: `${number(overview?.today.requests ?? 0)} طلب استعلام` },
          { label: "أُرسل للمستعلمين اليوم", value: number(overview?.today.sent ?? 0), hint: "من البريد" },
          { label: "تحتاج مراجعة", value: number(count("review") + count("failed") + (overview?.attention ?? 0)), hint: `${number(count("failed"))} فشل إرسالها` },
          {
            label: "مجدولة",
            value: number(count("ready")),
            hint: overview?.cases.ready?.next_release ? `التالية ${when(overview.cases.ready.next_release)}` : "لا شيء مجدول",
          },
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

      <div className="segmented inbox-tabs">
        {tabs.map((item) => (
          <button key={item.key} type="button" className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}>
            {item.label}
            {!!item.badge && <span className="tab-badge">{number(item.badge)}</span>}
          </button>
        ))}
      </div>

      {tab === "settings" && overview && (
        <>
          <IntakeCheck />
          <ProfilesPanel unknown={overview.unknown_domains} onChanged={load} />
        </>
      )}

      {tab === "messages" && (
        <section className="glass panel">
          <div className="panel-heading">
            <h2>كل الرسائل</h2>
            <select className="filter-select" value={messageFilter} onChange={(event) => setMessageFilter(event.target.value)}>
              <option value="">كل الحالات</option>
              {Object.entries(MESSAGE_STATUS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>وصل</th>
                  <th>من</th>
                  <th>الموضوع</th>
                  <th>البريد</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((row) => (
                  <tr key={row.message_id} className="clickable" onClick={() => setOpen(row.message_id)}>
                    <td>{when(row.received_at)}</td>
                    <td>{row.client_name ?? <span dir="ltr">{row.from_address}</span>}</td>
                    <td dir="auto">
                      {row.subject.slice(0, 80)}
                      {row.reason && <small className="row-reason">{row.reason}</small>}
                    </td>
                    <td>{INBOX_LABELS[row.inbox] ?? row.inbox}</td>
                    <td>
                      {MESSAGE_STATUS[row.status] ?? row.status}
                      {!!row.cases && <small className="row-reason">{number(row.cases)} شخص</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!messages.length && <Empty>لا توجد رسائل.</Empty>}
        </section>
      )}

      {tab === "review" && attention.length > 0 && (
        <section className="glass panel attention-mail">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">تحتاج شخصًا</p>
              <h2>رسائل لم يُستخرج منها أحد</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>وصل</th>
                  <th>الجهة</th>
                  <th>الموضوع</th>
                  <th>السبب</th>
                </tr>
              </thead>
              <tbody>
                {attention.map((row) => (
                  <tr key={row.message_id} className="clickable" onClick={() => setOpen(row.message_id)}>
                    <td>{when(row.received_at)}</td>
                    <td>{row.client_name ?? <span dir="ltr">{row.from_address}</span>}</td>
                    <td dir="auto">{row.subject.slice(0, 80)}</td>
                    <td>
                      <small className="row-reason">{row.reason}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(tab === "review" || tab === "ready" || tab === "sent") && (
        <section className="glass panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الجهة</th>
                  <th>الاسم</th>
                  <th>المنطقة</th>
                  <th>النوع</th>
                  <th>وصل</th>
                  <th>{tab === "sent" ? "الاستعلام" : tab === "ready" ? "يُرسل" : "السبب"}</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((row) => (
                  <tr key={row.case_id} className="clickable" onClick={() => setOpen(row.message_id)}>
                    <td>{row.client_name ?? "—"}</td>
                    <td>
                      {row.fields.subject_name ?? "—"}
                      {row.fast && <span className="badge badge-danger fast-badge">سريع</span>}
                      {row.knowledge === "with" && (
                        <span className="badge fast-badge">{row.appointment_at ? `موعد ${when(row.appointment_at)}` : "يحتاج موعد"}</span>
                      )}
                    </td>
                    <td>{[row.fields.governorate, row.fields.district].filter(Boolean).join(" - ") || "—"}</td>
                    <td>{row.kind ? KIND_LABELS[row.kind] : "—"}</td>
                    <td>{when(row.received_at)}</td>
                    <td>
                      {tab === "sent" ? (
                        row.reference ?? "—"
                      ) : tab === "ready" ? (
                        releaseLabel(row)
                      ) : (
                        <small className="row-reason">{row.reason ?? CASE_STATUS[row.status]}</small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!cases.length && (
            <Empty>{tab === "review" ? "لا شيء ينتظر المراجعة." : tab === "ready" ? "لا توجد طلبات مجدولة." : "لم يُرسل شيء من البريد بعد."}</Empty>
          )}
        </section>
      )}

      {open && <MessageDrawer messageId={open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}
