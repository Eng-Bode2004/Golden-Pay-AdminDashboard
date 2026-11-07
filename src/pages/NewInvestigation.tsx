import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../api";
import {
  AREA_LEVELS,
  AreaPicker,
  LocationFields,
  type AreaFilter,
  type AreaNames,
  type Candidate,
} from "../components/AreaPicker";
import { money } from "../components/Finance";
import { Avatar, date, ErrorMessage, Icon } from "../components/ui";
import type { ServiceLevel } from "./Pricing";

interface Client {
  client_id: string;
  name: string;
  client_type: string;
  form_count: number;
}
interface Template {
  template_id: string;
  title: string;
  category: string;
  field_count: number;
  type_name: string | null;
  version: number;
  layout_mode: "docx" | "standard";
}

const STEPS = ["المُكلَّف", "المستعلم عنه", "الجهة والنموذج", "نوع الاستعلام والسعر", "المراجعة والإرسال"];

export default function NewInvestigationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"person" | "area">("area");
  const [filter, setFilter] = useState<AreaFilter | null>(null);
  const [matched, setMatched] = useState<Candidate[]>([]);
  const [people, setPeople] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [person, setPerson] = useState<Candidate | null>(null);
  const [subject, setSubject] = useState({
    subject_name: "",
    subject_phone: "",
    client_reference: "",
    address: "",
    landmark: "",
    admin_notes: "",
  });
  const [place, setPlace] = useState<AreaNames>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [levels, setLevels] = useState<ServiceLevel[]>([]);
  const [level, setLevel] = useState<ServiceLevel | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [prices, setPrices] = useState({ client_price: 0, investigator_price: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ investigators: Candidate[] }>(`/investigators?search=${encodeURIComponent(search)}`)
      .then((data) => setPeople(data.investigators))
      .catch(() => setPeople([]));
  }, [search]);
  useEffect(() => {
    api<{ levels: ServiceLevel[] }>("/investigations/service-levels")
      .then((data) => setLevels(data.levels.filter((item) => item.active)))
      .catch(() => setError("تعذّر تحميل أنواع الاستعلام."));
  }, []);
  useEffect(() => {
    api<{ clients: Client[] }>("/forms/clients")
      .then((data) => setClients(data.clients))
      .catch(() => setError("تعذّر تحميل الجهات."));
  }, []);
  useEffect(() => {
    if (!client) return;
    setTemplate(null);
    api<{ templates: Template[] }>(`/forms/templates?client=${client.client_id}`)
      .then((data) => setTemplates(data.templates))
      .catch(() => setError("تعذّر تحميل النماذج."));
  }, [client]);
  // An area chosen by name is almost always the subject's area too.
  useEffect(() => {
    if (filter?.mode === "hierarchy") {
      const { mode: _mode, ...names } = filter;
      setPlace(names);
    }
  }, [filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Template[]>();
    // Grouped by investigation type; each form is the client's active approved version.
    for (const item of templates) {
      const group = item.type_name ?? item.category;
      map.set(group, [...(map.get(group) ?? []), item]);
    }
    return [...map];
  }, [templates]);

  const canContinue = [
    mode === "person" ? Boolean(person) : matched.length > 0,
    Boolean(subject.subject_name.trim() && subject.address.trim()),
    Boolean(template),
    Boolean(level && (level.delivery_hours || scheduledAt)),
    true,
  ][step];
  const dueAt = level
    ? level.delivery_hours
      ? new Date(Date.now() + level.delivery_hours * 3_600_000).toISOString()
      : scheduledAt
        ? new Date(scheduledAt).toISOString()
        : null
    : null;

  async function send() {
    if (!template) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ reference: string }>("/investigations", {
        method: "POST",
        body: JSON.stringify({
          ...subject,
          ...place,
          template_id: template.template_id,
          service_level: level?.code,
          scheduled_at: level?.delivery_hours ? undefined : dueAt,
          ...prices,
          target_mode: mode,
          assignee_id: person?.user_id,
          area: filter,
        }),
      });
      navigate(`/investigations?sent=${encodeURIComponent(result.reference)}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر إرسال الاستعلام.");
      setBusy(false);
    }
  }

  const banks = clients.filter((item) => item.client_type === "bank");
  const companies = clients.filter((item) => item.client_type !== "bank");

  return (
    <div className="page-enter wizard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            الاستعلامات <span>/</span> استعلام جديد
          </p>
          <h1>أرسل استعلاماً.</h1>
          <p className="page-description">خمس خطوات، ويصل الاستعلام إلى المستعلم المناسب فوراً.</p>
        </div>
      </div>
      <ol className="wizard-steps">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? "active" : index < step ? "done" : ""}>
            <button type="button" disabled={index > step} onClick={() => setStep(index)}>
              <i>{index < step ? <Icon name="check" size={14} /> : index + 1}</i>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <ErrorMessage message={error} />
      <section className="glass wizard-panel">
        {step === 0 && (
          <>
            <div className="choice-pair">
              <button
                type="button"
                className={mode === "area" ? "choice active" : "choice"}
                onClick={() => setMode("area")}
              >
                <Icon name="globe" size={24} />
                <strong>توزيع تلقائي على الأقرب</strong>
                <span>يُعرض على الأقرب داخل المنطقة، ثم الذي يليه إن لم يقبل.</span>
              </button>
              <button
                type="button"
                className={mode === "person" ? "choice active" : "choice"}
                onClick={() => setMode("person")}
              >
                <Icon name="users" size={24} />
                <strong>مستعلم محدد</strong>
                <span>يُعرض عليه أولاً، وإن لم يقبل ينتقل للأقرب تلقائياً.</span>
              </button>
            </div>
            {mode === "area" ? (
              <AreaPicker filter={filter} onChange={setFilter} onMatched={setMatched} />
            ) : (
              <>
                <label className="field">
                  <span>ابحث بالاسم أو الرقم الوظيفي</span>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
                </label>
                <div className="person-grid">
                  {people.map((item, index) => (
                    <button
                      type="button"
                      key={item.user_id}
                      className={person?.user_id === item.user_id ? "person-card active" : "person-card"}
                      onClick={() => setPerson(item)}
                    >
                      <Avatar name={item.full_name} small color={index} />
                      <span>
                        <strong>{item.full_name}</strong>
                        <small>
                          {[item.governorate, item.district].filter(Boolean).join(" - ") || "لم يحدد منطقته بعد"}
                        </small>
                      </span>
                    </button>
                  ))}
                  {!people.length && <p className="hint">لا يوجد مستعلمون مطابقون.</p>}
                </div>
              </>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <div className="form-row">
              <label className="field">
                <span>اسم الشخص المطلوب الاستعلام عنه</span>
                <input
                  value={subject.subject_name}
                  onChange={(event) => setSubject({ ...subject, subject_name: event.target.value })}
                  autoFocus
                  required
                />
              </label>
              <label className="field">
                <span>
                  رقم الهاتف <small>(اختياري)</small>
                </span>
                <input
                  dir="ltr"
                  value={subject.subject_phone}
                  onChange={(event) => setSubject({ ...subject, subject_phone: event.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span>العنوان بالتفصيل</span>
              <input
                value={subject.address}
                onChange={(event) => setSubject({ ...subject, address: event.target.value })}
                required
              />
            </label>
            <LocationFields value={place} onChange={setPlace} />
            <div className="form-row">
              <label className="field">
                <span>
                  علامة مميزة <small>(اختياري)</small>
                </span>
                <input
                  value={subject.landmark}
                  onChange={(event) => setSubject({ ...subject, landmark: event.target.value })}
                />
              </label>
              <label className="field">
                <span>
                  مرجع العميل <small>(اختياري)</small>
                </span>
                <input
                  dir="ltr"
                  value={subject.client_reference}
                  onChange={(event) => setSubject({ ...subject, client_reference: event.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span>
                ملاحظات للمستعلم <small>(اختياري)</small>
              </span>
              <textarea
                rows={3}
                value={subject.admin_notes}
                onChange={(event) => setSubject({ ...subject, admin_notes: event.target.value })}
              />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            {[
              ["البنوك", banks],
              ["الشركات", companies],
            ].map(([label, list]) => (
              <div key={label as string}>
                <h3 className="group-title">{label as string}</h3>
                <div className="client-grid">
                  {(list as Client[]).map((item) => (
                    <button
                      type="button"
                      key={item.client_id}
                      className={client?.client_id === item.client_id ? "client-card active" : "client-card"}
                      onClick={() => setClient(item)}
                    >
                      <strong>{item.name}</strong>
                      <small>{item.form_count} نموذج</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {client && (
              <div className="form-picker">
                <h3 className="group-title">نموذج الاستعلام — {client.name}</h3>
                {!templates.length && <p className="hint">لا توجد نماذج مفعّلة لهذه الجهة. تُفعَّل النماذج من لوحة الإدارة العليا.</p>}
                {grouped.map(([category, items]) => (
                  <div className="form-group" key={category}>
                    <span className="badge">{category}</span>
                    <div className="form-options">
                      {items.map((item) => (
                        <button
                          type="button"
                          key={item.template_id}
                          className={template?.template_id === item.template_id ? "form-option active" : "form-option"}
                          onClick={() => setTemplate(item)}
                        >
                          <strong>{item.title}</strong>
                          <small>
                            {item.field_count} حقل · الإصدار {item.version}
                            {item.layout_mode === "docx" ? " · بتصميم العميل" : ""}
                          </small>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div className="level-grid">
              {levels.map((item) => (
                <button
                  type="button"
                  key={item.code}
                  className={level?.code === item.code ? "level-card active" : "level-card"}
                  onClick={() => {
                    setLevel(item);
                    setPrices({ client_price: item.client_price, investigator_price: item.investigator_price });
                  }}
                >
                  <strong>{item.name_ar}</strong>
                  <small dir="ltr">{item.name_en}</small>
                  <span className="level-time">
                    <Icon name="clock" size={14} />
                    {item.delivery_label}
                  </span>
                  <b>{item.client_price ? money(item.client_price) : "حسب الاتفاق"}</b>
                </button>
              ))}
            </div>
            {level && !level.delivery_hours && (
              <label className="field">
                <span>موعد الزيارة</span>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </label>
            )}
            {level && (
              <div className="form-row price-override">
                <label className="field">
                  <span>سعر العميل لهذا الاستعلام</span>
                  <input
                    type="number"
                    min={0}
                    value={prices.client_price}
                    onChange={(event) => setPrices({ ...prices, client_price: Number(event.target.value) || 0 })}
                  />
                </label>
                <label className="field">
                  <span>أجر المستعلم لهذا الاستعلام</span>
                  <input
                    type="number"
                    min={0}
                    value={prices.investigator_price}
                    onChange={(event) => setPrices({ ...prices, investigator_price: Number(event.target.value) || 0 })}
                  />
                </label>
              </div>
            )}
          </>
        )}

        {step === 4 && (
          <dl className="review-facts">
            <div>
              <dt>يُرسل إلى</dt>
              <dd>{mode === "person" ? person?.full_name : `${matched.length} مستعلم في المنطقة المحددة`}</dd>
            </div>
            <div>
              <dt>المستعلم عنه</dt>
              <dd>{subject.subject_name}</dd>
            </div>
            <div>
              <dt>العنوان</dt>
              <dd>{subject.address}</dd>
            </div>
            <div>
              <dt>المنطقة</dt>
              <dd>{AREA_LEVELS.map((level) => place[level.key]).filter(Boolean).join(" - ") || "—"}</dd>
            </div>
            <div>
              <dt>الجهة</dt>
              <dd>{client?.name}</dd>
            </div>
            <div>
              <dt>النموذج</dt>
              <dd>
                {template?.title}
                {template ? ` — الإصدار ${template.version}${template.layout_mode === "docx" ? " (تصميم العميل)" : ""}` : ""}
              </dd>
            </div>
            <div>
              <dt>نوع الاستعلام</dt>
              <dd>{level?.name_ar}</dd>
            </div>
            <div>
              <dt>الموعد النهائي</dt>
              <dd>{dueAt ? date(dueAt) : "—"}</dd>
            </div>
            <div>
              <dt>سعر العميل</dt>
              <dd>{money(prices.client_price)}</dd>
            </div>
            <div>
              <dt>أجر المستعلم</dt>
              <dd>{money(prices.investigator_price)}</dd>
            </div>
            <div>
              <dt>ربح الشركة</dt>
              <dd>{money(prices.client_price - prices.investigator_price)}</dd>
            </div>
          </dl>
        )}
      </section>
      <div className="wizard-foot">
        {step > 0 && (
          <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>
            السابق
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canContinue}
            onClick={() => setStep(step + 1)}
          >
            التالي
            <Icon name="arrow" size={16} />
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void send()}>
            {busy ? "جارٍ الإرسال…" : "إرسال الاستعلام"}
            <Icon name="arrow" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
