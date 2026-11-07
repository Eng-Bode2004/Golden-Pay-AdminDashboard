import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../api";
import { useAuth } from "../auth";
import { Avatar, ErrorMessage, Icon, type IconName } from "../components/ui";

interface SetupResult {
  secret: string;
  otpauth_uri: string;
  qr_code: string;
  current_method: string;
}

type MethodKey = "password" | "email" | "totp" | "both";

const METHODS: {
  key: MethodKey;
  icon: IconName;
  title: string;
  description: string;
  tag: string;
}[] = [
  {
    key: "password",
    icon: "key",
    title: "البريد وكلمة المرور",
    description: "تسجيل دخول مباشر بالبريد الإلكتروني وكلمة المرور فقط.",
    tag: "الأبسط",
  },
  {
    key: "email",
    icon: "mail",
    title: "كلمة المرور + رمز بالبريد",
    description:
      "بعد كلمة المرور يصلك رمز من 6 أرقام على بريدك الإلكتروني عند كل دخول.",
    tag: "خطوتان",
  },
  {
    key: "totp",
    icon: "shield",
    title: "كلمة المرور + تطبيق المصادقة",
    description:
      "بعد كلمة المرور تدخل رمزاً متغيّراً من Google Authenticator أو Authy.",
    tag: "خطوتان",
  },
  {
    key: "both",
    icon: "lock",
    title: "كلمة المرور + البريد + تطبيق المصادقة",
    description:
      "أعلى درجات الحماية: رمز على البريد، ثم رمز تطبيق المصادقة، عند كل دخول.",
    tag: "ثلاث خطوات",
  },
];

const STATUS_LABEL: Record<MethodKey, string> = {
  password: "كلمة المرور فقط",
  email: "كلمة المرور + رمز بالبريد",
  totp: "كلمة المرور + تطبيق المصادقة",
  both: "كلمة المرور + البريد + تطبيق المصادقة",
};

export function SecurityPage() {
  const { user, security, refreshMe } = useAuth();
  const navigate = useNavigate();
  const startedOnboarding = useRef(false);
  useEffect(() => {
    if (!security || startedOnboarding.current) return;
    const method = new URLSearchParams(window.location.search).get("setup");
    if (method === "email" || method === "totp" || method === "both") {
      startedOnboarding.current = true;
      chooseMethod(method);
      navigate("/security", { replace: true });
    }
  }, [security]);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [setup, setSetup] = useState<SetupResult | null>(null);
  const [setupMode, setSetupMode] = useState<"totp" | "both">("totp");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<MethodKey | null>(null);
  const [password, setPassword] = useState("");
  const [emailChallenge, setEmailChallenge] = useState<{
    token: string;
    hint: string;
  } | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const activeMethod: MethodKey = !security?.mfa_required
    ? "password"
    : security.mfa_method === "email"
      ? "email"
      : security.mfa_method === "both"
        ? "both"
        : "totp";
  const needsEnrollment =
    (activeMethod === "totp" || activeMethod === "both") && !security?.enrolled;
  const hasAuthenticator = !!security?.enrolled && activeMethod !== "email";
  const statusLabel = needsEnrollment
    ? "بانتظار إعداد تطبيق المصادقة"
    : STATUS_LABEL[activeMethod];

  function resetFlow() {
    setError("");
    setMessage("");
    setRecovery([]);
    setCode("");
    setPassword("");
    setEmailChallenge(null);
    setEmailCode("");
  }

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    setBusy("name");
    resetFlow();
    try {
      await api("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName.trim() }),
      });
      await refreshMe();
      setMessage("تم تحديث الاسم الظاهر في مساحة العمل.");
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "تعذّر تحديث الاسم.",
      );
    } finally {
      setBusy("");
    }
  }

  function chooseMethod(key: MethodKey) {
    if (key === activeMethod && !needsEnrollment) return;
    resetFlow();
    setSetup(null);

    if (key === "totp" || key === "both") {
      setConfirming(null);
      if (hasAuthenticator) {
        // The authenticator already exists: only the chain changes.
        setConfirming(key);
      } else {
        setSetupMode(key);
        void startSetup();
      }
      return;
    }
    setConfirming(key);
  }

  async function startSetup() {
    setBusy("setup");
    setError("");
    setMessage("");
    setRecovery([]);
    try {
      setSetup(
        await api<SetupResult>("/auth/mfa/totp/setup", { method: "POST" }),
      );
      setCode("");
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "تعذّر بدء إعداد تطبيق المصادقة.",
      );
    } finally {
      setBusy("");
    }
  }

  async function activate(event: React.FormEvent) {
    event.preventDefault();
    setBusy("activate");
    setError("");
    setMessage("");
    try {
      const result = await api<{ recovery_codes: string[] }>(
        "/auth/mfa/totp/activate",
        {
          method: "POST",
          body: JSON.stringify({ code: code.trim(), mode: setupMode }),
        },
      );
      setRecovery(result.recovery_codes);
      setSetup(null);
      setCode("");
      await refreshMe();
      setMessage(
        setupMode === "both"
          ? "تم تفعيل الحماية الثلاثية: كلمة المرور، ثم رمز البريد، ثم تطبيق المصادقة."
          : "تم تفعيل تطبيق المصادقة. ستحتاج رمزه بعد كلمة المرور عند كل دخول.",
      );
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "تعذّر تفعيل المصادقة. تحقق من الرمز وحاول مجدداً.",
      );
    } finally {
      setBusy("");
    }
  }

  async function switchToPassword() {
    setBusy("method-password");
    setError("");
    setMessage("");
    try {
      await api("/auth/mfa/totp/disable", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      resetFlow();
      setConfirming(null);
      await refreshMe();
      setMessage("أصبح الدخول بالبريد وكلمة المرور فقط.");
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "تعذّر تغيير طريقة الدخول، تحقق من كلمة المرور.",
      );
    } finally {
      setBusy("");
    }
  }

  async function switchTotpMode() {
    if (confirming !== "totp" && confirming !== "both") return;
    setBusy("method-totp");
    setError("");
    setMessage("");
    try {
      await api("/auth/mfa/totp/mode", {
        method: "POST",
        body: JSON.stringify({ method: confirming, password }),
      });
      resetFlow();
      setConfirming(null);
      await refreshMe();
      setMessage(
        confirming === "both"
          ? "تم ضبط الدخول على: كلمة المرور، ثم رمز البريد، ثم تطبيق المصادقة."
          : "تم ضبط الدخول على: كلمة المرور ثم تطبيق المصادقة.",
      );
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "تعذّر تغيير ترتيب التحقق، تحقق من كلمة المرور.",
      );
    } finally {
      setBusy("");
    }
  }

  async function sendEmailCode() {
    setBusy("email-send");
    setError("");
    setMessage("");
    try {
      const result = await api<{ challenge_token: string; email_hint: string }>(
        "/auth/mfa/email/start",
        { method: "POST", body: JSON.stringify({ password }) },
      );
      setEmailChallenge({
        token: result.challenge_token,
        hint: result.email_hint,
      });
      setEmailCode("");
      setMessage(
        `أرسلنا رمز تحقق إلى ${result.email_hint}. أدخله لإتمام التفعيل.`,
      );
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "تعذّر إرسال رمز التحقق. تحقق من كلمة المرور وحاول مجدداً.",
      );
    } finally {
      setBusy("");
    }
  }

  async function confirmEmailCode(event: React.FormEvent) {
    event.preventDefault();
    if (!emailChallenge) return;
    setBusy("email-confirm");
    setError("");
    setMessage("");
    try {
      await api("/auth/mfa/email/confirm", {
        method: "POST",
        body: JSON.stringify({
          challenge_token: emailChallenge.token,
          code: emailCode.trim(),
        }),
      });
      resetFlow();
      setConfirming(null);
      await refreshMe();
      setMessage("تم التفعيل: سيصلك رمز تحقق على بريدك عند كل تسجيل دخول.");
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "تعذّر تأكيد الرمز. تحقق منه وحاول مجدداً.",
      );
    } finally {
      setBusy("");
    }
  }

  function confirmCopy() {
    if (confirming === "password")
      return {
        title: "إيقاف المصادقة",
        hint: "سيصبح الدخول بكلمة المرور فقط. سيلغي هذا تطبيق المصادقة ورموز الاسترداد.",
        action: "تأكيد التبديل",
      };
    if (confirming === "email")
      return {
        title: "رمز التحقق عبر البريد",
        hint: "سيُستخدم رمز البريد عند كل دخول، وسيُلغى تطبيق المصادقة الحالي إن وجد.",
        action: "إرسال رمز التحقق",
      };
    if (confirming === "both")
      return {
        title: "إضافة رمز البريد قبل تطبيق المصادقة",
        hint: "سيطلب الدخول رمز البريد أولاً ثم رمز تطبيق المصادقة. لا حاجة لإعادة مسح رمز QR.",
        action: "تفعيل الخطوة الإضافية",
      };
    return {
      title: "إزالة خطوة رمز البريد",
      hint: "سيطلب الدخول كلمة المرور ثم رمز تطبيق المصادقة فقط.",
      action: "تأكيد التبديل",
    };
  }

  const copy = confirmCopy();

  return (
    <div className="page-enter account-page">
      <div className="page-heading account-heading">
        <div>
          <button
            className="btn btn-ghost btn-small account-back"
            type="button"
            onClick={() => navigate(-1)}
          >
            <Icon name="arrow" size={14} />
            عودة
          </button>
          <p className="eyebrow">
            مساحة العمل <span>/</span> إدارة حسابي
          </p>
          <h1>
            حسابك. <span>بحماية تليق بك.</span>
          </h1>
          <p className="page-description">
            حدّث بياناتك الظاهرة واختر طريقة تسجيل الدخول المناسبة لك.
          </p>
        </div>
        <div className="account-status">
          <span className={`badge${needsEnrollment ? " status-pending" : ""}`}>
            <Icon name={needsEnrollment ? "shield" : "lock"} size={14} />
            {statusLabel}
          </span>
          {security?.is_owner && (
            <span className="badge">
              <Icon name="users" size={14} />
              المدير الرئيسي
            </span>
          )}
        </div>
      </div>

      <ErrorMessage message={error} />
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}

      <div className="account-grid">
        <section className="glass panel profile-card">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">بيانات الحساب</span>
              <h2>الملف الشخصي</h2>
            </div>
            <Icon name="users" />
          </div>
          <div className="person-cell profile-person">
            <Avatar name={user?.full_name ?? "جولدن باي"} />
            <div>
              <strong>{user?.full_name}</strong>
              <small dir="ltr">{user?.email}</small>
            </div>
          </div>
          <form onSubmit={saveName}>
            <label className="field">
              <span>الاسم الظاهر</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                minLength={3}
                maxLength={120}
                required
                autoComplete="name"
              />
            </label>
            <p className="hint">يظهر هذا الاسم في مساحة العمل وسجل النشاط.</p>
            <button
              className="btn btn-primary"
              disabled={!!busy || fullName.trim() === user?.full_name}
            >
              <Icon name="check" size={17} />
              {busy === "name" ? "جارٍ الحفظ…" : "حفظ الاسم"}
            </button>
          </form>
          <dl className="account-facts">
            <div>
              <dt>طريقة الدخول الحالية</dt>
              <dd>{statusLabel}</dd>
            </div>
            <div>
              <dt>تطبيق المصادقة</dt>
              <dd>{hasAuthenticator ? "مفعّل" : "غير مفعّل"}</dd>
            </div>
            <div>
              <dt>رموز الاسترداد</dt>
              <dd>
                {hasAuthenticator
                  ? `${security?.recovery_codes_remaining ?? 0} متبقية`
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="glass panel security-card">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">تسجيل الدخول</span>
              <h2>طريقة الدخول والحماية</h2>
            </div>
            <Icon name="lock" />
          </div>

          {recovery.length ? (
            <div className="recovery-block">
              <p className="hint">
                احفظ رموز الاسترداد التالية في مكان آمن. لن تظهر مرة أخرى. كل
                رمز يُستخدم مرة واحدة فقط إذا فقدت تطبيق المصادقة.
              </p>
              <div className="recovery-list" dir="ltr">
                {recovery.map((item) => (
                  <code key={item}>{item}</code>
                ))}
              </div>
              <div className="row-actions" style={{ marginTop: 16 }}>
                <button
                  className="btn small"
                  type="button"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(recovery.join("\n"))
                      .then(() => setMessage("تم نسخ رموز الاسترداد."))
                      .catch(() =>
                        setError("تعذّر النسخ. حدّد الرموز وانسخها يدوياً."),
                      )
                  }
                >
                  نسخ الرموز
                </button>
                <button
                  className="btn ghost small"
                  type="button"
                  onClick={() => setRecovery([])}
                >
                  حفظت الرموز
                </button>
              </div>
            </div>
          ) : setup ? (
            <form onSubmit={activate}>
              <p className="hint">
                امسح رمز الإعداد باستخدام Google Authenticator أو Authy، ثم أدخل
                الرمز المكوّن من 6 أرقام للتأكيد. لن تُفعّل الحماية الجديدة قبل
                التحقق من الرمز.
              </p>
              <div className="qr">
                <img src={setup.qr_code} alt="رمز إعداد تطبيق المصادقة" />
              </div>
              <p className="secret" aria-label="مفتاح الإعداد اليدوي">
                {setup.secret}
              </p>
              <label className="field">
                <span>رمز تطبيق المصادقة</span>
                <input
                  dir="ltr"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  autoFocus
                />
              </label>
              <div className="row-actions">
                <button
                  className="btn btn-primary"
                  disabled={busy === "activate" || code.length !== 6}
                >
                  <Icon name="check" size={17} />
                  {busy === "activate" ? "جارٍ التحقق…" : "تأكيد وتفعيل"}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => {
                    setSetup(null);
                    setCode("");
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          ) : (
            <div
              className="method-options"
              role="radiogroup"
              aria-label="طريقة تسجيل الدخول"
            >
              {METHODS.map((option) => {
                const active = option.key === activeMethod && !needsEnrollment;
                const isConfirming = confirming === option.key;
                const isAuthenticator =
                  option.key === "totp" || option.key === "both";
                return (
                  <div
                    key={option.key}
                    className={`method-option${active ? " active" : ""}${isConfirming ? " confirming" : ""}`}
                  >
                    <button
                      type="button"
                      className="method-option-head"
                      role="radio"
                      aria-checked={active}
                      disabled={!!busy}
                      onClick={() => chooseMethod(option.key)}
                    >
                      <span className="method-radio" aria-hidden="true" />
                      <span className="method-icon">
                        <Icon name={option.icon} size={18} />
                      </span>
                      <span className="method-text">
                        <strong>
                          {option.title}
                          <em>{option.tag}</em>
                        </strong>
                        <small>{option.description}</small>
                      </span>
                      <span className="method-state">
                        {active ? (
                          <>
                            <Icon name="check" size={14} />
                            مفعّلة
                          </>
                        ) : null}
                      </span>
                    </button>
                    {isConfirming && (
                      <div className="method-confirm">
                        {option.key === "email" && emailChallenge ? (
                          <form onSubmit={confirmEmailCode}>
                            <label className="field">
                              <span>رمز التحقق من البريد الإلكتروني</span>
                              <input
                                dir="ltr"
                                value={emailCode}
                                onChange={(event) =>
                                  setEmailCode(event.target.value)
                                }
                                autoComplete="one-time-code"
                                inputMode="numeric"
                                maxLength={6}
                                pattern="[0-9]{6}"
                                placeholder="••••••"
                                required
                                autoFocus
                              />
                            </label>
                            <div className="row-actions">
                              <button
                                className="btn btn-primary small"
                                disabled={!!busy || emailCode.length !== 6}
                              >
                                <Icon name="check" size={15} />
                                {busy === "email-confirm"
                                  ? "جارٍ التحقق…"
                                  : "تأكيد وتفعيل"}
                              </button>
                              <button
                                className="btn ghost small"
                                type="button"
                                disabled={!!busy}
                                onClick={() => void sendEmailCode()}
                              >
                                إعادة إرسال الرمز
                              </button>
                              <button
                                className="btn ghost small"
                                type="button"
                                onClick={() => {
                                  setConfirming(null);
                                  setEmailChallenge(null);
                                  setEmailCode("");
                                  setPassword("");
                                }}
                              >
                                إلغاء
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <p className="method-confirm-title">{copy.title}</p>
                            <p className="hint">{copy.hint}</p>
                            <label className="field">
                              <span>أكّد بكلمة المرور الحالية</span>
                              <input
                                type="password"
                                dir="ltr"
                                autoComplete="current-password"
                                value={password}
                                onChange={(event) =>
                                  setPassword(event.target.value)
                                }
                                placeholder="••••••••••"
                                autoFocus
                              />
                            </label>
                            <div className="row-actions">
                              <button
                                className="btn btn-primary small"
                                type="button"
                                disabled={!!busy || !password}
                                onClick={() => {
                                  if (option.key === "email")
                                    void sendEmailCode();
                                  else if (isAuthenticator)
                                    void switchTotpMode();
                                  else void switchToPassword();
                                }}
                              >
                                {busy === "method-password" ||
                                busy === "method-totp" ||
                                busy === "email-send"
                                  ? "جارٍ التطبيق…"
                                  : copy.action}
                              </button>
                              <button
                                className="btn ghost small"
                                type="button"
                                onClick={() => {
                                  setConfirming(null);
                                  setPassword("");
                                }}
                              >
                                إلغاء
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {needsEnrollment && (
                <p className="hint" style={{ marginTop: 14 }}>
                  طريقة تطبيق المصادقة محدّدة في سياسة حسابك لكن لم يكتمل
                  إعدادها. اختر «تطبيق المصادقة» لإكمال الإعداد، أو بدّل إلى
                  طريقة أخرى.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
