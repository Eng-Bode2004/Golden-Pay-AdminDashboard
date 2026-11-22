import { useState } from "react";
import { Icon, number } from "./ui";
import "../client-filter.css";

export interface FilterClient {
  client_id: string;
  name: string;
  client_type: string | null;
  total: number;
  to_review: number;
}

const key = (userId: string) => `gp.investigations.clients.${userId}`;

/** Each administrator's companies and banks, remembered for them in this browser. */
export function useSavedClients(userId: string): [string[], (ids: string[]) => void] {
  const [ids, setIds] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? "[]");
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  });
  const save = (next: string[]) => {
    setIds(next);
    try {
      localStorage.setItem(key(userId), JSON.stringify(next));
    } catch {
      // Without storage the choice lasts until the page is left.
    }
  };
  return [ids, save];
}

/**
 * The companies and banks to show: none chosen means all. Each shows how many reports wait
 * for review, which is what an administrator responsible for them looks for.
 */
export function ClientFilter({
  clients,
  value,
  onChange,
}: {
  clients: FilterClient[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  const groups = [
    { label: "البنوك", items: clients.filter((client) => client.client_type === "bank") },
    { label: "الشركات", items: clients.filter((client) => client.client_type !== "bank") },
  ].filter((group) => group.items.length);
  const chosen = value.map((id) => ({ id, name: clients.find((client) => client.client_id === id)?.name ?? id }));

  return (
    <div className="client-filter">
      <div className="client-filter-bar">
        <button
          type="button"
          className={`btn small${value.length ? " btn-primary" : ""}`}
          aria-expanded={open}
          aria-controls="client-filter-panel"
          onClick={() => setOpen(!open)}
        >
          <Icon name="grid" size={15} />
          <span>البنوك والشركات</span>
          <b>{value.length ? number(value.length) : "الكل"}</b>
        </button>
        {chosen.map((client) => (
          <button type="button" key={client.id} className="client-chip" onClick={() => toggle(client.id)}>
            <span>{client.name}</span>
            <Icon name="close" size={12} />
          </button>
        ))}
        {value.length > 0 && (
          <button type="button" className="btn small ghost" onClick={() => onChange([])}>
            عرض الكل
          </button>
        )}
      </div>
      {open && (
        <div className="glass client-filter-panel" id="client-filter-panel">
          <p className="field-hint">
            اختر الجهات التي تراجعها. يُحفظ اختيارك لحسابك على هذا المتصفح، والرقم هو التقارير التي تنتظر المراجعة.
          </p>
          {groups.map((group) => (
            <fieldset key={group.label}>
              <legend>{group.label}</legend>
              <div className="client-options">
                {group.items.map((client) => (
                  <label key={client.client_id} className={value.includes(client.client_id) ? "chosen" : undefined}>
                    <input type="checkbox" checked={value.includes(client.client_id)} onChange={() => toggle(client.client_id)} />
                    <span>{client.name}</span>
                    {client.to_review > 0 && <b>{number(client.to_review)}</b>}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button type="button" className="btn small" onClick={() => setOpen(false)}>
            تم
          </button>
        </div>
      )}
    </div>
  );
}
