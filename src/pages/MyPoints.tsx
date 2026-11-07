import { useEffect, useState } from "react";
import { api } from "../api";
import { money, MonthPicker, monthLabel, thisMonth } from "../components/Finance";
import {
  AttendanceCalendar,
  clock,
  PointBadges,
  PointLegend,
  PointList,
  WEEKDAYS,
  type AttendanceDay,
  type Meanings,
  type PointRow,
  type Tally,
} from "../components/Points";
import { ErrorMessage, Icon, number } from "../components/ui";

interface Mine {
  tracked: boolean;
  month: string;
  schedule: { start: string; end: string; grace_minutes: number; off_days: number[] };
  rules: { blue_per_black: number; blue_bonus: number; black_deduction: number };
  meanings: Meanings;
  summary: Tally;
  today: { first_seen: string; last_seen: string; late_minutes: number; work_day: boolean } | null;
  days: AttendanceDay[];
  points: PointRow[];
}

/** An administrator's own attendance and points, as head office sees them. */
export function MyPointsPage() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<Mine | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<Mine>(`/points/me?month=${month}`)
      .then((result) => active && setData(result))
      .catch(() => active && setError("تعذّر تحميل نقاطك."));
    return () => {
      active = false;
    };
  }, [month]);

  const summary = data?.summary;
  return (
    <div className="page-enter points-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">حسابي / نقاطي</p>
          <h1>
            نقاطي. <span>{monthLabel(month)}.</span>
          </h1>
          <p className="page-description">حضورك ونقاطك كما تراها الإدارة العليا، وأثرها على راتبك هذا الشهر.</p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      <ErrorMessage message={error} />
      {data && !data.tracked && <p className="hint">حسابك لا يخضع لنظام الحضور والنقاط.</p>}
      {data?.tracked && (
        <>
          <div className="metrics-grid finance-metrics">
            <article className="glass metric my-points-metric">
              <div className="metric-top">
                <span>نقاط الشهر</span>
                <span className="metric-icon">
                  <Icon name="badge" />
                </span>
              </div>
              <PointBadges summary={summary} />
              <p>
                <span className="small-indicator" />
                {number(summary?.net_black ?? 0)} سوداء متبقية بعد المحو
              </p>
            </article>
            <article className="glass metric">
              <div className="metric-top">
                <span>اليوم</span>
                <span className="metric-icon">
                  <Icon name="clock" />
                </span>
              </div>
              <strong>{data.today ? clock(data.today.first_seen) : "—"}</strong>
              <p>
                <span className="small-indicator" />
                {data.today
                  ? data.today.late_minutes > 0
                    ? `تأخير ${number(data.today.late_minutes)} دقيقة`
                    : "حضور في الموعد"
                  : "لم يُسجَّل حضور اليوم"}
              </p>
            </article>
            <article className="glass metric">
              <div className="metric-top">
                <span>أثرها على الراتب</span>
                <span className="metric-icon">
                  <Icon name="key" />
                </span>
              </div>
              <strong className="money-value">{money((summary?.bonus ?? 0) - (summary?.deduction ?? 0))}</strong>
              <p>
                <span className="small-indicator" />+{money(summary?.bonus)} مكافأة · −{money(summary?.deduction)} خصم
              </p>
            </article>
            <article className="glass metric">
              <div className="metric-top">
                <span>الدوام</span>
                <span className="metric-icon">
                  <Icon name="activity" />
                </span>
              </div>
              <strong dir="ltr" className="metric-time">
                {data.schedule.start} – {data.schedule.end}
              </strong>
              <p>
                <span className="small-indicator" />
                الإجازة: {data.schedule.off_days.map((day) => WEEKDAYS[day]).join("، ") || "لا يوجد"}
              </p>
            </article>
          </div>
          <div className="finance-grid">
            <section className="glass panel">
              <div className="panel-heading">
                <h2>معنى كل نقطة</h2>
              </div>
              <PointLegend meanings={data.meanings} />
              <AttendanceCalendar month={data.month} days={data.days} points={data.points} offDays={data.schedule.off_days} />
            </section>
            <section className="glass panel">
              <div className="panel-heading">
                <h2>نقاطك هذا الشهر</h2>
              </div>
              <PointList points={data.points} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
