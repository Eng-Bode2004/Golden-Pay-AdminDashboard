import { useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../api";
import { useAuth, type MfaChallenge } from "../auth";
import { Ambient, Brand, ErrorMessage, Icon } from "../components/ui";
import { Preferences } from "../preferences";
import { motionEnabled } from "../themes";

function HeroEmblem() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let mounted = true;
    let dispose = () => {};
    void import("../scene").then(({ mountEmblem }) => {
      if (!mounted || !canvas.current) return;
      try {
        dispose = mountEmblem(canvas.current, motionEnabled());
      } catch {
        // No WebGL: the header brand mark still identifies the page.
      }
    });
    return () => {
      mounted = false;
      dispose();
    };
  }, []);
  return <canvas ref={canvas} className="hero-emblem" aria-hidden="true" />;
}

export function LoginPage({ office = false }: { office?: boolean }) {
  const { login, verifyMfa, refreshMe } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mfa, setMfa] = useState<MfaChallenge | null>(null);
  const [recovery, setRecovery] = useState<string[]>([]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (recovery.length) {
        await refreshMe();
        return;
      }
      if (mfa) {
        const result = await verifyMfa(mfa.challenge_token, code.trim());
        if (result.next) {
          // Chained protection: email code passed, authenticator step next.
          setMfa(result.next);
          setCode("");
          return;
        }
        setRecovery(result.recovery);
        setMfa(null);
        setCode("");
        return;
      }
      const result = await login(email.trim(), password);
      if (result.mfa) {
        setMfa(result.mfa);
        setPassword("");
      }
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "تعذّر تسجيل الدخول. تأكد من تشغيل الخدمة وحاول مجدداً.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell" dir={document.documentElement.dir}>
      <Ambient />
      <header className="auth-header">
        <Brand />
        <div className="auth-header-tools">
          <span>
            <Icon name="globe" size={16} />
            جمهورية مصر العربية
          </span>
          <Preferences />
        </div>
      </header>
      <div className="auth-content page-enter">
        <section className="auth-story">
          <HeroEmblem />
          <p className="eyebrow">{office ? "الإدارة العليا" : "ثقة · أمان · خبرة"}</p>
          {office ? (
            <h1>
              شركتك كاملة،
              <br />
              <span>في نظرة واحدة.</span>
            </h1>
          ) : (
            <h1>
              أعمالك، برؤية أوضح.
              <br />
              <span>ومساحة تليق بك.</span>
            </h1>
          )}
          <p>
            {office
              ? "الحضور والنقاط والرواتب والمصروفات وصافي الأرباح لكل المديرين والمستعلمين، في مكان واحد."
              : "منصة جولدن باي لإدارة المحققين والتحقق من الهوية. كل التفاصيل التي تحتاجها، في مساحة عمل واحدة."}
          </p>
          <div className="auth-story-tags">
            <span>استعلامات بنكية</span>
            <span>تقييم ائتماني</span>
            <span>تحصيل ديون</span>
          </div>
        </section>
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-card-head">
            <span className="lock-icon">
              <Icon
                name={mfa ? "shield" : recovery.length ? "key" : "lock"}
                size={22}
              />
            </span>
            <h2>
              {recovery.length
                ? "احتفظ بمفتاح العودة."
                : mfa
                  ? "خطوة إضافية لحمايتك."
                  : "أهلاً بعودتك."}
            </h2>
            <p className="hint">
              {recovery.length
                ? "احفظ هذه الرموز في مكان آمن؛ لن تظهر مرة أخرى."
                : mfa
                  ? "تحقق من هويتك للمتابعة إلى مساحة العمل."
                  : "سجّل الدخول للمتابعة إلى مساحة عملك."}
            </p>
          </div>
          {recovery.length ? (
            <>
              <div className="recovery-list" dir="ltr">
                {recovery.map((item) => (
                  <code key={item}>{item}</code>
                ))}
              </div>
              <p className="hint">
                كل رمز يُستخدم مرة واحدة فقط إذا فقدت تطبيق المصادقة.
              </p>
            </>
          ) : !mfa ? (
            <>
              <label className="field">
                <span>البريد الإلكتروني</span>
                <input
                  type="email"
                  dir="ltr"
                  placeholder="you@company.com"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>كلمة المرور</span>
                <input
                  type="password"
                  dir="ltr"
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
            </>
          ) : (
            <>
              <p className="hint">
                {mfa.method === "email"
                  ? `أرسلنا رمز تحقق إلى ${mfa.email_hint ?? "بريدك الإلكتروني"}. أدخل الرمز المكوّن من 6 أرقام خلال 5 دقائق. تحقق من الرسائل غير المرغوب فيها أيضاً.`
                  : mfa.enrollment_required
                    ? "امسح رمز الإعداد باستخدام Google Authenticator أو Authy، ثم أدخل الرمز المكوّن من 6 أرقام."
                    : "أدخل رمز تطبيق المصادقة أو أحد رموز الاسترداد."}
              </p>
              {mfa.qr_code && (
                <div className="qr">
                  <img src={mfa.qr_code} alt="رمز إعداد تطبيق المصادقة" />
                </div>
              )}
              {mfa.secret && (
                <p className="secret" aria-label="مفتاح الإعداد اليدوي">
                  {mfa.secret}
                </p>
              )}
              <label className="field">
                <span>
                  {mfa.method === "email"
                    ? "رمز التحقق من البريد الإلكتروني"
                    : "رمز المصادقة أو الاسترداد"}
                </span>
                <input
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  maxLength={mfa.method === "email" ? 6 : 32}
                  inputMode={mfa.method === "email" ? "numeric" : "text"}
                  required
                  autoFocus
                />
              </label>
            </>
          )}
          <ErrorMessage message={error} />
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy
              ? "جارٍ التحقق…"
              : recovery.length
                ? "حفظت الرموز — متابعة"
                : mfa
                  ? "تحقق وتابع"
                  : "تسجيل الدخول"}
            <Icon name="arrow" size={18} />
          </button>
          {mfa && (
            <button
              className="btn ghost btn-block"
              type="button"
              style={{ marginTop: 10 }}
              onClick={() => {
                setMfa(null);
                setCode("");
                setError("");
              }}
            >
              {mfa.method === "email"
                ? "العودة وطلب رمز جديد"
                : "العودة لتسجيل الدخول"}
            </button>
          )}
          <div className="auth-card-footer">
            <Icon name="shield" size={14} />
            دخول محمي. بياناتك في أيدٍ آمنة.
          </div>
        </form>
      </div>
      <footer className="auth-footer">
        <span>© {new Date().getFullYear()} جولدن باي للخدمات</span>
        <span>الدقة في المعلومة · المهنية في المتابعة</span>
      </footer>
    </div>
  );
}
