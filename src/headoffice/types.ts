import type { Tally } from "../components/Points";
import { number } from "../components/ui";

export interface StaffMonth {
  user_id: string;
  full_name: string;
  employee_number: string | null;
  email: string | null;
  phone: string | null;
  staff_group: "admin" | "investigator";
  roles: string[];
  last_login_at: string | null;
  points: Tally;
  attendance: { days: number; late_days: number; late_minutes: number; hours: number; absent: number };
  cases: {
    approved: number;
    negative: number;
    on_time: number;
    with_deadline: number;
    active: number;
    pay: number;
    revenue: number;
    created: number;
    reviewed: number;
    returned: number;
    avg_review_hours: number | null;
  };
  pay: {
    base: number;
    case_pay: number;
    bonus: number;
    deduction: number;
    adjustments: number;
    total: number;
    paid: { amount: number; paid_at: string } | null;
  };
  score: number;
}

export interface MonthResult {
  month: string;
  revenue: number;
  approved_cases: number;
  salaries: number;
  case_pay: number;
  bonuses: number;
  deductions: number;
  adjustments: number;
  payroll: number;
  expenses: number;
  net: number;
}

export interface Schedule {
  start: string;
  end: string;
  grace_minutes: number;
  off_days: number[];
  overtime_minutes: number;
  offday_min_minutes: number;
}

export interface PointRules {
  blue_per_black: number;
  blue_bonus: number;
  black_deduction: number;
  absence_black: boolean;
}

export const GROUP_LABEL: Record<string, string> = { admin: "مدير", investigator: "مستعلم" };

export const percent = (part: number, whole: number) => (whole ? `${number(Math.round((part / whole) * 100))}٪` : "—");

export const hoursLabel = (value: number | null) =>
  value === null ? "—" : value < 1 ? `${number(Math.round(value * 60))} د` : `${number(Math.round(value * 10) / 10)} س`;

/** What the person produced this month, in one line. */
export const outputLine = (person: StaffMonth) =>
  person.staff_group === "investigator"
    ? `${number(person.cases.approved)} معتمد · ${percent(person.cases.on_time, person.cases.with_deadline)} في الموعد`
    : `${number(person.cases.created)} أُرسل · ${number(person.cases.reviewed)} مراجعة`;
