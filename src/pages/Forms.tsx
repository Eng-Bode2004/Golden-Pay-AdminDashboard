import { useEffect, useState } from "react";
import { api } from "../api";
import { ErrorMessage, Icon } from "../components/ui";

interface Client {
  client_id: string;
  name: string;
  client_type: string;
  form_count: number;
}
interface Summary {
  template_id: string;
  title: string;
  category: string;
  type_name: string | null;
  version: number;
  layout_mode: "docx" | "standard";
  field_count: number;
  client_name: string;
}
interface Field {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  statement?: string;
  columns?: { key: string; label: string }[];
}
interface Section {
  title: string;
  fields: Field[];
}

const TYPES: Record<string, string> = {
  text: "نص قصير",
  textarea: "نص طويل",
  number: "رقم",
  date: "تاريخ",
  time: "وقت",
  phone: "رقم هاتف",
  national_id: "رقم قومي",
  choice: "اختيار واحد",
  multichoice: "اختيار متعدد",
  yesno: "نعم / لا",
  photos: "صور",
  signature: "توقيع",
  table: "جدول متكرر",
  attestation: "عبارة تحتاج دليلًا",
};

/** Read-only: forms change only through versions that Head Office reviews and approves. */
function FormView({ id, onClose }: { id: string; onClose: () => void }) {
  const [form, setForm] = useState<{ title: string; client_name: string; version_no: number; layout_mode: string; sections: Section[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ template: NonNullable<typeof form> }>(`/forms/templates/${id}`)
      .then((data) => setForm(data.template))
      .catch(() => setError("تعذّر تحميل النموذج."));
  }, [id]);
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            النماذج <span>/</span> {form?.client_name ?? "…"}
          </p>
          <h1>
            {form?.title ?? "…"} <span>الإصدار {form?.version_no ?? "…"}</span>
          </h1>
          <p className="page-description">
            {form?.layout_mode === "docx" ? "يُطبع التقرير بتصميم العميل نفسه. " : "يُطبع التقرير بالتصميم الموحّد. "}
            تعديل النماذج يتم من لوحة الإدارة العليا كإصدار جديد يُراجَع ويُعتمد قبل استخدامه.
          </p>
        </div>
        <button className="btn ghost" onClick={onClose}>
          رجوع
        </button>
      </div>
      <ErrorMessage message={error} />
      <div className="stack">
        {form?.sections.map((section, index) => (
          <section className="glass panel" key={index}>
            <div className="panel-heading">
              <h2>{section.title}</h2>
              <small>{section.fields.length} حقل</small>
            </div>
            <dl className="review-facts answer-list">
              {section.fields.map((field) => (
                <div key={field.key}>
                  <dt>
                    {field.label}
                    {field.required ? " *" : ""}
                  </dt>
                  <dd>
                    {TYPES[field.type] ?? field.type}
                    {field.options?.length ? ` — ${field.options.join("، ")}` : ""}
                    {field.columns?.length ? ` — ${field.columns.map((column) => column.label).join("، ")}` : ""}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

export function FormsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [client, setClient] = useState<string | null>(null);
  const [forms, setForms] = useState<Summary[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ clients: Client[] }>("/forms/clients")
      .then((data) => setClients(data.clients))
      .catch(() => setError("تعذّر تحميل الجهات."));
  }, []);
  useEffect(() => {
    api<{ templates: Summary[] }>(`/forms/templates${client ? `?client=${client}` : ""}`)
      .then((data) => setForms(data.templates))
      .catch(() => setError("تعذّر تحميل النماذج."));
  }, [client]);

  if (viewing) return <FormView id={viewing} onClose={() => setViewing(null)} />;

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            مساحة العمل <span>/</span> النماذج
          </p>
          <h1>
            نماذج الاستعلام. <span>لكل بنك وشركة.</span>
          </h1>
          <p className="page-description">النماذج المفعّلة الآن، بالإصدار الذي تستخدمه الاستعلامات الجديدة. تديرها الإدارة العليا وتعتمد كل تغيير.</p>
        </div>
      </div>
      <ErrorMessage message={error} />
      <div className="segmented client-tabs">
        <button className={client === null ? "active" : ""} onClick={() => setClient(null)}>
          الكل
        </button>
        {clients.map((item) => (
          <button key={item.client_id} className={client === item.client_id ? "active" : ""} onClick={() => setClient(item.client_id)}>
            {item.name}
          </button>
        ))}
      </div>
      <div className="request-grid forms-grid">
        {forms.map((form) => (
          <article className="glass form-card" key={form.template_id}>
            <span className="badge">{form.type_name ?? form.category}</span>
            <h2>{form.title}</h2>
            <p>{form.client_name}</p>
            <small>
              {form.field_count} حقل · الإصدار {form.version}
              {form.layout_mode === "docx" ? " · بتصميم العميل" : ""}
            </small>
            <button className="btn small" onClick={() => setViewing(form.template_id)}>
              <Icon name="file" size={14} />
              عرض الحقول
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
