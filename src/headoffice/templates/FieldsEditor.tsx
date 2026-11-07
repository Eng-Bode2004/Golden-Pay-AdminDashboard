import { useState } from "react";
import { Icon, number } from "../../components/ui";
import {
  allFields,
  type Condition,
  type ConditionOp,
  type Definition,
  EVIDENCE_KINDS,
  type EvidenceRequirement,
  type FieldDef,
  type FieldType,
  fieldKey,
  OPS,
  PREFILL,
  type SectionDef,
  TYPE_LABELS,
} from "./model";

export interface Block {
  id: string;
  label: string;
  field: Omit<FieldDef, "key">;
}

function ConditionEditor({
  value,
  fields,
  onChange,
  label,
}: {
  value: Condition | undefined;
  fields: FieldDef[];
  onChange: (value: Condition | undefined) => void;
  label: string;
}) {
  const target = fields.find((field) => field.key === value?.field);
  const options = target?.type === "yesno" ? ["نعم", "لا"] : target?.options;
  return (
    <div className="tpl-condition">
      <label className="tpl-check">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked ? { field: fields[0]?.key ?? "", op: "eq", value: "" } : undefined)}
          disabled={!fields.length}
        />
        {label}
      </label>
      {value && (
        <div className="tpl-condition-row">
          <select value={value.field} onChange={(event) => onChange({ ...value, field: event.target.value })}>
            {fields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
          <select value={value.op} onChange={(event) => onChange({ ...value, op: event.target.value as ConditionOp })}>
            {(Object.keys(OPS) as ConditionOp[]).map((op) => (
              <option key={op} value={op}>
                {OPS[op]}
              </option>
            ))}
          </select>
          {!["filled", "empty"].includes(value.op) &&
            (options ? (
              <select value={String(value.value ?? "")} onChange={(event) => onChange({ ...value, value: event.target.value })}>
                <option value="">—</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input value={String(value.value ?? "")} onChange={(event) => onChange({ ...value, value: event.target.value })} />
            ))}
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="tpl-options">
      {options.map((option, index) => (
        <span className="tpl-option" key={`${option}-${index}`}>
          <input
            value={option}
            onChange={(event) => onChange(options.map((item, position) => (position === index ? event.target.value : item)))}
            aria-label={`الخيار ${index + 1}`}
          />
          <button type="button" onClick={() => onChange(options.filter((_, position) => position !== index))} aria-label="حذف الخيار">
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}
      <input
        className="tpl-option-new"
        placeholder="خيار جديد ثم Enter"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && draft.trim()) {
            event.preventDefault();
            onChange([...options, draft.trim()]);
            setDraft("");
          }
        }}
      />
    </div>
  );
}

function EvidenceEditor({ field, fields, onChange }: { field: FieldDef; fields: FieldDef[]; onChange: (field: FieldDef) => void }) {
  const evidence = field.evidence ?? { kind: "visit" as const, requires: [] };
  const set = (requires: EvidenceRequirement[]) => onChange({ ...field, evidence: { ...evidence, requires } });
  return (
    <div className="tpl-evidence">
      <label className="field">
        <span>العبارة كما تُطبع</span>
        <textarea rows={3} value={field.statement ?? ""} onChange={(event) => onChange({ ...field, statement: event.target.value })} />
      </label>
      <div className="form-row">
        <label className="field">
          <span>نوع الإقرار</span>
          <select value={evidence.kind} onChange={(event) => onChange({ ...field, evidence: { ...evidence, kind: event.target.value as typeof evidence.kind } })}>
            {Object.entries(EVIDENCE_KINDS).map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="tpl-evidence-list">
        <span>لا تُطبع العبارة إلا مع:</span>
        {evidence.requires.map((need, index) => (
          <div className="tpl-evidence-item" key={index}>
            {need.type === "gps" && (
              <>
                <Icon name="globe" size={14} /> موقع مسجّل
                <label>
                  ضمن
                  <input
                    type="number"
                    min={0}
                    value={need.max_meters ?? ""}
                    placeholder="أي مسافة"
                    onChange={(event) =>
                      set(evidence.requires.map((item, position) => (position === index ? { ...item, max_meters: event.target.value ? Number(event.target.value) : undefined } : item)))
                    }
                  />
                  م من العنوان
                </label>
              </>
            )}
            {need.type === "photos" && (
              <>
                <Icon name="file" size={14} />
                <input
                  type="number"
                  min={1}
                  value={need.min ?? 1}
                  onChange={(event) => set(evidence.requires.map((item, position) => (position === index ? { ...item, min: Number(event.target.value) || 1 } : item)))}
                />
                صورة في
                <select
                  value={need.field ?? ""}
                  onChange={(event) => set(evidence.requires.map((item, position) => (position === index ? { ...item, field: event.target.value || undefined } : item)))}
                >
                  <option value="">أي حقل صور</option>
                  {fields.filter((item) => item.type === "photos").map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            {need.type === "filled" && (
              <>
                <Icon name="check" size={14} /> إدخال
                <select
                  value={need.field ?? ""}
                  onChange={(event) => set(evidence.requires.map((item, position) => (position === index ? { ...item, field: event.target.value } : item)))}
                >
                  {fields.filter((item) => !["photos", "signature", "attestation"].includes(item.type)).map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button type="button" className="icon-button" onClick={() => set(evidence.requires.filter((_, position) => position !== index))} aria-label="حذف الشرط">
              <Icon name="close" size={12} />
            </button>
          </div>
        ))}
        <div className="tpl-evidence-add">
          <button type="button" className="btn small ghost" onClick={() => set([...evidence.requires, { type: "gps", max_meters: 1000 }])}>
            + موقع
          </button>
          <button type="button" className="btn small ghost" onClick={() => set([...evidence.requires, { type: "photos", min: 1 }])}>
            + صور
          </button>
          <button
            type="button"
            className="btn small ghost"
            onClick={() => set([...evidence.requires, { type: "filled", field: fields.find((item) => !["photos", "signature", "attestation"].includes(item.type))?.key ?? "" }])}
          >
            + حقل مُدخل
          </button>
        </div>
      </div>
    </div>
  );
}

function ColumnsEditor({ columns, onChange }: { columns: FieldDef[]; onChange: (columns: FieldDef[]) => void }) {
  const set = (index: number, patch: Partial<FieldDef>) => onChange(columns.map((column, position) => (position === index ? { ...column, ...patch } : column)));
  const types: FieldType[] = ["text", "textarea", "number", "date", "phone", "national_id", "choice", "yesno"];
  return (
    <div className="tpl-columns">
      {columns.map((column, index) => (
        <div className="tpl-column" key={index}>
          <input value={column.label} onChange={(event) => set(index, { label: event.target.value })} aria-label="اسم العمود" />
          <select value={column.type} onChange={(event) => set(index, { type: event.target.value as FieldType, options: event.target.value === "choice" ? (column.options ?? ["خيار"]) : undefined })}>
            {types.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <label className="tpl-check">
            <input type="checkbox" checked={column.required === true} onChange={(event) => set(index, { required: event.target.checked })} />
            مطلوب
          </label>
          <button type="button" className="icon-button" onClick={() => onChange(columns.filter((_, position) => position !== index))} aria-label="حذف العمود">
            <Icon name="close" size={12} />
          </button>
          {column.type === "choice" && <OptionsEditor options={column.options ?? []} onChange={(options) => set(index, { options })} />}
        </div>
      ))}
      <button
        type="button"
        className="btn small ghost"
        onClick={() => onChange([...columns, { key: `c${columns.length + 1}_${Math.random().toString(16).slice(2, 5)}`, label: "عمود جديد", type: "text" }])}
      >
        + عمود
      </button>
    </div>
  );
}

function FieldCard({
  field,
  fields,
  open,
  readOnly,
  bound,
  onToggle,
  onChange,
  onRemove,
  onMove,
}: {
  field: FieldDef;
  fields: FieldDef[];
  open: boolean;
  readOnly: boolean;
  bound: boolean;
  onToggle: () => void;
  onChange: (field: FieldDef) => void;
  onRemove: () => void;
  onMove: (by: number) => void;
}) {
  const others = fields.filter((item) => item.key !== field.key && !["photos", "signature", "table"].includes(item.type));
  const setType = (type: FieldType) => {
    const next: FieldDef = { ...field, type };
    if ((type === "choice" || type === "multichoice") && !next.options?.length) next.options = ["خيار 1", "خيار 2"];
    if (type === "table" && !next.columns?.length) next.columns = [{ key: "c1", label: "عمود 1", type: "text" }];
    if (type === "attestation") {
      next.statement ??= field.label;
      next.evidence ??= { kind: "visit", requires: [{ type: "gps", max_meters: 1000 }, { type: "photos", min: 1 }] };
      delete next.default;
    }
    onChange(next);
  };
  return (
    <div className={`tpl-field ${open ? "open" : ""} t-${field.type}`}>
      <div className="tpl-field-row">
        <button type="button" className="tpl-field-summary" onClick={onToggle} aria-expanded={open}>
          <span className="tpl-field-type">{TYPE_LABELS[field.type]}</span>
          <strong>{field.label}</strong>
          {field.required && <span className="tpl-req">مطلوب</span>}
          {field.required_if && <span className="tpl-req soft">مطلوب بشرط</span>}
          {field.visible_if && <span className="tpl-cond">يظهر بشرط</span>}
          {field.prefill && <span className="tpl-cond">من الحالة</span>}
          {!bound && field.type !== "photos" && <span className="tpl-unplaced" title="ليس له مكان في التصميم؛ يُطبع في الملحق">ملحق</span>}
        </button>
        {!readOnly && (
          <span className="editor-tools">
            <button type="button" aria-label="نقل لأعلى" onClick={() => onMove(-1)}>
              <Icon name="chevron" size={15} className="turn-up" />
            </button>
            <button type="button" aria-label="نقل لأسفل" onClick={() => onMove(1)}>
              <Icon name="chevron" size={15} className="turn-down" />
            </button>
            <button type="button" aria-label="حذف الحقل" onClick={onRemove}>
              <Icon name="close" size={15} />
            </button>
          </span>
        )}
      </div>
      {open && (
        <fieldset className="tpl-field-body" disabled={readOnly}>
          <div className="form-row">
            <label className="field wide">
              <span>السؤال كما يراه المستعلم</span>
              <input value={field.label} onChange={(event) => onChange({ ...field, label: event.target.value })} />
            </label>
            <label className="field">
              <span>النوع</span>
              <select value={field.type} onChange={(event) => setType(event.target.value as FieldType)}>
                {(Object.keys(TYPE_LABELS) as FieldType[]).map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="tpl-flags">
            <label className="tpl-check">
              <input type="checkbox" checked={field.required === true} onChange={(event) => onChange({ ...field, required: event.target.checked || undefined })} />
              مطلوب دائمًا
            </label>
            <code className="tpl-key" title="مفتاح الحقل في البيانات">
              {field.key}
            </code>
          </div>
          {["choice", "multichoice"].includes(field.type) && (
            <div className="field">
              <span>الخيارات</span>
              <OptionsEditor options={field.options ?? []} onChange={(options) => onChange({ ...field, options })} />
            </div>
          )}
          {field.type === "table" && (
            <div className="field">
              <span>أعمدة الجدول (صف لكل شريك، فرع، مخزن…)</span>
              <ColumnsEditor columns={field.columns ?? []} onChange={(columns) => onChange({ ...field, columns })} />
              <div className="form-row">
                <label className="field">
                  <span>أقل عدد صفوف</span>
                  <input type="number" min={0} value={field.min_rows ?? ""} onChange={(event) => onChange({ ...field, min_rows: event.target.value ? Number(event.target.value) : undefined })} />
                </label>
                <label className="field">
                  <span>أكبر عدد صفوف</span>
                  <input type="number" min={1} value={field.max_rows ?? ""} onChange={(event) => onChange({ ...field, max_rows: event.target.value ? Number(event.target.value) : undefined })} />
                </label>
              </div>
            </div>
          )}
          {field.type === "photos" && (
            <div className="form-row">
              <label className="field">
                <span>أقل عدد صور</span>
                <input type="number" min={0} value={field.min_items ?? ""} onChange={(event) => onChange({ ...field, min_items: event.target.value ? Number(event.target.value) : undefined })} />
              </label>
              <label className="field">
                <span>أكبر عدد صور</span>
                <input type="number" min={1} value={field.max_items ?? ""} onChange={(event) => onChange({ ...field, max_items: event.target.value ? Number(event.target.value) : undefined })} />
              </label>
            </div>
          )}
          {field.type === "attestation" && <EvidenceEditor field={field} fields={fields} onChange={onChange} />}
          {["text", "textarea", "number", "phone", "national_id"].includes(field.type) && (
            <div className="form-row">
              {field.type === "number" ? (
                <>
                  <label className="field">
                    <span>أقل قيمة</span>
                    <input type="number" value={field.validation?.min ?? ""} onChange={(event) => onChange({ ...field, validation: { ...field.validation, min: event.target.value === "" ? undefined : Number(event.target.value) } })} />
                  </label>
                  <label className="field">
                    <span>أكبر قيمة</span>
                    <input type="number" value={field.validation?.max ?? ""} onChange={(event) => onChange({ ...field, validation: { ...field.validation, max: event.target.value === "" ? undefined : Number(event.target.value) } })} />
                  </label>
                </>
              ) : (
                <label className="field">
                  <span>أقصى عدد أحرف</span>
                  <input type="number" min={1} value={field.validation?.max_length ?? ""} onChange={(event) => onChange({ ...field, validation: { ...field.validation, max_length: event.target.value ? Number(event.target.value) : undefined } })} />
                </label>
              )}
              {!["number"].includes(field.type) && (
                <label className="field">
                  <span>يبدأ من بيانات الحالة</span>
                  <select value={field.prefill ?? ""} onChange={(event) => onChange({ ...field, prefill: event.target.value || undefined })}>
                    <option value="">لا — يكتبه المستعلم</option>
                    {Object.entries(PREFILL).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          <ConditionEditor label="يظهر فقط إذا" value={field.visible_if} fields={others} onChange={(visible_if) => onChange({ ...field, visible_if })} />
          <ConditionEditor label="يصبح مطلوبًا إذا" value={field.required_if} fields={others} onChange={(required_if) => onChange({ ...field, required_if })} />
          <label className="field">
            <span>إرشاد للمستعلم (اختياري)</span>
            <input value={field.help ?? ""} onChange={(event) => onChange({ ...field, help: event.target.value || undefined })} />
          </label>
        </fieldset>
      )}
    </div>
  );
}

export function FieldsEditor({
  definition,
  readOnly,
  blocks,
  placed,
  onChange,
}: {
  definition: Definition;
  readOnly: boolean;
  blocks: Block[];
  placed: Set<string>;
  onChange: (definition: Definition) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const fields = allFields(definition);
  const taken = new Set(fields.map((field) => field.key));

  const setSection = (index: number, section: SectionDef) =>
    onChange({ ...definition, sections: definition.sections.map((item, position) => (position === index ? section : item)) });
  const addField = (index: number, field: FieldDef) => {
    const section = definition.sections[index]!;
    setSection(index, { ...section, fields: [...section.fields, field] });
    setOpen(field.key);
  };
  const moveField = (s: number, f: number, by: number) => {
    const section = definition.sections[s]!;
    if (f + by < 0 || f + by >= section.fields.length) return;
    const list = [...section.fields];
    const [moved] = list.splice(f, 1);
    list.splice(f + by, 0, moved!);
    setSection(s, { ...section, fields: list });
  };

  return (
    <div className="tpl-fields">
      {definition.sections.map((section, s) => (
        <section className="glass panel tpl-section" key={section.id}>
          <div className="tpl-section-head">
            <input
              className="section-title-input"
              value={section.title}
              disabled={readOnly}
              onChange={(event) => setSection(s, { ...section, title: event.target.value })}
              aria-label="عنوان القسم"
            />
            <small>{number(section.fields.length)} حقل</small>
            {!readOnly && section.fields.length === 0 && (
              <button className="icon-button" onClick={() => onChange({ ...definition, sections: definition.sections.filter((_, position) => position !== s) })} aria-label="حذف القسم">
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          <ConditionEditor
            label="يظهر القسم فقط إذا"
            value={section.visible_if}
            fields={fields.filter((field) => !section.fields.includes(field) && !["photos", "signature", "table"].includes(field.type))}
            onChange={(visible_if) => setSection(s, { ...section, visible_if })}
          />
          {section.fields.map((field, f) => (
            <FieldCard
              key={field.key}
              field={field}
              fields={fields}
              open={open === field.key}
              readOnly={readOnly}
              bound={placed.has(field.key)}
              onToggle={() => setOpen(open === field.key ? null : field.key)}
              onChange={(next) => setSection(s, { ...section, fields: section.fields.map((item) => (item.key === field.key ? next : item)) })}
              onRemove={() => setSection(s, { ...section, fields: section.fields.filter((item) => item.key !== field.key) })}
              onMove={(by) => moveField(s, f, by)}
            />
          ))}
          {!readOnly && (
            <div className="tpl-section-add">
              <button className="btn small ghost" onClick={() => addField(s, { key: fieldKey("", taken), label: "سؤال جديد", type: "text" })}>
                <Icon name="plus" size={14} />
                حقل
              </button>
              <select
                className="tpl-block-picker"
                value=""
                onChange={(event) => {
                  const block = blocks.find((item) => item.id === event.target.value);
                  if (!block) return;
                  let key = block.id;
                  let n = 2;
                  while (taken.has(key)) key = `${block.id}_${n++}`;
                  addField(s, { ...block.field, key } as FieldDef);
                }}
              >
                <option value="">+ جدول جاهز…</option>
                {blocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>
      ))}
      {!readOnly && (
        <button
          className="btn ghost tpl-add-section"
          onClick={() => onChange({ ...definition, sections: [...definition.sections, { id: `s${Date.now().toString(36)}`, title: "قسم جديد", fields: [] }] })}
        >
          <Icon name="plus" size={16} />
          قسم جديد
        </button>
      )}
    </div>
  );
}
