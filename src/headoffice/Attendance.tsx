import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { clock, reasonLabel, WEEKDAYS } from "../components/Points";
import { Avatar, ErrorMessage, number } from "../components/ui";
import { GROUP_LABEL, type Schedule } from "./types";

interface Person {
  user_id: string;
  full_name: string;
  employee_number: string | null;
  staff_group: "admin" | "investigator";
  first_seen: string | null;
  last_seen: string | null;
  late_minutes: number | null;
  platform: string | null;
  status: string;
  points: { point_id: string; color: "green" | "black" | "blue"; reason: string; minutes: number | null; revoked: boolean }[] | null;
}

const STATUS: Record<string, { label: string; tone: string }> = {
  present: { label: "حاضر في الموعد", tone: "present" },
  late: { label: "متأخر", tone: "late" },
  absent: { label: "غائب", tone: "absent" },
  off: { label: "إجازة", tone: "off" },
  off_day_work: { label: "يعمل في إجازته", tone: "extra" },
  waiting: { label: "لم يبدأ الدوام بعد", tone: "off" },
};
const PLATFORM: Record<string, string> = { android: "التطبيق", ios: "التطبيق", web: "لوحة التحكم" };
const cairoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());

function ScheduleLine({ label, schedule }: { label: string; schedule: Schedule | undefined }) {
  if (!schedule) return null;
  return (
    <span>
      <b>{label}</b> {schedule.start} – {schedule.end} · سماح {number(schedule.grace_minutes)} د · إجازة{" "}
      {schedule.off_days.map((day) => WEEKDAYS[day]).join("، ") || "لا يوجد"}
    </span>
  );
}

export function AttendancePage() {
  const [day, setDay] = useState(cairoToday());
  const [people, setPeople] = useState<Person[]>([]);
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<{ people: Person[]; schedules: Record<string, Schedule> }>(`/headoffice/attendance?date=${day}`)
      .then((data) => {
        if (!active) return;
        setPeople(data.people);
        setSchedules(data.schedules);
      })
      .catch(() => active && setError("تعذّر تحميل الحضور."));
    return () => {
      active = false;
    };
  }, [day]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const person of people) result[person.status] = (result[person.status] ?? 0) + 1;
    return result;
  }, [people]);
  const shown = people.filter((person) => filter === "all" || person.status === filter);

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            الإدارة العليا <span>/</span> الحضور والغياب
          </p>
          <h1>
            من حضر، ومتى. <span>يومًا بيوم.</span>
          </h1>
          <p className="page-description">
            يُسجَّل الحضور من أول فتح للتطبيق أو اللوحة في اليوم، والانصراف من آخر نشاط. التأخير والغياب يعطيان نقطة سوداء تلقائيًا.
          </p>
        </div>
        <input className="month-picker" type="date" aria-label="اليوم" value={day} max={cairoToday()} onChange={(event) => event.target.value && setDay(event.target.value)} />
      </div>
      <ErrorMessage message={error} />
      <p className="schedule-lines hint">
        <ScheduleLine label="المديرون:" schedule={schedules.admin} />
        <ScheduleLine label="المستعلمون:" schedule={schedules.investigator} />
        <Link to="/rules">تعديل مواعيد الدوام</Link>
      </p>
      <div className="segmented status-tabs">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
          الكل <small>{number(people.length)}</small>
        </button>
        {Object.entries(STATUS).map(([key, value]) =>
          counts[key] ? (
            <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>
              {value.label} <small>{number(counts[key]!)}</small>
            </button>
          ) : null,
        )}
      </div>
      <section className="glass panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الحالة</th>
                <th>الحضور</th>
                <th>آخر نشاط</th>
                <th>من</th>
                <th>نقاط اليوم</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((person, index) => (
                <tr key={person.user_id}>
                  <td>
                    <Link to={`/staff/${person.user_id}?month=${day.slice(0, 7)}`} className="person-cell">
                      <Avatar name={person.full_name} small color={index} />
                      <div>
                        <strong>{person.full_name}</strong>
                        <small>
                          {GROUP_LABEL[person.staff_group]} · {person.employee_number ?? "—"}
                        </small>
                      </div>
                    </Link>
                  </td>
                  <td>
                    <span className={`attendance-status tone-${STATUS[person.status]?.tone}`}>
                      <i />
                      {STATUS[person.status]?.label ?? person.status}
                    </span>
                    {!!person.late_minutes && <small className="late-text"> {number(person.late_minutes)} د</small>}
                  </td>
                  <td>{clock(person.first_seen)}</td>
                  <td>{clock(person.last_seen)}</td>
                  <td>{person.platform ? PLATFORM[person.platform] ?? person.platform : "—"}</td>
                  <td>
                    <span className="point-dots">
                      {(person.points ?? [])
                        .filter((point) => !point.revoked)
                        .map((point) => (
                          <i
                            key={point.point_id}
                            className={`dot point-${point.color}`}
                            title={reasonLabel({ ...point, note: null })}
                          />
                        ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!shown.length && <p className="hint empty">لا يوجد أحد في هذه الحالة.</p>}
      </section>
    </div>
  );
}
