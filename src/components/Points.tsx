import { number } from "./ui";

export interface Tally {
  green: number;
  black: number;
  blue: number;
  cleared: number;
  net_black: number;
  bonus_blue?: number;
  bonus: number;
  deduction: number;
}

export interface PointRow {
  point_id: string;
  color: "green" | "black" | "blue";
  reason: string;
  minutes: number | null;
  note: string | null;
  day: string;
  created_at: string;
  revoked_at: string | null;
  revoke_note: string | null;
  awarded_by_name?: string | null;
}

export interface Meanings {
  green: string;
  black: string;
  blue: string;
  clearing: string;
}

export const COLOR_LABEL: Record<string, string> = {
  green: "نقطة خضراء",
  black: "نقطة سوداء",
  blue: "نقطة زرقاء",
};

export const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const SHORT_DAYS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

/** Why a point was given, in words. */
export function reasonLabel(point: Pick<PointRow, "reason" | "minutes" | "note" | "color">): string {
  switch (point.reason) {
    case "on_time":
      return "حضور وانصراف في الموعد";
    case "late":
      return point.minutes ? `تأخير ${number(point.minutes)} دقيقة عن بدء العمل` : "تأخير عن بدء العمل";
    case "absent":
      return "غياب في يوم عمل";
    case "overtime":
      return point.minutes ? `عمل ${number(point.minutes)} دقيقة بعد نهاية الدوام` : "عمل ساعات إضافية";
    case "off_day":
      return "عمل في يوم إجازة";
    default:
      return point.note ?? (point.color === "blue" ? "تقدير من الإدارة العليا" : "مخالفة سجّلتها الإدارة العليا");
  }
}

/** Green, black and blue counts as glowing dots. */
export function PointBadges({ summary, compact = false }: { summary: Tally | null | undefined; compact?: boolean }) {
  const items = [
    { color: "green", value: summary?.green ?? 0, label: "خضراء" },
    { color: "black", value: summary?.black ?? 0, label: "سوداء" },
    { color: "blue", value: summary?.blue ?? 0, label: "زرقاء" },
  ];
  return (
    <span className={`point-badges${compact ? " compact" : ""}`}>
      {items.map((item) => (
        <span key={item.color} className={`point-badge point-${item.color}`} title={`${number(item.value)} نقطة ${item.label}`}>
          <i />
          {number(item.value)}
          {!compact && <small>{item.label}</small>}
        </span>
      ))}
      {!!summary?.cleared && (
        <span className="point-cleared" title="نقاط سوداء محتها النقاط الزرقاء">
          −{number(summary.cleared)} محيت
        </span>
      )}
    </span>
  );
}

export function PointLegend({ meanings }: { meanings: Meanings | null | undefined }) {
  if (!meanings) return null;
  return (
    <div className="point-legend">
      {(["green", "black", "blue"] as const).map((color) => (
        <div key={color} className={`point-meaning point-${color}`}>
          <i />
          <div>
            <strong>{COLOR_LABEL[color]}</strong>
            <p>{meanings[color]}</p>
          </div>
        </div>
      ))}
      <p className="point-clearing">{meanings.clearing}</p>
    </div>
  );
}

export function PointList({ points, onRevoke }: { points: PointRow[]; onRevoke?: (point: PointRow) => void }) {
  if (!points.length) return <p className="hint empty">لا توجد نقاط في هذا الشهر.</p>;
  return (
    <ol className="point-list">
      {points.map((point) => (
        <li key={point.point_id} className={`point-${point.color}${point.revoked_at ? " revoked" : ""}`}>
          <i />
          <div>
            <strong>{reasonLabel(point)}</strong>
            <small>
              {new Intl.DateTimeFormat(document.documentElement.lang === "en" ? "en-GB" : "ar-EG-u-nu-latn", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date(`${point.day}T12:00:00`))}
              {point.awarded_by_name ? ` · ${point.awarded_by_name}` : ""}
            </small>
            {point.revoked_at && <small className="revoked-note">أُلغيت: {point.revoke_note}</small>}
          </div>
          {onRevoke && !point.revoked_at && (
            <button className="btn small ghost" onClick={() => onRevoke(point)}>
              إلغاء
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

const time = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat(document.documentElement.lang === "en" ? "en-GB" : "ar-EG-u-nu-latn", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Africa/Cairo",
      }).format(new Date(value))
    : "—";
export const clock = time;

export interface AttendanceDay {
  day: string;
  first_seen: string;
  last_seen: string;
  late_minutes: number;
  work_day: boolean;
}

/** One month as a calendar: each day coloured by attendance and points. */
export function AttendanceCalendar({
  month,
  days,
  points,
  offDays,
}: {
  month: string;
  days: AttendanceDay[];
  points: PointRow[];
  offDays: number[];
}) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const byDay = new Map(days.map((day) => [day.day, day]));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="attendance-calendar">
      {SHORT_DAYS.map((name) => (
        <span key={name} className="calendar-head">
          {name}
        </span>
      ))}
      {Array.from({ length: lead }, (_, index) => (
        <span key={`lead-${index}`} />
      ))}
      {Array.from({ length: count }, (_, index) => {
        const day = `${month}-${String(index + 1).padStart(2, "0")}`;
        const record = byDay.get(day);
        const weekday = (lead + index) % 7;
        const dayPoints = points.filter((point) => point.day === day && !point.revoked_at);
        const state = record
          ? record.late_minutes > 0
            ? "late"
            : record.work_day
              ? "present"
              : "extra"
          : offDays.includes(weekday)
            ? "off"
            : dayPoints.some((point) => point.reason === "absent")
              ? "absent"
              : day > today
                ? "future"
                : "none";
        return (
          <span
            key={day}
            className={`calendar-day day-${state}${day === today ? " today" : ""}`}
            title={record ? `${time(record.first_seen)} — ${time(record.last_seen)}` : undefined}
          >
            <b>{number(index + 1)}</b>
            <em>
              {dayPoints.map((point) => (
                <i key={point.point_id} className={`dot point-${point.color}`} />
              ))}
            </em>
          </span>
        );
      })}
    </div>
  );
}
