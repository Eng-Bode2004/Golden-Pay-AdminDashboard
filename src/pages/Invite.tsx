import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiRequestError } from "../api";
import { useAuth } from "../auth";
import { Ambient, Brand, ErrorMessage, Icon } from "../components/ui";
import { Preferences } from "../preferences";

export function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState("password");
  const [step, setStep] = useState(0);
  const [legacyMfa, setLegacyMfa] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ email: string; full_name: string; mfa_required: boolean }>(`/auth/admin-invite/${encodeURIComponent(token)}`, { auth: false })
      .then(data => { setEmail(data.email); setFullName(data.full_name); setLegacyMfa(data.mfa_required); })
      .catch(() => setError("الدعوة غير صالحة أو انتهت صلاحيتها. اطلب دعوة جديدة من المدير الرئيسي."));
  }, [token]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (step < 2) { setStep(step + 1); return; }
    setBusy(true); setError("");
    try {
      await api("/auth/admin-invite/accept", { method: "POST", auth: false, body: JSON.stringify({ token, password, full_name: fullName.trim() }) });
      setCreated(true);
      if (legacyMfa) { navigate("/login", { replace: true }); return; }
      const result = await login(email, password);
      setPassword("");
      navigate(result.mfa ? "/login" : method === "password" ? "/" : `/security?setup=${method}`, { replace: true });
    } catch (err) { setError(err instanceof ApiRequestError ? err.message : "تعذّر قبول الدعوة."); }
    finally { setBusy(false); }
  }
  return <div className="auth-simple" dir={document.documentElement.dir}><Ambient /><div className="floating-tools"><Preferences /></div>
    <form className="auth-card page-enter" onSubmit={submit}>
      <Brand />
      <div className="onboarding-progress" aria-label={`${step + 1} / 3`}>{[0,1,2].map(i => <i key={i} className={i <= step ? "active" : ""} />)}</div>
      <div className="auth-card-head"><h2>مكانك في الفريق.</h2><p className="hint">أكمل بياناتك للانضمام إلى فريق إدارة جولدن باي.</p></div>
      <p className="onboarding-email" dir="ltr">{email || "…"}</p>
      {step === 0 && <label className="field"><span>الاسم الكامل</span><input value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" required minLength={3} maxLength={120} autoFocus /></label>}
      {step === 1 && <label className="field"><span>اختر كلمة مرور قوية</span><input dir="ltr" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}" required autoFocus /><small className="field-hint">8 أحرف على الأقل، تتضمن حرفاً كبيراً وصغيراً ورقماً.</small></label>}
      {step === 2 && <label className="field"><span>طريقة الدخول والحماية</span><select value={legacyMfa ? "totp" : method} disabled={legacyMfa} onChange={e => setMethod(e.target.value)}>
        <option value="password">البريد وكلمة المرور</option><option value="email">كلمة المرور + رمز بالبريد</option><option value="totp">كلمة المرور + تطبيق المصادقة</option><option value="both">كلمة المرور + البريد + تطبيق المصادقة</option>
      </select><small className="field-hint">يمكنك إكمال إعداد الحماية بعد إنشاء حسابك مباشرة.</small></label>}
      <ErrorMessage message={error} />
      <button className="btn btn-primary btn-block" disabled={busy || !email || created}>{busy ? "جارٍ إنشاء الحساب…" : step < 2 ? "متابعة" : "إنشاء الحساب والمتابعة"}<Icon name="arrow" size={17} /></button>
      {step > 0 && !created && <button className="btn ghost btn-block" type="button" disabled={busy} onClick={() => setStep(step-1)} style={{marginTop:12}}>عودة</button>}
      <Link className="btn ghost btn-block" style={{marginTop:12}} to="/login">العودة لتسجيل الدخول</Link>
    </form>
  </div>;
}
