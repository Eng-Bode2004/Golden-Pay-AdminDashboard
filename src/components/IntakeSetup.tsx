import { useState } from "react";
import { api, ApiRequestError } from "../api";
import { ErrorMessage, Icon, number } from "./ui";

interface CheckLine {
  key: string;
  label: string;
  level: "ok" | "warn" | "fail";
  detail: string;
}

const LEVEL_LABEL: Record<CheckLine["level"], string> = { ok: "يعمل", warn: "انتبه", fail: "لا يعمل" };

/** «فحص التشغيل»: every link of the email chain tested on the server, without sending anything. */
export function IntakeCheck() {
  const [lines, setLines] = useState<CheckLine[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ lines: CheckLine[] }>("/investigations/intake/check", { method: "POST", body: "{}" });
      setLines(result.lines);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر الفحص.");
    } finally {
      setBusy(false);
    }
  }

  const broken = lines?.filter((line) => line.level === "fail").length ?? 0;
  return (
    <section className="glass panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">فحص التشغيل</p>
          <h2>{!lines ? "هل يعمل البريد التلقائي الآن؟" : broken ? `عدد الأعطال: ${number(broken)}` : "لا يوجد عطل"}</h2>
        </div>
        <button className="btn small btn-primary" disabled={busy} onClick={() => void run()}>
          <Icon name="activity" size={15} />
          {busy ? "جارٍ الفحص…" : "افحص الآن"}
        </button>
      </div>
      <p className="field-hint">
        يختبر الدخول للصناديق الثلاثة، والإرسال، والحفظ، والقراءة الذكية، وكل جهة ونماذجها ومستعلميها. لا يرسل بريدًا ولا ينشئ
        استعلامًا ولا ينبّه أحدًا.
      </p>
      <ErrorMessage message={error} />
      {lines && (
        <ul className="check-lines">
          {lines.map((line) => (
            <li key={line.key} className={line.level}>
              <b>{LEVEL_LABEL[line.level]}</b>
              <span>{line.label}</span>
              <small dir="auto">{line.detail}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface SetupResult {
  client: string;
  name: string | null;
  linked: boolean;
  domains: string[];
  kinds: string[];
  problem: string | null;
}

/** Links every client at once from the private file (client id and email domains). */
export function IntakeSetup({ kinds, onDone }: { kinds: Record<string, string>; onDone: () => void }) {
  const [clients, setClients] = useState<{ client: string; domains: string[] }[] | null>(null);
  const [automatic, setAutomatic] = useState(false);
  const [twoVisits, setTwoVisits] = useState(false);
  const [results, setResults] = useState<SetupResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function choose(file: File | undefined) {
    setClients(null);
    setResults(null);
    setError("");
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { clients?: { client: string; domains: string[] }[] };
      if (!Array.isArray(parsed.clients) || !parsed.clients.every((item) => item && Array.isArray(item.domains))) throw new Error("shape");
      setClients(parsed.clients);
    } catch {
      setError("هذا ليس ملف ربط الجهات (client-setup.json).");
    }
  }

  async function apply() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ results: SetupResult[] }>("/investigations/intake/setup", {
        method: "POST",
        body: JSON.stringify({ clients, auto_send: automatic, two_visits: twoVisits }),
      });
      setResults(result.results);
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر الربط.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setup-box">
      <div className="setup-head">
        <div>
          <strong>ربط كل الجهات مرة واحدة</strong>
          <small>ارفع ملف client-setup.json. يُختار نموذج كل نوع تلقائيًا، ويبقى ما اخترته بنفسك.</small>
        </div>
        <label className="btn small">
          <Icon name="file" size={15} />
          اختيار الملف
          <input type="file" accept=".json,application/json" hidden onChange={(event) => void choose(event.target.files?.[0])} />
        </label>
      </div>
      {clients && !results && (
        <>
          <ul className="setup-list">
            {clients.map((item) => (
              <li key={item.client}>
                <b>{item.client}</b>
                <span dir="ltr">{item.domains.join(", ")}</span>
              </li>
            ))}
          </ul>
          <label className="check-row">
            <input type="checkbox" checked={automatic} onChange={(event) => setAutomatic(event.target.checked)} />
            إرسال تلقائي للمستعلمين لكل هذه الجهات عندما تكون القراءة مؤكدة
          </label>
          <label className="check-row">
            <input type="checkbox" checked={twoVisits} onChange={(event) => setTwoVisits(event.target.checked)} />
            أوافق أن «سكن وعمل» زيارتان بتقريرين وسعرين وأجرين، وتُرسلان تلقائيًا
          </label>
          <button className="btn btn-primary small" disabled={busy} onClick={() => void apply()}>
            {busy ? "جارٍ الربط…" : `ربط ${number(clients.length)} جهة`}
          </button>
        </>
      )}
      {results && (
        <ul className="setup-list">
          {results.map((item) => (
            <li key={item.client} className={item.linked ? (item.problem ? "warn" : "ok") : "fail"}>
              <b>{item.name ?? item.client}</b>
              <span>{item.linked ? item.kinds.map((kind) => kinds[kind] ?? kind).join(" · ") || "—" : "لم تُربط"}</span>
              {item.problem && <small>{item.problem}</small>}
            </li>
          ))}
        </ul>
      )}
      <ErrorMessage message={error} />
    </div>
  );
}
