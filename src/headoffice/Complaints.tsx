import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiRequestError } from "../api";
import { Avatar, date, ErrorMessage, Icon, number } from "../components/ui";

interface Complaint {
  complaint_id: string;
  reference: string;
  user_id: string;
  full_name: string;
  employee_number: string | null;
  category: string;
  subject: string;
  body: string;
  status: "open" | "in_review" | "resolved";
  kind?: string;
  replies: number;
  created_at: string;
  updated_at: string;
}
interface Message {
  message_id: string;
  body: string;
  from_office: boolean;
  author: string;
  created_at: string;
}

export const COMPLAINT_STATUS: Record<string, string> = { open: "جديدة", in_review: "قيد المراجعة", resolved: "مغلقة" };

function Thread({ complaint, onClose, onChanged }: { complaint: Complaint; onClose: () => void; onChanged: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ messages: Message[] }>(`/complaints/${complaint.complaint_id}`)
      .then((data) => setMessages(data.messages))
      .catch(() => setError("تعذّر تحميل المحادثة."));
  }, [complaint.complaint_id]);

  const send = async (status?: string) => {
    setBusy(true);
    setError("");
    try {
      if (reply.trim()) {
        const data = await api<{ messages: Message[] }>(`/complaints/${complaint.complaint_id}/messages`, {
          method: "POST",
          body: JSON.stringify({ body: reply, ...(status ? { status } : {}) }),
        });
        setMessages(data.messages);
        setReply("");
      } else if (status) {
        await api(`/headoffice/complaints/${complaint.complaint_id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      }
      onChanged();
      if (status === "resolved") onClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر إرسال الرد.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="drawer-root" dir={document.documentElement.dir}>
      <button className="drawer-scrim" aria-label="إغلاق" onClick={onClose} />
      <aside className="review-drawer" role="dialog" aria-modal="true" aria-label="تفاصيل المحادثة">
        <header className="drawer-head">
          <div>
            <span className="eyebrow mono">
              {complaint.reference} · {COMPLAINT_STATUS[complaint.status]}
            </span>
            <h2>{complaint.subject}</h2>
          </div>
          <button className="icon-button" aria-label="إغلاق" onClick={onClose}>
            <Icon name="close" size={17} />
          </button>
        </header>
        <div className="drawer-body">
          <ErrorMessage message={error} />
          <Link to={`/staff/${complaint.user_id}`} className="person-cell">
            <Avatar name={complaint.full_name} small />
            <div>
              <strong>{complaint.full_name}</strong>
              <small>
                {complaint.employee_number ?? "—"} · {complaint.category}
              </small>
            </div>
          </Link>
          <div className="thread">
            <div className="bubble from-staff">
              <p>{complaint.body}</p>
              <small>{date(complaint.created_at)}</small>
            </div>
            {messages.map((item) => (
              <div key={item.message_id} className={`bubble ${item.from_office ? "from-office" : "from-staff"}`}>
                <p>{item.body}</p>
                <small>
                  {item.from_office ? "الإدارة العليا" : item.author} · {date(item.created_at)}
                </small>
              </div>
            ))}
          </div>
        </div>
        <footer className="drawer-foot">
          <label className="field">
            <span>ردّك على الموظف</span>
            <textarea rows={3} value={reply} onChange={(event) => setReply(event.target.value)} />
          </label>
          <div className="drawer-actions">
            <button className="btn btn-primary" disabled={busy || !reply.trim()} onClick={() => void send()}>
              <Icon name="mail" size={16} />
              إرسال الرد
            </button>
            {complaint.status !== "resolved" ? (
              <button className="btn ghost" disabled={busy} onClick={() => void send("resolved")}>
                <Icon name="check" size={16} />
                {reply.trim() ? "إرسال وإغلاق" : complaint.kind === "message" ? "إغلاق المحادثة" : "إغلاق الشكوى"}
              </button>
            ) : (
              <button className="btn ghost" disabled={busy} onClick={() => void send("in_review")}>
                إعادة فتح
              </button>
            )}
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

export function ComplaintsPage() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState("");
  const kind = params.get("kind") === "message" ? "message" : "complaint";
  const [open_, setOpen] = useState<{ complaints: number; messages: number }>({ complaints: 0, messages: 0 });
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [error, setError] = useState("");
  const openId = params.get("open");

  const load = useCallback(() => {
    api<{ complaints: Complaint[]; open: { complaints: number; messages: number } }>(
      `/headoffice/complaints?kind=${kind}${status ? `&status=${status}` : ""}`,
    )
      .then((data) => {
        setComplaints(data.complaints);
        setOpen(data.open);
      })
      .catch(() => setError("تعذّر تحميل الشكاوى."));
  }, [status, kind]);
  useEffect(load, [load]);
  const open = complaints.find((item) => item.complaint_id === openId);

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            الإدارة العليا <span>/</span> الشكاوى والرسائل
          </p>
          <h1>
            صوت الفريق. <span>مباشرة إليك.</span>
          </h1>
          <p className="page-description">
            {kind === "message"
              ? "رسائل المديرين من لوحة الإدارة: طلبات واقتراحات ومتابعات. ردّك يظهر للمدير في لوحته وإشعاراته."
              : "شكاوى المستعلمين من التطبيق تصل هنا مباشرة دون المرور بالمديرين. ردّك يظهر للموظف في التطبيق."}
          </p>
        </div>
      </div>
      <ErrorMessage message={error} />
      <div className="segmented kind-tabs">
        <button className={kind === "complaint" ? "active" : ""} onClick={() => setParams({})}>
          <Icon name="inbox" size={16} /> شكاوى المستعلمين {!!open_.complaints && <b className="nav-badge">{number(open_.complaints)}</b>}
        </button>
        <button className={kind === "message" ? "active" : ""} onClick={() => setParams({ kind: "message" })}>
          <Icon name="message" size={16} /> رسائل المديرين {!!open_.messages && <b className="nav-badge">{number(open_.messages)}</b>}
        </button>
      </div>
      <div className="segmented status-tabs">
        {[["", "الكل"], ["open", "جديدة"], ["in_review", "قيد المراجعة"], ["resolved", "مغلقة"]].map(([key, label]) => (
          <button key={key} className={status === key ? "active" : ""} onClick={() => setStatus(key!)}>
            {label}
          </button>
        ))}
      </div>
      <section className="glass panel">
        <ul className="complaint-list">
          {complaints.map((item, index) => (
            <li key={item.complaint_id} className={`status-${item.status}`}>
              <button onClick={() => setParams(kind === "message" ? { kind, open: item.complaint_id } : { open: item.complaint_id })}>
                <Avatar name={item.full_name} small color={index} />
                <div>
                  <strong>{item.subject}</strong>
                  <small>
                    {item.full_name} · {item.category} · {date(item.created_at)}
                  </small>
                  <p>{item.body}</p>
                </div>
                <span className="complaint-meta">
                  <span className={`badge complaint-${item.status}`}>{COMPLAINT_STATUS[item.status]}</span>
                  <small className="mono">{item.reference}</small>
                  {!!item.replies && <small>{number(item.replies)} رد</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!complaints.length && <p className="hint empty">{kind === "message" ? "لا توجد رسائل هنا." : "لا توجد شكاوى هنا."}</p>}
      </section>
      {open && (
        <Thread
          complaint={open}
          onClose={() => setParams(kind === "message" ? { kind } : {})}
          onChanged={() => {
            load();
            window.dispatchEvent(new Event("gp-complaints-changed"));
          }}
        />
      )}
    </div>
  );
}
