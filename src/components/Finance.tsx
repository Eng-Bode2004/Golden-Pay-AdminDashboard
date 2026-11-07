const locale = () => (document.documentElement.lang === "en" ? "en-US" : "ar-EG-u-nu-latn");

export const money = (value: number | null | undefined) =>
  new Intl.NumberFormat(locale(), { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(value ?? 0);

export const monthLabel = (month: string, style: "long" | "short" = "long") =>
  new Intl.DateTimeFormat(locale(), { month: style, year: style === "long" ? "numeric" : undefined }).format(
    new Date(`${month}-15T12:00:00`),
  );

/** "YYYY-MM" for the current month. */
export const thisMonth = () => new Date().toISOString().slice(0, 7);

export function MonthPicker({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  return (
    <input
      className="month-picker"
      type="month"
      aria-label="الشهر"
      value={value}
      max={thisMonth()}
      onChange={(event) => event.target.value && onChange(event.target.value)}
    />
  );
}

export interface Series {
  key: string;
  label: string;
  tone: "accent" | "deep" | "ok";
}

/** Grouped bars for up to six months; heights scale to the largest value. */
export function TrendBars({ rows, series }: { rows: Record<string, number | string>[]; series: Series[] }) {
  const peak = Math.max(1, ...rows.flatMap((row) => series.map((item) => Number(row[item.key]) || 0)));
  return (
    <div className="trend-chart">
      <div className="trend-legend">
        {series.map((item) => (
          <span key={item.key}>
            <i className={`tone-${item.tone}`} />
            {item.label}
          </span>
        ))}
      </div>
      <div className="trend-bars" role="img" aria-label="الاتجاه الشهري">
        {rows.map((row) => (
          <div className="trend-month" key={String(row.month)}>
            <div className="trend-columns">
              {series.map((item) => {
                const value = Number(row[item.key]) || 0;
                return (
                  <span
                    key={item.key}
                    className={`tone-${item.tone}`}
                    style={{ height: `${Math.max(2, (value / peak) * 100)}%` }}
                    title={`${item.label}: ${money(value)}`}
                  />
                );
              })}
            </div>
            <small>{monthLabel(String(row.month), "short")}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
