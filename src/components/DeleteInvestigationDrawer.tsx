import { useState } from "react";
import { createPortal } from "react-dom";
import { api, ApiRequestError } from "../api";
import { ErrorMessage, Icon } from "./ui";

interface Deleted {
  reference: string;
  files_deleted: number;
  excuses_cancelled: number;
  charges_removed: number;
  mail_case_closed: boolean;
}

/** Deletes one investigation and everything about it, after its number and the admin's password. */
export function DeleteInvestigationDrawer({
  item,
  onClose,
  onDeleted,
}: {
  item: { investigation_id: string; reference: string; subject_name: string; status: string };
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Deleted | null>(null);
  const confirmed = typed.trim() === item.reference.trim();

  async function remove(event: React.FormEvent) {
    event.preventDefault();
    if (!confirmed || !password) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ deleted: Deleted }>(`/admin/investigations/${item.investigation_id}`, {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      setDone(result.deleted);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر حذف الاستعلام.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  return createPortal(
    <div className="drawer-root" dir={document.documentElement.dir}>
      <button className="drawer-scrim" aria-label="إغلاق" onClick={done ? onDeleted : onClose} />
      <aside className="review-drawer" role="dialog" aria-modal="true" aria-label="حذف الاستعلام">
        <header className="drawer-head">
          <div>
            <span className="eyebrow">حذف نهائي</span>
            <h2>{item.subject_name}</h2>
          </div>
          <button className="icon-button" aria-label="إغلاق" onClick={done ? onDeleted : onClose}>
            <Icon name="close" size={17} />
          </button>
        </header>
        <div className="drawer-body">
          {done ? (
            <section>
              <h3>تم الحذف</h3>
              <p className="hint">
                حُذف الاستعلام «{done.reference}» وكل ما يخصه من النظام.
                {done.charges_removed > 0 && ` أُلغي خصم الاعتذار عنه (${done.charges_removed}).`}
                {done.mail_case_closed && " وأُغلق في صندوق البريد حتى لا يُرسل مرة أخرى."}
              </p>
              <button className="btn btn-primary btn-block" onClick={onDeleted}>
                تم
              </button>
            </section>
          ) : (
            <form onSubmit={remove}>
              <section>
                <h3>ما الذي سيُحذف</h3>
                <ul className="hint">
                  <li>بيانات الاستعلام والإجابات والتقرير (PDF و Word).</li>
                  <li>كل الصور، ومنها صورة المستعلم وبطاقته عند الزيارة.</li>
                  <li>السجل ومسار التحركات والعروض والإسنادات والإشعارات.</li>
                  <li>الاعتذارات عنه وخصوماتها، وسجل رسائل التقرير المرسلة للعميل.</li>
                </ul>
                {item.status === "approved" && (
                  <p className="hint">
                    هذا الاستعلام معتمد: سيخرج سعره من مستحقات المستعلم وإيرادات الشهر. الأشهر المصروفة تبقى بما صُرفت به.
                  </p>
                )}
                <p className="hint">الرسائل التي وصلت لهواتف المستعلمين أو للعميل لا يمكن استرجاعها. لا يمكن التراجع عن الحذف.</p>
              </section>
              <section>
                <label className="field">
                  <span>
                    اكتب رقم الاستعلام للتأكيد: <b className="mono">{item.reference}</b>
                  </span>
                  <input value={typed} dir="ltr" onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
                </label>
                <label className="field">
                  <span>كلمة مرورك</span>
                  <input
                    type="password"
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </label>
                <ErrorMessage message={error} />
                <button className="btn btn-block btn-danger" disabled={busy || !confirmed || !password}>
                  <Icon name="close" size={16} />
                  {busy ? "جارٍ الحذف…" : "حذف الاستعلام نهائيًا"}
                </button>
              </section>
            </form>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
