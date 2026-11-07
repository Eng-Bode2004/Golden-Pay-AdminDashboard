import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiRequestError } from "../api";
import { useAuth } from "../auth";
import { Avatar, date, Empty, ErrorMessage, Icon } from "../components/ui";

interface AdminRow {
  user_id: string;
  full_name: string;
  email: string;
  is_owner: boolean;
  mfa_required: boolean;
  enrolled: boolean;
  mfa_method?: "email" | "totp" | "both";
}
interface InviteRow {
  invitation_id: string;
  email: string;
  full_name: string | null;
  mfa_required: boolean;
  status: string;
  expires_at: string;
}
export function AdministratorsPage() {
  const { security, user } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [from, setFrom] = useState("");
  const [email, setEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const [a, i] = await Promise.all([
      api<{ administrators: AdminRow[] }>("/admin/administrators"),
      api<{ invitations: InviteRow[]; from: string }>(
        "/admin/administrators/invitations",
      ),
    ]);
    setAdmins(a.administrators);
    setInvites(i.invitations);
    setFrom(i.from);
  }
  useEffect(() => {
    if (security?.is_owner)
      void load().catch(() => setError("تعذّر تحميل بيانات الإدارة."));
  }, [security?.is_owner]);
  if (!security?.is_owner)
    return (
      <section className="glass panel">
        <Empty>هذا القسم متاح للمدير الرئيسي فقط.</Empty>
      </section>
    );
  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setBusy("invite");
    setError("");
    setMessage("");
    setInviteUrl("");
    try {
      const result = await api<{
        invite_url: string;
        email_sent: boolean;
        from: string;
      }>("/admin/administrators/invitations", {
        method: "POST",
        body: JSON.stringify({
          email,
        }),
      });
      setInviteUrl(result.invite_url);
      setFrom(result.from);
      setMessage(
        result.email_sent
          ? "تم إرسال الدعوة بنجاح إلى البريد الإلكتروني."
          : "تم إنشاء الدعوة لكن تعذّر إرسال البريد. شارك الرابط بطريقة آمنة وتحقق من إعدادات SMTP في الخدمة.",
      );
      setEmail("");
      await load();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "تعذّر إرسال الدعوة.",
      );
    } finally {
      setBusy("");
    }
  }
  async function setPolicy(admin: AdminRow) {
    if (
      !window.confirm(
        `هل تريد ${admin.mfa_required ? "تعطيل" : "تفعيل"} المصادقة بخطوتين لهذا الحساب؟ ستنتهي جلساته الحالية.`,
      )
    )
      return;
    setBusy(admin.user_id);
    setError("");
    setMessage("");
    try {
      await api(`/admin/administrators/${admin.user_id}/policy`, {
        method: "POST",
        body: JSON.stringify({
          mfa_required: !admin.mfa_required,
          password: ownerPassword,
        }),
      });
      setOwnerPassword("");
      setMessage("تم تحديث سياسة الدخول وإنهاء جلسات الحساب.");
      await load();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "تعذّر تحديث السياسة.",
      );
    } finally {
      setBusy("");
    }
  }
  async function inviteAction(
    invitation: InviteRow,
    type: "resend" | "revoke",
  ) {
    if (type === "revoke" && !window.confirm("هل تريد إلغاء هذه الدعوة؟"))
      return;
    setBusy(invitation.invitation_id);
    setError("");
    try {
      await api(
        `/admin/administrators/invitations/${invitation.invitation_id}${type === "resend" ? "/resend" : ""}`,
        { method: type === "resend" ? "POST" : "DELETE" },
      );
      await load();
      setMessage(
        type === "resend"
          ? "تمت إعادة معالجة إرسال الدعوة. تحقق من البريد أو إعدادات SMTP."
          : "تم إلغاء الدعوة.",
      );
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "تعذّر تنفيذ الإجراء.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            مساحة العمل <span>/</span> الإدارة والأمان
          </p>
          <h1>
            صلاحيات واضحة. <span>وصول آمن.</span>
          </h1>
          <p className="page-description">
            أدر فريق الإدارة وسياسات المصادقة بثقة.
          </p>
        </div>
        <span className="badge">
          <Icon name="shield" size={14} />
          المدير الرئيسي
        </span>
      </div>
      <ErrorMessage message={error} />
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      <div className="split admin-split">
        <section className="glass panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">فريق الإدارة</span>
              <h2>المديرون والصلاحيات</h2>
            </div>
            <Icon name="shield" />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>المدير</th>
                  <th>سياسة الدخول</th>
                  <th>إدارة الحماية</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin, i) => (
                  <tr key={admin.user_id}>
                    <td>
                      <div className="person-cell">
                        <Avatar name={admin.full_name} small color={i} />
                        <div>
                          <strong>
                            {admin.full_name}
                            {admin.is_owner ? " · الرئيسي" : ""}
                          </strong>
                          <small dir="ltr">{admin.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${admin.mfa_required ? "status-active" : ""}`}
                      >
                        <Icon
                          name={admin.mfa_required ? "shield" : "key"}
                          size={12}
                        />
                        {admin.mfa_required && admin.mfa_method === "email"
                          ? "كلمة مرور + رمز بالبريد"
                          : admin.mfa_required && admin.mfa_method === "both"
                            ? admin.enrolled
                              ? "كلمة مرور + بريد + مصادقة"
                              : "بانتظار إعداد المصادقة"
                            : admin.mfa_required
                              ? admin.enrolled
                                ? "كلمة مرور + مصادقة"
                                : "بانتظار إعداد المصادقة"
                              : "كلمة مرور فقط"}
                      </span>
                    </td>
                    <td>
                      {user?.user_id === admin.user_id ? (
                        <Link className="btn ghost small" to="/security">
                          إدارة حسابي
                        </Link>
                      ) : (
                        <button
                          className="btn ghost small"
                          disabled={!!busy || !ownerPassword}
                          onClick={() => void setPolicy(admin)}
                        >
                          {admin.mfa_required
                            ? "تعطيل المصادقة"
                            : "تفعيل المصادقة"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="owner-confirm">
            <label className="field">
              <span>تأكيد كلمة مرور المدير الرئيسي</span>
              <input
                type="password"
                dir="ltr"
                autoComplete="current-password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                placeholder="••••••••••"
              />
            </label>
            <p className="hint">
              مطلوبة لتغيير سياسة المصادقة فقط. سيحتاج المدير لتسجيل الدخول
              مجدداً.
            </p>
          </div>
        </section>
        <form className="card" onSubmit={invite}>
          <span className="eyebrow">وسّع دائرة الثقة</span>
          <h2>دعوة مدير جديد</h2>
          <p className="hint">
            أرسل دعوة شخصية. يختار المدير اسمه وكلمة مروره وطريقة حماية حسابه عند فتح الرابط.
          </p>
          <label className="field">
            <span>البريد الإلكتروني</span>
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
            />
          </label>
          <button className="btn btn-primary btn-block" disabled={!!busy}>
            <Icon name="mail" size={17} />
            {busy === "invite" ? "جارٍ الإرسال…" : "إرسال الدعوة"}
          </button>
          {from && (
            <p className="hint" style={{ fontSize: 10, marginTop: 17 }}>
              بريد الإرسال: <bdi>{from}</bdi>
            </p>
          )}
        </form>
      </div>
      {inviteUrl && (
        <div className="card" style={{ marginTop: 22 }}>
          <h2>رابط الدعوة</h2>
          <p className="hint">
            تعامل معه كبيانات حساسة ولا تشاركه إلا مع المدير المقصود.
          </p>
          <p className="secret">{inviteUrl}</p>
          <button
            className="btn small"
            onClick={() =>
              void navigator.clipboard
                .writeText(inviteUrl)
                .then(() => setMessage("تم نسخ رابط الدعوة."))
                .catch(() => setError("تعذّر النسخ. حدد الرابط وانسخه يدوياً."))
            }
          >
            نسخ الرابط
          </button>
          <button
            className="btn small ghost"
            style={{ marginInlineStart: 8 }}
            onClick={() => setInviteUrl("")}
          >
            إخفاء الرابط
          </button>
        </div>
      )}
      <section className="glass panel" style={{ marginTop: 22 }}>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">الوصول القادم</span>
            <h2>الدعوات الإدارية</h2>
          </div>
          <span className="count-label">{invites.length} دعوات</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>البريد الإلكتروني</th>
                <th>الحالة</th>
                <th>الصلاحية حتى</th>
                <th>المصادقة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((item) => (
                <tr key={item.invitation_id}>
                  <td className="mono">{item.email}</td>
                  <td>
                    <span className="badge">
                      {{
                        pending: "بانتظار القبول",
                        accepted: "مقبولة",
                        revoked: "ملغاة",
                        expired: "منتهية",
                      }[item.status] ?? item.status}
                    </span>
                  </td>
                  <td className="date-cell">{date(item.expires_at)}</td>
                  <td>{item.mfa_required ? "مطلوبة" : "كلمة مرور"}</td>
                  <td>
                    <div className="row-actions">
                      {item.status === "pending" && (
                        <>
                          <button
                            className="btn ghost small"
                            disabled={!!busy}
                            onClick={() => void inviteAction(item, "resend")}
                          >
                            إعادة إرسال
                          </button>
                          <button
                            className="btn ghost btn-danger small"
                            disabled={!!busy}
                            onClick={() => void inviteAction(item, "revoke")}
                          >
                            إلغاء
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!invites.length && <Empty>لم تُرسل أي دعوات بعد.</Empty>}
      </section>
    </div>
  );
}
