import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { money, MonthPicker, monthLabel, thisMonth } from "../components/Finance";
import { PointBadges } from "../components/Points";
import { Avatar, ErrorMessage, Icon, number } from "../components/ui";
import { hoursLabel, percent, type StaffMonth } from "./types";

const SORTS: { key: string; label: string; sort: (a: StaffMonth, b: StaffMonth) => number }[] = [
  { key: "score", label: "الأكفأ", sort: (a, b) => b.score - a.score },
  { key: "black", label: "الأكثر نقاطًا سوداء", sort: (a, b) => b.points.net_black - a.points.net_black || b.points.black - a.points.black },
  { key: "blue", label: "الأكثر نقاطًا زرقاء", sort: (a, b) => b.points.blue - a.points.blue },
  { key: "pay", label: "الأعلى راتبًا", sort: (a, b) => b.pay.total - a.pay.total },
];

export function StaffPage() {
  const [month, setMonth] = useState(thisMonth());
  const [group, setGroup] = useState<"investigator" | "admin">("investigator");
  const [sort, setSort] = useState(SORTS[0]!);
  const [search, setSearch] = useState("");
  const [staff, setStaff] = useState<StaffMonth[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<{ staff: StaffMonth[] }>(`/headoffice/staff?month=${month}`)
      .then((data) => active && setStaff(data.staff))
      .catch(() => active && setError("تعذّر تحميل الموظفين."));
    return () => {
      active = false;
    };
  }, [month]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (staff ?? [])
      .filter((person) => person.staff_group === group)
      .filter((person) => !term || `${person.full_name} ${person.employee_number ?? ""} ${person.email ?? ""}`.toLowerCase().includes(term))
      .sort(sort.sort);
  }, [staff, group, sort, search]);
  const count = (value: string) => (staff ?? []).filter((person) => person.staff_group === value).length;

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            الإدارة العليا <span>/</span> الموظفون
          </p>
          <h1>
            كل فرد في الفريق. <span>{monthLabel(month)}.</span>
          </h1>
          <p className="page-description">الحضور والنقاط والإنتاج والراتب لكل مدير ومستعلم. افتح أي شخص لترى ملفه كاملًا.</p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      <ErrorMessage message={error} />
      <div className="toolbar office-toolbar">
        <div className="segmented">
          <button className={group === "investigator" ? "active" : ""} onClick={() => setGroup("investigator")}>
            المستعلمون <small>{number(count("investigator"))}</small>
          </button>
          <button className={group === "admin" ? "active" : ""} onClick={() => setGroup("admin")}>
            المديرون <small>{number(count("admin"))}</small>
          </button>
        </div>
        <div className="segmented">
          {SORTS.map((item) => (
            <button key={item.key} className={sort.key === item.key ? "active" : ""} onClick={() => setSort(item)}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="search-input">
          <Icon name="search" size={16} />
          <input placeholder="ابحث بالاسم أو الرقم الوظيفي…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>
      <section className="glass panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>النقاط</th>
                <th>الحضور</th>
                {group === "investigator" ? (
                  <>
                    <th>معتمد</th>
                    <th>في الموعد</th>
                    <th>سلبي</th>
                  </>
                ) : (
                  <>
                    <th>استعلامات أرسلها</th>
                    <th>مراجعات</th>
                    <th>متوسط المراجعة</th>
                  </>
                )}
                <th>الكفاءة</th>
                <th>راتب الشهر</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((person, index) => (
                <tr key={person.user_id}>
                  <td className="mono">{number(index + 1)}</td>
                  <td>
                    <Link to={`/staff/${person.user_id}?month=${month}`} className="person-cell">
                      <Avatar name={person.full_name} small color={index} />
                      <div>
                        <strong>{person.full_name}</strong>
                        <small>{person.employee_number ?? person.email ?? "—"}</small>
                      </div>
                    </Link>
                  </td>
                  <td>
                    <PointBadges summary={person.points} compact />
                  </td>
                  <td>
                    <span className="attendance-cell">
                      {number(person.attendance.days)} يوم
                      <small>
                        {number(person.attendance.late_days)} تأخير · {number(person.attendance.absent)} غياب
                      </small>
                    </span>
                  </td>
                  {group === "investigator" ? (
                    <>
                      <td>{number(person.cases.approved)}</td>
                      <td>{percent(person.cases.on_time, person.cases.with_deadline)}</td>
                      <td>{number(person.cases.negative)}</td>
                    </>
                  ) : (
                    <>
                      <td>{number(person.cases.created)}</td>
                      <td>
                        {number(person.cases.reviewed)} <small className="hint">({number(person.cases.returned)} إعادة)</small>
                      </td>
                      <td>{hoursLabel(person.cases.avg_review_hours)}</td>
                    </>
                  )}
                  <td>
                    <strong>{number(person.score)}</strong>
                  </td>
                  <td>
                    {money(person.pay.paid?.amount ?? person.pay.total)}
                    {person.pay.paid && <small className="paid-tag">مدفوع</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {staff && !rows.length && <p className="hint empty">لا يوجد أحد هنا.</p>}
      </section>
    </div>
  );
}
