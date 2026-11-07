import { useCallback, useEffect, useState } from "react";
import { api, ApiRequestError } from "../api";
import { money, MonthPicker, monthLabel, thisMonth } from "../components/Finance";
import { ErrorMessage, Icon, number } from "../components/ui";

interface Expense {
  expense_id: string;
  title: string;
  category: string;
  amount: number;
  month: string;
  recurring: boolean;
  end_month: string | null;
  note: string | null;
}

export function ExpensesPage() {
  const [month, setMonth] = useState(thisMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [draft, setDraft] = useState({ title: "", category: "", amount: "", recurring: false, note: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ expenses: Expense[]; categories: string[] }>(`/headoffice/expenses?month=${month}`)
      .then((data) => {
        setExpenses(data.expenses);
        setCategories(data.categories);
      })
      .catch(() => setError("تعذّر تحميل المصروفات."));
  }, [month]);
  useEffect(load, [load]);

  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const byCategory = Object.entries(
    expenses.reduce<Record<string, number>>((sums, item) => ({ ...sums, [item.category]: (sums[item.category] ?? 0) + item.amount }), {}),
  ).sort((a, b) => b[1] - a[1]);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/headoffice/expenses", {
        method: "POST",
        body: JSON.stringify({ ...draft, amount: Number(draft.amount), month }),
      });
      setDraft({ title: "", category: draft.category, amount: "", recurring: false, note: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر حفظ المصروف.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (item: Expense) => {
    const question = item.recurring
      ? `إيقاف "${item.title}" من ${monthLabel(month)}؟ تبقى الأشهر السابقة كما هي.`
      : `حذف "${item.title}"؟`;
    if (!window.confirm(question)) return;
    await api(`/headoffice/expenses/${item.expense_id}?month=${month}`, { method: "DELETE" }).catch(() =>
      setError("تعذّر حذف المصروف."),
    );
    load();
  };

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            الإدارة العليا <span>/</span> المصروفات
          </p>
          <h1>
            مصروفات {monthLabel(month)}. <span>{money(total)}</span>
          </h1>
          <p className="page-description">
            كل ما تنفقه الشركة غير الرواتب. المصروف الشهري الثابت يُحسب تلقائيًا كل شهر حتى تُوقفه، ويُخصم من صافي الربح.
          </p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      <ErrorMessage message={error} />
      <div className="finance-grid">
        <section className="glass panel">
          <div className="panel-heading">
            <h2>إضافة مصروف</h2>
          </div>
          <form className="expense-form" onSubmit={(event) => void add(event)}>
            <label className="field">
              <span>البيان</span>
              <input required placeholder="مثال: إيجار مقر الدقي" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            <div className="form-row">
              <label className="field">
                <span>التصنيف</span>
                <select required value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                  <option value="">اختر…</option>
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>المبلغ (ج.م)</span>
                <input required type="number" min={1} value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} />
              </label>
            </div>
            <label className="field">
              <span>ملاحظة (اختياري)</span>
              <input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
            </label>
            <label className="price-toggle">
              <input type="checkbox" checked={draft.recurring} onChange={(event) => setDraft({ ...draft, recurring: event.target.checked })} />
              مصروف شهري ثابت (يتكرر كل شهر)
            </label>
            <button className="btn btn-primary" disabled={busy}>
              <Icon name="plus" size={16} />
              إضافة إلى {monthLabel(month)}
            </button>
          </form>
        </section>
        <section className="glass panel">
          <div className="panel-heading">
            <h2>حسب التصنيف</h2>
          </div>
          <div className="rank-list">
            {byCategory.map(([category, amount]) => (
              <div key={category}>
                <span>
                  <strong>{category}</strong>
                  <small>{number(Math.round((amount / Math.max(1, total)) * 100))}٪ من المصروفات</small>
                </span>
                <b>{money(amount)}</b>
                <i style={{ width: `${(amount / Math.max(1, total)) * 100}%` }} />
              </div>
            ))}
            {!byCategory.length && <p className="hint">لا توجد مصروفات في هذا الشهر.</p>}
          </div>
        </section>
      </div>
      <section className="glass panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>البيان</th>
                <th>التصنيف</th>
                <th>النوع</th>
                <th>المبلغ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {expenses.map((item) => (
                <tr key={item.expense_id}>
                  <td>
                    <strong>{item.title}</strong>
                    {item.note && <small className="hint block">{item.note}</small>}
                  </td>
                  <td>{item.category}</td>
                  <td>{item.recurring ? <span className="badge">شهري منذ {monthLabel(item.month, "short")}</span> : "مرة واحدة"}</td>
                  <td>
                    <strong>{money(item.amount)}</strong>
                  </td>
                  <td>
                    <button className="btn small ghost" onClick={() => void remove(item)}>
                      {item.recurring ? "إيقاف" : "حذف"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!expenses.length && <p className="hint empty">لا توجد مصروفات مسجلة لهذا الشهر.</p>}
      </section>
    </div>
  );
}
