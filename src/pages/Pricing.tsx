import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../api";
import { money } from "../components/Finance";
import { ErrorMessage, Icon } from "../components/ui";

export interface ServiceLevel {
  code: string;
  name_ar: string;
  name_en: string;
  delivery_label: string;
  delivery_hours: number | null;
  accept_minutes: number;
  client_price: number;
  investigator_price: number;
  active: boolean;
}

function LevelCard({ level, onSaved }: { level: ServiceLevel; onSaved: (next: ServiceLevel) => void }) {
  const [draft, setDraft] = useState(level);
  const [unit, setUnit] = useState<"minutes" | "hours">(
    level.accept_minutes >= 60 && level.accept_minutes % 60 === 0 ? "hours" : "minutes",
  );
  const acceptValue = unit === "hours" ? draft.accept_minutes / 60 : draft.accept_minutes;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const changed = JSON.stringify(draft) !== JSON.stringify(level);
  const profit = draft.client_price - draft.investigator_price;

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { level: saved } = await api<{ level: ServiceLevel }>(`/investigations/service-levels/${level.code}`, {
        method: "PATCH",
        body: JSON.stringify({
          name_ar: draft.name_ar,
          delivery_label: draft.delivery_label,
          ...(level.code === "scheduled" ? {} : { delivery_hours: draft.delivery_hours }),
          accept_minutes: draft.accept_minutes,
          client_price: draft.client_price,
          investigator_price: draft.investigator_price,
          active: draft.active,
        }),
      });
      onSaved(saved);
      setDraft(saved);
      setMessage("تم الحفظ. تسري الأسعار الجديدة على الاستعلامات الجديدة فقط.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر حفظ الأسعار.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={draft.active ? "glass price-card" : "glass price-card inactive"}>
      <header>
        <div>
          <input
            className="price-title"
            aria-label="اسم النوع"
            value={draft.name_ar}
            onChange={(event) => setDraft({ ...draft, name_ar: event.target.value })}
          />
          <small dir="ltr">{level.name_en}</small>
        </div>
        <label className="price-toggle">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
          />
          متاح
        </label>
      </header>
      <div className="form-row">
        <label className="field">
          <span>مدة التسليم (للعرض)</span>
          <input
            value={draft.delivery_label}
            onChange={(event) => setDraft({ ...draft, delivery_label: event.target.value })}
          />
        </label>
        <label className="field">
          <span>الموعد النهائي بالساعات</span>
          <input
            type="number"
            min={1}
            disabled={level.code === "scheduled"}
            placeholder={level.code === "scheduled" ? "يُحدد لكل استعلام" : ""}
            value={draft.delivery_hours ?? ""}
            onChange={(event) => setDraft({ ...draft, delivery_hours: Number(event.target.value) || null })}
          />
        </label>
      </div>
      <div className="field accept-window">
        <span>مهلة القبول قبل التحويل لمستعلم آخر</span>
        <div className="accept-input">
          <input
            type="number"
            min={1}
            aria-label="مهلة القبول"
            value={acceptValue}
            onChange={(event) => {
              const value = Math.max(1, Number(event.target.value) || 1);
              setDraft({ ...draft, accept_minutes: Math.round(unit === "hours" ? value * 60 : value) });
            }}
          />
          <div className="segmented">
            <button type="button" className={unit === "minutes" ? "active" : ""} onClick={() => setUnit("minutes")}>
              دقيقة
            </button>
            <button type="button" className={unit === "hours" ? "active" : ""} onClick={() => setUnit("hours")}>
              ساعة
            </button>
          </div>
        </div>
        <small className="field-hint">
          إن لم يقبل المستعلم خلال هذه المدة ينتقل الاستعلام تلقائياً إلى الأقرب: القرية التابعة ثم الأم ثم الوحدة
          المحلية ثم المركز ثم المحافظة.
        </small>
      </div>
      <div className="form-row">
        <label className="field">
          <span>سعر العميل (البنك / الشركة)</span>
          <input
            type="number"
            min={0}
            value={draft.client_price}
            onChange={(event) => setDraft({ ...draft, client_price: Number(event.target.value) || 0 })}
          />
        </label>
        <label className="field">
          <span>أجر المستعلم</span>
          <input
            type="number"
            min={0}
            value={draft.investigator_price}
            onChange={(event) => setDraft({ ...draft, investigator_price: Number(event.target.value) || 0 })}
          />
        </label>
      </div>
      <div className={profit < 0 ? "price-margin negative" : "price-margin"}>
        <span>ربح الشركة لكل استعلام</span>
        <strong>{money(profit)}</strong>
      </div>
      <ErrorMessage message={error} />
      {message && <p className="hint">{message}</p>}
      <button className="btn btn-primary btn-block" disabled={!changed || busy} onClick={() => void save()}>
        {busy ? "جارٍ الحفظ…" : "حفظ"}
      </button>
    </article>
  );
}

export function PricingPage() {
  const [levels, setLevels] = useState<ServiceLevel[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ levels: ServiceLevel[] }>("/investigations/service-levels")
      .then((data) => setLevels(data.levels))
      .catch(() => setError("تعذّر تحميل أنواع الاستعلام."));
  }, []);

  const unpriced = levels.filter((level) => level.active && !level.client_price).length;

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            مساحة العمل <span>/</span> الأسعار
          </p>
          <h1>
            أنواع الاستعلام. <span>بأسعارك أنت.</span>
          </h1>
          <p className="page-description">
            حدّد لكل نوع مدة التسليم وما يدفعه العميل وما يحصل عليه المستعلم.
          </p>
        </div>
      </div>
      <ErrorMessage message={error} />
      {unpriced > 0 && (
        <p className="notice-banner">
          <Icon name="bell" size={16} />
          {unpriced} أنواع بلا سعر بعد. الاستعلامات المرسلة بها لن تظهر في الأرباح.
        </p>
      )}
      <div className="price-grid">
        {levels.map((level) => (
          <LevelCard
            key={level.code}
            level={level}
            onSaved={(next) => setLevels(levels.map((item) => (item.code === next.code ? next : item)))}
          />
        ))}
      </div>
    </div>
  );
}
