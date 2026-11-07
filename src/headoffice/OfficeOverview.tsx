import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { money, MonthPicker, monthLabel, thisMonth, TrendBars } from "../components/Finance";
import { PointBadges, type Tally } from "../components/Points";
import { Avatar, ErrorMessage, Icon, number, type IconName } from "../components/ui";
import { outputLine, type MonthResult, type StaffMonth } from "./types";

interface Overview {
  month: string;
  result: MonthResult;
  trend: MonthResult[];
  staff: { admins: number; investigators: number };
  attendance_today: { present: number; late: number; absent: number; off: number; waiting: number };
  points: Pick<Tally, "green" | "black" | "blue" | "cleared">;
  cases: { created: number; waiting: number; working: number; review: number };
  complaints: { open: number; total: number };
  top_investigators: StaffMonth[];
  top_admins: StaffMonth[];
}

function Leaders({ title, people, empty }: { title: string; people: StaffMonth[]; empty: string }) {
  return (
    <section className="glass panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <Link className="btn small ghost" to="/staff">
          الكل <Icon name="arrow" size={15} />
        </Link>
      </div>
      <ol className="leader-list">
        {people.map((person, index) => (
          <li key={person.user_id}>
            <Link to={`/staff/${person.user_id}`} className="person-cell">
              <span className="leader-rank">{number(index + 1)}</span>
              <Avatar name={person.full_name} small color={index} />
              <div>
                <strong>{person.full_name}</strong>
                <small>{outputLine(person)}</small>
              </div>
            </Link>
            <PointBadges summary={person.points} compact />
            <b className="leader-score">{number(person.score)}</b>
          </li>
        ))}
      </ol>
      {!people.length && <p className="hint empty">{empty}</p>}
    </section>
  );
}

export function OfficeOverviewPage() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    api<Overview>(`/headoffice/overview?month=${month}`)
      .then((result) => active && setData(result))
      .catch(() => active && setError("تعذّر تحميل نظرة الأعمال."));
    return () => {
      active = false;
    };
  }, [month]);

  const result = data?.result;
  const margin = result?.revenue ? Math.round((result.net / result.revenue) * 100) : null;
  const cards: { label: string; value: number | undefined; hint: string; icon: IconName; tone?: string }[] = [
    { label: "الإيرادات", value: result?.revenue, hint: `${number(result?.approved_cases ?? 0)} استعلام معتمد`, icon: "activity" },
    { label: "الرواتب والمستحقات", value: result?.payroll, hint: `${number((data?.staff.admins ?? 0) + (data?.staff.investigators ?? 0))} موظف`, icon: "users" },
    { label: "المصروفات", value: result?.expenses, hint: "إيجار وتشغيل وغيرها", icon: "file" },
    {
      label: "صافي الربح",
      value: result?.net,
      hint: margin === null ? "لا إيرادات بعد" : `هامش ${number(margin)}٪`,
      icon: "shield",
      tone: (result?.net ?? 0) < 0 ? "loss" : "gain",
    },
  ];
  const lines: { label: string; value: number; sign: 1 | -1 }[] = result
    ? [
        { label: "إيرادات الاستعلامات المعتمدة", value: result.revenue, sign: 1 },
        { label: "الرواتب الأساسية", value: result.salaries, sign: -1 },
        { label: "أجور الاستعلامات للمستعلمين", value: result.case_pay, sign: -1 },
        { label: "مكافآت النقاط الزرقاء", value: result.bonuses, sign: -1 },
        { label: "خصومات النقاط السوداء", value: result.deductions, sign: 1 },
        { label: "تسويات الرواتب", value: result.adjustments, sign: -1 },
        { label: "المصروفات", value: result.expenses, sign: -1 },
      ]
    : [];
  const today = data?.attendance_today;

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">الإدارة العليا</p>
          <h1>
            الشركة كلها. <span>{monthLabel(month)}.</span>
          </h1>
          <p className="page-description">الإيرادات والرواتب والمصروفات وصافي الربح، والحضور وأداء كل مدير ومستعلم.</p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      <ErrorMessage message={error} />

      <div className="metrics-grid finance-metrics">
        {cards.map((card) => (
          <article className={`glass metric ${card.tone ?? ""}`} key={card.label}>
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
            rows={(data?.trend ?? []).map((row) => ({ ...row, net: Math.max(0, row.net) }))}
            series={[
              { key: "revenue", label: "الإيرادات", tone: "accent" },
              { key: "payroll", label: "الرواتب", tone: "deep" },
              { key: "net", label: "صافي الربح", tone: "ok" },
            ]}
          />
        </section>
        <section className="glass panel">
          <div className="panel-heading">
            <h2>من الإيراد إلى صافي الربح</h2>
          </div>
          <ul className="profit-lines">
            {lines.map((line) => {
              const effect = line.sign * line.value;
              return (
                <li key={line.label} className={effect < 0 ? "minus" : "plus"}>
                  <span>{line.label}</span>
                  <b>
                    {effect ? (effect < 0 ? "− " : "+ ") : ""}
                    {money(Math.abs(effect))}
                  </b>
                </li>
              );
            })}
            {result && (
              <li className={`total ${result.net < 0 ? "loss" : "gain"}`}>
                <span>صافي الربح</span>
                <b>{money(result.net)}</b>
              </li>
            )}
          </ul>
        </section>
      </div>

      <div className="office-grid">
        <Link to="/attendance" className="glass panel office-tile">
          <div className="panel-heading">
            <h2>حضور اليوم</h2>
            <Icon name="clock" size={18} />
          </div>
          <div className="tile-stats">
            <span className="stat-present">
              <b>{number(today?.present ?? 0)}</b>حاضر
            </span>
            <span className="stat-late">
              <b>{number(today?.late ?? 0)}</b>متأخر
            </span>
            <span className="stat-absent">
              <b>{number(today?.absent ?? 0)}</b>غائب
            </span>
            <span>
              <b>{number((today?.off ?? 0) + (today?.waiting ?? 0))}</b>إجازة أو لم يبدأ
            </span>
          </div>
        </Link>
        <Link to="/staff" className="glass panel office-tile">
          <div className="panel-heading">
            <h2>نقاط الشهر</h2>
            <Icon name="badge" size={18} />
          </div>
          <PointBadges summary={data ? { ...data.points, net_black: 0, bonus: 0, deduction: 0 } : null} />
          <p className="hint">
            {number(data?.staff.admins ?? 0)} مدير · {number(data?.staff.investigators ?? 0)} مستعلم
          </p>
        </Link>
        <section className="glass panel office-tile">
          <div className="panel-heading">
            <h2>الاستعلامات</h2>
            <Icon name="file" size={18} />
          </div>
          <div className="tile-stats">
            <span>
              <b>{number(data?.cases.created ?? 0)}</b>أُرسل هذا الشهر
            </span>
            <span>
              <b>{number(data?.cases.working ?? 0)}</b>قيد التنفيذ
            </span>
            <span>
              <b>{number(data?.cases.review ?? 0)}</b>بانتظار المراجعة
            </span>
            <span>
              <b>{number(data?.cases.waiting ?? 0)}</b>بانتظار مستعلم
            </span>
          </div>
        </section>
        <Link to="/complaints" className="glass panel office-tile">
          <div className="panel-heading">
            <h2>الشكاوى</h2>
            <Icon name="inbox" size={18} />
          </div>
          <div className="tile-stats">
            <span className={data?.complaints.open ? "stat-late" : ""}>
              <b>{number(data?.complaints.open ?? 0)}</b>مفتوحة
            </span>
            <span>
              <b>{number(data?.complaints.total ?? 0)}</b>الإجمالي
            </span>
          </div>
        </Link>
      </div>

      <div className="finance-grid leaders-grid">
        <Leaders title="أكفأ المستعلمين" people={data?.top_investigators ?? []} empty="لا يوجد مستعلمون بعد." />
        <Leaders title="أكفأ المديرين" people={data?.top_admins ?? []} empty="لا يوجد مديرون بعد." />
      </div>
      <p className="hint score-hint">
        مؤشر الكفاءة: للمستعلم ١٠ لكل تقرير معتمد و٢ لكل تقرير في موعده، وللمدير ٢ لكل استعلام أرسله و٣ لكل مراجعة؛ ثم +١ لكل
        نقطة خضراء و+٣ لكل زرقاء و−٥ لكل سوداء متبقية.
      </p>
    </div>
  );
}
