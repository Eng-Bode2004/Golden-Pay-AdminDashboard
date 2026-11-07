import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiRequestError } from "../../api";
import { date, ErrorMessage, Icon, number } from "../../components/ui";
import { STATUS, type VersionStatus } from "./model";
import { UploadDrawer } from "./TemplatesLibrary";

interface Detail {
  template: {
    template_id: string;
    title: string;
    client_id: string;
    client_name: string;
    investigation_type: string | null;
    type_name: string | null;
    active: boolean;
    active_version_id: string | null;
  };
  versions: {
    version_id: string;
    version_no: number;
    status: VersionStatus;
    layout_mode: "docx" | "standard";
    change_note: string | null;
    created_at: string;
    submitted_at: string | null;
    reviewed_at: string | null;
    activated_at: string | null;
    retired_at: string | null;
    content_hash: string | null;
    review_note: string | null;
    warnings: number;
    created_by_name: string | null;
    reviewed_by_name: string | null;
    cases: number;
  }[];
}

export interface TemplateEvent {
  event_id: string;
  type: string;
  note: string | null;
  actor_name: string | null;
  created_at: string;
  version_no: number | null;
  template_title: string | null;
  metadata: Record<string, unknown> | null;
}

export const EVENT_LABELS: Record<string, string> = {
  "file.uploaded": "رُفع ملف",
  "template.created": "أُنشئ القالب",
  "template.updated": "عُدّلت بيانات القالب",
  "template.enabled": "شُغّل القالب للاستعلامات الجديدة",
  "template.disabled": "أُوقف القالب",
  "version.migrated": "رُحّل النموذج القديم كإصدار",
  "version.drafted": "أُنشئت مسودة من الملف الأصلي",
  "version.edited": "عُدّلت المسودة",
  "version.cloned": "أُنشئت نسخة للتعديل",
  "version.rescanned": "أُعيد فحص الملف الأصلي",
  "version.configured": "أُكمل الربط آليًا من الملف الأصلي",
  "version.fingerprint_fixed": "صُحّحت بصمة المحتوى",
  "version.discarded": "حُذفت المسودة",
  "version.submitted": "أُرسل للمراجعة",
  "version.withdrawn": "سُحب من المراجعة",
  "version.returned": "أُعيد للتعديل",
  "version.approved": "اعتُمد",
  "version.activated": "فُعّل",
  "client.created": "أُضيف عميل",
  "client.updated": "عُدّلت بيانات العميل",
};

export function EventList({ events }: { events: TemplateEvent[] }) {
  return (
    <ol className="tpl-events">
      {events.map((event) => (
        <li key={event.event_id} className={`ev-${event.type.split(".")[1] ?? "x"}`}>
          <i />
          <div>
            <strong>
              {EVENT_LABELS[event.type] ?? event.type}
              {event.version_no ? <span> · الإصدار {number(event.version_no)}</span> : null}
            </strong>
            {event.note && <p>{event.note}</p>}
            <small>
              {event.actor_name ?? (event.metadata ? "النظام" : "النظام")} · {date(event.created_at)}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TemplateDetailPage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [events, setEvents] = useState<TemplateEvent[]>([]);
  const [types, setTypes] = useState<{ code: string; name: string }[]>([]);
  const [clients, setClients] = useState<{ client_id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api<Detail>(`/forms/admin/templates/${templateId}`)
      .then(setDetail)
      .catch(() => setError("تعذّر تحميل القالب."));
    api<{ events: TemplateEvent[] }>(`/forms/admin/events?template_id=${templateId}`)
      .then((data) => setEvents(data.events))
      .catch(() => undefined);
  }, [templateId, reload]);
  useEffect(() => {
    api<{ types: { code: string; name: string }[] }>("/forms/types").then((data) => setTypes(data.types)).catch(() => undefined);
    api<{ clients: { client_id: string; name: string }[] }>("/forms/clients").then((data) => setClients(data.clients)).catch(() => undefined);
  }, []);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      setReload((value) => value + 1);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر تنفيذ الإجراء.");
    } finally {
      setBusy(false);
    }
  };
  const clone = (versionId: string) =>
    run(async () => {
      const data = await api<{ version: { version_id: string } }>(`/forms/admin/versions/${versionId}/clone`, { method: "POST", body: "{}" });
      navigate(`/templates/versions/${data.version.version_id}`);
    });

  const template = detail?.template;
  const active = detail?.versions.find((version) => version.status === "active");
  return (
    <div className="page-enter tpl-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Link to="/templates">القوالب والتقارير</Link> <span>/</span> {template?.client_name ?? "…"}
          </p>
          <h1>
            {template?.title ?? "…"} <span>{template?.type_name ?? ""}</span>
          </h1>
          <p className="page-description">
            كل إصدار ثابت بعد إرساله للمراجعة. الاستعلامات تحتفظ بالإصدار الذي أُرسلت به، فتغيير القالب لا يمس أي حالة جارية.
          </p>
        </div>
        <div className="heading-actions">
          {template && (
            <button
              className={`btn tpl-toggle ${template.active ? "on" : ""}`}
              disabled={busy || (!template.active && !active)}
              title={!active ? "اعتمد وفعّل إصدارًا أولًا" : undefined}
              onClick={() =>
                void run(() => api(`/forms/admin/templates/${template.template_id}`, { method: "PATCH", body: JSON.stringify({ active: !template.active }) }))
              }
            >
              <span className="tpl-toggle-track">
                <i />
              </span>
              {template.active ? "مفعّل للاستعلامات الجديدة" : "متوقف"}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setUploading(true)} disabled={!template}>
            <Icon name="plus" size={16} />
            رفع إصدار جديد
          </button>
        </div>
      </div>
      <ErrorMessage message={error} />

      {template && (
        <div className="tpl-detail-grid">
          <section className="glass panel">
            <div className="panel-heading">
              <h2>الإصدارات</h2>
              <label className="field tpl-inline-field">
                <span>نوع الاستعلام</span>
                <select
                  value={template.investigation_type ?? ""}
                  onChange={(event) =>
                    void run(() =>
                      api(`/forms/admin/templates/${template.template_id}`, { method: "PATCH", body: JSON.stringify({ investigation_type: event.target.value }) }),
                    )
                  }
                >
                  <option value="" disabled>
                    غير مصنف
                  </option>
                  {types.map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ol className="tpl-versions">
              {detail!.versions.map((version) => (
                <li key={version.version_id} className={`s-${STATUS[version.status].tone}`}>
                  <div className="tpl-version-badge">
                    <span>ع</span>
                    {number(version.version_no)}
                  </div>
                  <div className="tpl-version-body">
                    <div className="tpl-version-title">
                      <span className={`tpl-status s-${STATUS[version.status].tone}`}>{STATUS[version.status].label}</span>
                      <span className={`tpl-layout ${version.layout_mode}`}>
                        {version.layout_mode === "docx" ? "تصميم العميل" : "التصميم الموحّد"}
                      </span>
                      {version.cases > 0 && <small>{number(version.cases)} استعلام بهذا الإصدار</small>}
                    </div>
                    {version.change_note && <p>{version.change_note}</p>}
                    {version.review_note && version.status === "draft" && (
                      <p className="tpl-review-note">
                        <Icon name="message" size={14} /> ملاحظة المراجع: {version.review_note}
                      </p>
                    )}
                    <small>
                      {version.created_by_name ?? "النظام"} · {date(version.created_at)}
                      {version.reviewed_by_name ? ` · راجعه ${version.reviewed_by_name}` : ""}
                      {version.content_hash ? (
                        <span className="tpl-hash" title={version.content_hash}>
                          {" "}
                          · بصمة {version.content_hash.slice(0, 10)}
                        </span>
                      ) : null}
                    </small>
                  </div>
                  <div className="tpl-version-actions">
                    <Link className="btn small" to={`/templates/versions/${version.version_id}`}>
                      {version.status === "draft" ? "متابعة التعديل" : version.status === "in_review" ? "مراجعة" : "عرض"}
                    </Link>
                    {["active", "retired", "approved"].includes(version.status) && (
                      <button className="btn small ghost" disabled={busy} onClick={() => void clone(version.version_id)}>
                        نسخة للتعديل
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="glass panel">
            <div className="panel-heading">
              <h2>سجل التغييرات</h2>
              <Icon name="history" size={18} />
            </div>
            <EventList events={events} />
          </section>
        </div>
      )}

      {uploading && template && (
        <UploadDrawer
          onClose={() => setUploading(false)}
          types={types}
          clients={clients}
          presetTemplate={{ template_id: template.template_id, title: template.title }}
        />
      )}
    </div>
  );
}
