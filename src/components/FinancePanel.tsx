import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { money, MonthPicker, monthLabel, thisMonth, TrendBars } from "./Finance";
import { Icon, number } from "./ui";

interface Finance {
  month: string;
  revenue: number;
  payouts: number;
  profit: number;
  approved: number;
  pipeline: { revenue: number; payouts: number; cases: number };
  by_client: { name: string; approved: number; revenue: number; profit: number }[];
  by_level: { name: string; approved: number; revenue: number }[];
  trend: { month: string; revenue: number; payouts: number; approved: number }[];
}

/** Company earnings for one month. Hidden for staff without finance access. */
export function FinancePanel() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<Finance | null>(null);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    let active = true;
    api<Finance>(`/investigations/finance?month=${month}`)
      .then((result) => active && setData(result))
      .catch(() => active && setAllowed(false));
    return () => {
      active = false;
    };
  }, [month]);

  if (!allowed) return null;
  const margin = data?.revenue ? Math.round((data.profit / data.revenue) * 100) : 0;

  return (
    <section className="finance-panel">
      <div className="finance-head">
        <div>
          <span className="eyebrow">أرباح الشركة</span>
          <h2>{monthLabel(month)}</h2>
        </div>
        <div className="heading-actions">
          <MonthPicker value={month} onChange={setMonth} />
          <Link className="btn small ghost" to="/pricing">
            <Icon name="key" size={15} />
            الأسعار
          </Link>
        </div>
      </div>
      <div className="metrics-grid finance-metrics">
        {[
          { label: "الإيرادات", value: data?.revenue, hint: `${number(data?.approved ?? 0)} استعلام معتمد`, icon: "activity" as const },
          { label: "مستحقات المستعلمين", value: data?.payouts, hint: "أجور الاستعلامات المعتمدة", icon: "users" as const },
          { label: "صافي الربح", value: data?.profit, hint: `هامش ${number(margin)}٪`, icon: "shield" as const },
          { label: "قيد التنفيذ", value: data?.pipeline.revenue, hint: `${number(data?.pipeline.cases ?? 0)} استعلام لم يُعتمد بعد`, icon: "clock" as const },
        ].map((card) => (
          <article className="glass metric" key={card.label}>
            <div className="metric-top">
              <span>{card.label}</span>
              <span className="metric-icon">
                <Icon name={card.icon} />
              </span>
            </div>
            <strong className="money-value">{data ? money(card.value) : "—"}</strong>
            <p>
              <span className="small-indicator" />
              {card.hint}
            </p>
          </article>
        ))}
      </div>
      <div className="finance-grid">
        <section className="glass panel finance-trend">
          <div className="panel-heading">
            <h2>آخر ستة أشهر</h2>
          </div>
          <TrendBars
            rows={data?.trend ?? []}
            series={[
              { key: "revenue", label: "الإيرادات", tone: "accent" },
              { key: "payouts", label: "مستحقات المستعلمين", tone: "deep" },
            ]}
          />
        </section>
        <section className="glass panel">
          <div className="panel-heading">
            <h2>حسب الجهة</h2>
          </div>
          <div className="rank-list">
            {data?.by_client.map((row) => (
              <div key={row.name}>
                <span>
                  <strong>{row.name}</strong>
                  <small>{number(row.approved)} استعلام · ربح {money(row.profit)}</small>
                </span>
                <b>{money(row.revenue)}</b>
                <i style={{ width: `${(row.revenue / Math.max(1, data.revenue)) * 100}%` }} />
              </div>
            ))}
            {!data?.by_client.length && <p className="hint">لا توجد استعلامات معتمدة في هذا الشهر.</p>}
          </div>
        </section>
      </div>
    </section>
  );
}
