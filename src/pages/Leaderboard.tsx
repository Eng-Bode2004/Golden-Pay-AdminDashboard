import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { money, MonthPicker, monthLabel, thisMonth } from "../components/Finance";
import { minutesLabel } from "../components/Timing";
import { Avatar, ErrorMessage, Icon, number } from "../components/ui";

interface Row {
  user_id: string;
  full_name: string;
  employee_number: string | null;
  governorate: string | null;
  district: string | null;
  approved_month: number;
  approved_prev: number;
  growth: number;
  earned_month: number;
  active: number;
  offers_month: number;
  accept_rate: number | null;
  avg_response_minutes: number | null;
  avg_seen_to_submit_hours: number | null;
  on_time_rate: number | null;
  returns: number;
  score: number;
}

const percent = (value: number | null) => (value === null ? "—" : `${number(Math.round(value * 100))}٪`);

const BOARDS: { key: string; label: string; hint: string; sort: (a: Row, b: Row) => number; value: (row: Row) => string }[] = [
  {
    key: "active",
    label: "الأكثر نشاطاً",
    hint: "تقارير معتمدة وقبول للعروض والتزام بالمواعيد",
    sort: (a, b) => b.score - a.score,
    value: (row) => `${number(row.score)} نقطة`,
  },
  {
    key: "growth",
    label: "الأكثر تقدماً",
    hint: "الفرق في التقارير المعتمدة عن الشهر السابق",
    sort: (a, b) => b.growth - a.growth || b.approved_month - a.approved_month,
    value: (row) => `${row.growth > 0 ? "+" : ""}${number(row.growth)} تقرير`,
  },
  {
    key: "fast",
    label: "الأسرع استجابة",
    hint: "متوسط الوقت من وصول العرض حتى الرد عليه",
    sort: (a, b) => (a.avg_response_minutes ?? 1e9) - (b.avg_response_minutes ?? 1e9),
    value: (row) => minutesLabel(row.avg_response_minutes),
  },
  {
    key: "earned",
    label: "الأعلى أرباحاً",
    hint: "أرباح التقارير المعتمدة هذا الشهر",
    sort: (a, b) => b.earned_month - a.earned_month,
    value: (row) => money(row.earned_month),
  },
];

export function LeaderboardPage() {
  const [month, setMonth] = useState(thisMonth());
  const [rows, setRows] = useState<Row[]>([]);
  const [board, setBoard] = useState(BOARDS[0]!);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ investigators: Row[] }>(`/investigations/leaderboard?month=${month}`)
      .then((data) => setRows(data.investigators))
      .catch(() => setError("تعذّر تحميل الأداء."));
  }, [month]);

  const ranked = useMemo(() => [...rows].sort(board.sort), [rows, board]);
  const podium = ranked.slice(0, 3);

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            المستعلمون <span>/</span> الأداء
          </p>
          <h1>
            من يصنع الفارق. <span>{monthLabel(month)}.</span>
          </h1>
          <p className="page-description">ترتيب المستعلمين حسب النشاط والتقدم وسرعة الاستجابة والأرباح.</p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      <ErrorMessage message={error} />
      <div className="segmented board-tabs">
        {BOARDS.map((item) => (
          <button key={item.key} className={board.key === item.key ? "active" : ""} onClick={() => setBoard(item)}>
            {item.label}
          </button>
        ))}
      </div>
      <p className="hint board-hint">{board.hint}</p>
      {podium.length > 0 && (
        <div className="podium">
          {podium.map((row, index) => (
            <Link to={`/people/${row.user_id}`} className={`glass podium-card place-${index + 1}`} key={row.user_id}>
              <span className="podium-rank">{number(index + 1)}</span>
              <Avatar name={row.full_name} color={index} />
              <strong>{row.full_name}</strong>
              <small>{[row.governorate, row.district].filter(Boolean).join(" - ")}</small>
              <b>{board.value(row)}</b>
            </Link>
          ))}
        </div>
      )}
      <section className="glass panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>المستعلم</th>
                <th>{board.label}</th>
                <th>معتمد هذا الشهر</th>
                <th>التقدم</th>
                <th>قبول العروض</th>
                <th>زمن الرد</th>
                <th>من المشاهدة للإنجاز</th>
                <th>الالتزام بالموعد</th>
                <th>الأرباح</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row, index) => (
                <tr key={row.user_id}>
                  <td className="mono">{number(index + 1)}</td>
                  <td>
                    <Link to={`/people/${row.user_id}`} className="person-cell">
                      <Avatar name={row.full_name} small color={index} />
                      <div>
                        <strong>{row.full_name}</strong>
                        <small>{row.employee_number ?? "—"}</small>
                      </div>
                    </Link>
                  </td>
                  <td>
                    <strong>{board.value(row)}</strong>
                  </td>
                  <td>{number(row.approved_month)}</td>
                  <td className={row.growth > 0 ? "trend-up" : row.growth < 0 ? "trend-down" : ""}>
                    <Icon name="activity" size={14} /> {row.growth > 0 ? "+" : ""}
                    {number(row.growth)}
                  </td>
                  <td>
                    {percent(row.accept_rate)} <small className="hint">({number(row.offers_month)})</small>
                  </td>
                  <td>{minutesLabel(row.avg_response_minutes)}</td>
                  <td>{minutesLabel(row.avg_seen_to_submit_hours === null ? null : row.avg_seen_to_submit_hours * 60)}</td>
                  <td>{percent(row.on_time_rate)}</td>
                  <td>{money(row.earned_month)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ranked.length && <p className="hint empty">لا يوجد مستعلمون حددوا منطقة عملهم بعد.</p>}
      </section>
    </div>
  );
}
