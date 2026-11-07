import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiRequestError } from "../api";
import { money, MonthPicker, monthLabel, thisMonth } from "../components/Finance";
import { PointBadges } from "../components/Points";
import { Avatar, ErrorMessage, Icon, number } from "../components/ui";
import { GROUP_LABEL, type MonthResult, type StaffMonth } from "./types";

function SalaryInput({ person, onSaved }: { person: StaffMonth; onSaved: () => void }) {
  const [value, setValue] = useState(String(person.pay.base));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => setValue(String(person.pay.base)), [person.pay.base]);
  const save = async () => {
    if (Number(value) === person.pay.base) return;
    setState("saving");
    try {
      await api(`/headoffice/salaries/${person.user_id}`, { method: "PATCH", body: JSON.stringify({ base_salary: Number(value) }) });
      setState("saved");
      onSaved();
    } catch {
      setState("error");
    }
  };
  return (
    <span className={`salary-input state-${state}`}>
      <input
        type="number"
        min={0}
        step={50}
        aria-label={`الراتب الأساسي — ${person.full_name}`}
        value={value}
        disabled={Boolean(person.pay.paid)}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
      />
      {state === "saved" && <Icon name="check" size={14} />}
    </span>
  );
}

export function PayrollPage() {
  const [month, setMonth] = useState(thisMonth());
  const [people, setPeople] = useState<StaffMonth[]>([]);
  const [result, setResult] = useState<MonthResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ people: StaffMonth[]; result: MonthResult }>(`/headoffice/payroll?month=${month}`)
      .then((data) => {
        setPeople(data.people);
        setResult(data.result);
      })
      .catch(() => setError("تعذّر تحميل الرواتب."));
  }, [month]);
  useEffect(load, [load]);

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر تنفيذ العملية.");
    } finally {
      setBusy(false);
    }
  };
  const unpaid = people.filter((person) => !person.pay.paid);
  const unpaidTotal = unpaid.reduce((sum, person) => sum + person.pay.total, 0);
  const future = month > thisMonth();

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            الإدارة العليا <span>/</span> الرواتب
          </p>
          <h1>
            رواتب {monthLabel(month)}. <span>بكل تفاصيلها.</span>
          </h1>
          <p className="page-description">
            الراتب = الأساسي + أجور الاستعلامات المعتمدة + مكافأة النقاط الزرقاء − خصم النقاط السوداء + التسويات. عدّل الراتب
            الأساسي مباشرة من الجدول.
          </p>
        </div>
        <div className="heading-actions">
          <MonthPicker value={month} onChange={setMonth} />
          <button
            className="btn btn-primary"
            disabled={busy || !unpaid.length || future}
            onClick={() => {
              if (window.confirm(`صرف رواتب ${number(unpaid.length)} موظف بإجمالي ${money(unpaidTotal)}؟`)) {
                void act(() => api("/headoffice/payroll/pay", { method: "POST", body: JSON.stringify({ month }) }));
              }
            }}
          >
            <Icon name="check" size={16} />
            صرف رواتب الشهر
          </button>
        </div>
      </div>
      <ErrorMessage message={error} />
      <div className="metrics-grid finance-metrics">
        {[
          { label: "إجمالي الرواتب", value: result?.payroll, hint: `${number(people.length)} موظف` },
          { label: "الأساسي", value: result?.salaries, hint: "الرواتب الثابتة" },
          { label: "أجور الاستعلامات", value: result?.case_pay, hint: "للمستعلمين" },
          { label: "مكافآت − خصومات", value: (result?.bonuses ?? 0) - (result?.deductions ?? 0), hint: `${money(result?.bonuses)} مكافآت · ${money(result?.deductions)} خصومات` },
        ].map((card) => (
          <article className="glass metric" key={card.label}>
            <div className="metric-top">
              <span>{card.label}</span>
            </div>
            <strong className="money-value">{result ? money(card.value) : "—"}</strong>
            <p>
              <span className="small-indicator" />
              {card.hint}
            </p>
          </article>
        ))}
      </div>
      <section className="glass panel">
        <div className="table-wrap">
          <table className="table payroll-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>النقاط</th>
                <th>الأساسي</th>
                <th>أجور الاستعلامات</th>
                <th>مكافأة</th>
                <th>خصم</th>
                <th>تسويات</th>
                <th>الإجمالي</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {people.map((person, index) => (
                <tr key={person.user_id} className={person.pay.paid ? "paid-row" : ""}>
                  <td>
                    <Link to={`/staff/${person.user_id}?month=${month}`} className="person-cell">
                      <Avatar name={person.full_name} small color={index} />
                      <div>
                        <strong>{person.full_name}</strong>
                        <small>{GROUP_LABEL[person.staff_group]}</small>
                      </div>
                    </Link>
                  </td>
                  <td>
                    <PointBadges summary={person.points} compact />
                  </td>
                  <td>
                    <SalaryInput person={person} onSaved={load} />
                  </td>
                  <td>{person.staff_group === "investigator" ? money(person.pay.case_pay) : "—"}</td>
                  <td className="trend-up">{person.pay.bonus ? `+ ${money(person.pay.bonus)}` : "—"}</td>
                  <td className="trend-down">{person.pay.deduction ? `− ${money(person.pay.deduction)}` : "—"}</td>
                  <td>{person.pay.adjustments ? money(person.pay.adjustments) : "—"}</td>
                  <td>
                    <strong>{money(person.pay.paid?.amount ?? person.pay.total)}</strong>
                  </td>
                  <td>
                    {person.pay.paid ? (
                      <button
                        className="btn small ghost"
                        disabled={busy}
                        title="التراجع عن الصرف"
                        onClick={() => void act(() => api(`/headoffice/payroll/pay/${person.user_id}?month=${month}`, { method: "DELETE" }))}
                      >
                        <Icon name="check" size={14} /> مدفوع
                      </button>
                    ) : (
                      <button
                        className="btn small"
                        disabled={busy || future}
                        onClick={() =>
                          void act(() => api("/headoffice/payroll/pay", { method: "POST", body: JSON.stringify({ month, user_ids: [person.user_id] }) }))
                        }
                      >
                        صرف
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!people.length && <p className="hint empty">لا يوجد موظفون بعد.</p>}
      </section>
    </div>
  );
}
