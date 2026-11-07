import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { api, apiBlob, ApiRequestError } from "../api";
import { Avatar, date, ErrorMessage, Icon, Status } from "./ui";

interface RequestDetail {
  user: {
    user_id: string;
    full_name: string;
    phone: string;
    email: string | null;
    employee_number: string | null;
    employee_id: string | null;
    national_id_last4: string;
    account_type: string;
    status: string;
    created_at: string;
  };
  employee_record: {
    employee_number: string;
    full_name: string;
    phone: string;
    department: string | null;
    position: string | null;
  } | null;
  national_id_images: { front: boolean; back: boolean };
  profile_image: boolean;
}

/** HR imports keep local numbers; accounts store the international form. */
const samePhone = (a: string, b: string) =>
  a.replace(/\D/g, "").slice(-10) === b.replace(/\D/g, "").slice(-10);

/** Loads a protected image with the admin's token into a private object URL. */
export function SecureImage({
  path,
  alt,
  fallback,
  onOpen,
}: {
  path: string;
  alt: string;
  fallback: ReactNode;
  onOpen?: (source: string) => void;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let url = "";
    apiBlob(path, controller.signal)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setSource(url);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  if (failed) return <>{fallback}</>;
  if (!source) return <span className="image-skeleton" />;
  const image = <img src={source} alt={alt} />;
  return onOpen ? (
    <button
      type="button"
      className="image-open"
      aria-label="تكبير الصورة"
      onClick={() => onOpen(source)}
    >
      {image}
    </button>
  ) : (
    image
  );
}

export function ReviewDrawer({
  userId,
  onClose,
  onDecided,
}: {
  userId: string;
  onClose: () => void;
  onDecided: (message: string) => void;
}) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [zoomed, setZoomed] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    api<RequestDetail>(`/admin/users/${userId}`)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch(() => {
        if (active) setError("تعذّر تحميل تفاصيل الطلب.");
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    panel.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setZoomed((current) => {
        if (!current) onClose();
        return null;
      });
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  async function decide(type: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      await api(`/admin/users/${userId}/${type}`, {
        method: "POST",
        body: JSON.stringify(type === "reject" ? { reason: reason.trim() } : {}),
      });
      window.dispatchEvent(new Event("gp-requests-changed"));
      onDecided(
        type === "approve"
          ? "تم تفعيل الحساب ويمكن للموظف تسجيل الدخول الآن."
          : "تم رفض الطلب.",
      );
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر تنفيذ القرار.");
      setBusy(false);
    }
  }

  const user = detail?.user;
  const record = detail?.employee_record;
  const pending = user?.status.includes("pending");
  return createPortal(
    <div className="drawer-root" dir={document.documentElement.dir}>
      <button className="drawer-scrim" aria-label="إغلاق" onClick={onClose} />
      <aside
        className="review-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="مراجعة الطلب"
        tabIndex={-1}
        ref={panel}
      >
        <header className="drawer-head">
          <div>
            <span className="eyebrow">مراجعة الطلب</span>
            <h2>{user?.full_name ?? "…"}</h2>
          </div>
          <button className="icon-button" aria-label="إغلاق" onClick={onClose}>
            <Icon name="close" size={17} />
          </button>
        </header>
        <div className="drawer-body">
          <ErrorMessage message={error} />
          {user && detail && (
            <>
              <section className="applicant-hero">
                <div className="applicant-photo">
                  <SecureImage
                    path={`/admin/users/${userId}/photo`}
                    alt="الصورة الشخصية"
                    fallback={<Avatar name={user.full_name} />}
                    onOpen={setZoomed}
                  />
                </div>
                <div>
                  <Status status={user.status} />
                  <p className="mono applicant-number">{user.employee_number ?? "—"}</p>
                  <small>
                    {user.account_type === "existing_employee" ? "موظف حالي" : "متقدم جديد"}
                    {" · "}
                    {date(user.created_at)}
                  </small>
                </div>
              </section>

              <section>
                <h3>صور الهوية</h3>
                <div className="id-gallery">
                  {(["front", "back"] as const).map((side) => (
                    <figure key={side}>
                      <div className="id-frame">
                        <SecureImage
                          path={`/admin/users/${userId}/national-id/${side}`}
                          alt={side === "front" ? "البطاقة — الوجه الأمامي" : "البطاقة — الوجه الخلفي"}
                          fallback={<span className="hint">غير متوفرة</span>}
                          onOpen={setZoomed}
                        />
                      </div>
                      <figcaption>
                        {side === "front" ? "البطاقة — الوجه الأمامي" : "البطاقة — الوجه الخلفي"}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>

              <section>
                <h3>بيانات الطلب</h3>
                <dl className="review-facts">
                  <Fact label="الاسم" value={user.full_name} matched={record?.full_name === user.full_name} />
                  <Fact label="الهاتف" value={user.phone} ltr matched={!!record && samePhone(record.phone, user.phone)} />
                  <Fact label="البريد الإلكتروني" value={user.email} ltr />
                  <Fact label="آخر 4 أرقام من الرقم القومي" value={user.national_id_last4} ltr />
                  {record && <Fact label="القسم" value={record.department} />}
                  {record && <Fact label="الوظيفة" value={record.position} />}
                </dl>
                {!record && (
                  <p className="hint">
                    لا يوجد سجل وظيفي لهذا المتقدم. سيُنشأ له رقم موظف جديد عند التفعيل.
                  </p>
                )}
              </section>
            </>
          )}
          {!detail && !error && <span className="image-skeleton drawer-skeleton" />}
        </div>
        {pending && (
          <footer className="drawer-foot">
            {rejecting ? (
              <>
                <label className="field">
                  <span>سبب الرفض</span>
                  <textarea
                    rows={2}
                    maxLength={500}
                    placeholder="اكتب سبباً واضحاً يظهر في سجل النشاط."
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    autoFocus
                  />
                </label>
                <div className="drawer-actions">
                  <button
                    className="btn btn-danger"
                    disabled={busy || !reason.trim()}
                    onClick={() => void decide("reject")}
                  >
                    تأكيد الرفض
                  </button>
                  <button className="btn ghost" onClick={() => setRejecting(false)}>
                    تراجع
                  </button>
                </div>
              </>
            ) : (
              <div className="drawer-actions">
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void decide("approve")}
                >
                  <Icon name="check" size={17} />
                  {busy ? "جارٍ التفعيل…" : "تفعيل الحساب"}
                </button>
                <button className="btn ghost btn-danger" onClick={() => setRejecting(true)}>
                  رفض الطلب
                </button>
              </div>
            )}
          </footer>
        )}
      </aside>
      {zoomed && (
        <button className="image-zoom" aria-label="إغلاق" onClick={() => setZoomed(null)}>
          <img src={zoomed} alt="" />
        </button>
      )}
    </div>,
    document.body,
  );
}

function Fact({
  label,
  value,
  ltr = false,
  matched = false,
}: {
  label: string;
  value: string | null | undefined;
  ltr?: boolean;
  matched?: boolean;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd dir={ltr ? "ltr" : undefined}>
        {value || "—"}
        {matched && (
          <em title="متطابق مع السجل">
            <Icon name="check" size={13} />
            <span className="sr-only">متطابق مع السجل</span>
          </em>
        )}
      </dd>
    </div>
  );
}
