import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { api, ApiRequestError } from "../api";
import { date, ErrorMessage, Icon, number } from "../components/ui";

interface Thread {
  complaint_id: string;
  reference: string;
  category: string;
  subject: string;
  body: string;
  status: "open" | "in_review" | "resolved";
  unread: boolean;
  created_at: string;
}
interface Message {
  message_id: string;
  body: string;
  from_office: boolean;
  author: string;
  created_at: string;
}

const STATUS: Record<string, string> = { open: "بانتظار الرد", in_review: "قيد المتابعة", resolved: "مغلقة" };
const errorText = (error: unknown, fallback: string) => (error instanceof ApiRequestError ? error.message : fallback);

function Conversation({ thread, onClose, onChanged }: { thread: Thread; onClose: () => void; onChanged: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Opening the conversation marks head office replies as read.
    api<{ messages: Message[] }>(`/complaints/${thread.complaint_id}`)
      .then((data) => {
        setMessages(data.messages);
        onChanged();
      })
      .catch(() => setError("تعذّر تحميل المحادثة."));
  }, [thread.complaint_id]);

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ messages: Message[] }>(`/complaints/${thread.complaint_id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: reply }),
      });
      setMessages(data.messages);
      setReply("");
      onChanged();
    } catch (err) {
      setError(errorText(err, "تعذّر إرسال الرسالة."));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="drawer-root" dir={document.documentElement.dir}>
      <button className="drawer-scrim" aria-label="إغلاق" onClick={onClose} />
      <aside className="review-drawer" role="dialog" aria-modal="true" aria-label="المحادثة مع الإدارة العليا">
        <header className="drawer-head">
          <div>
            <span className="eyebrow mono">
              {thread.reference} · {STATUS[thread.status]}
            </span>
            <h2>{thread.subject}</h2>
          </div>
          <button className="icon-button" aria-label="إغلاق" onClick={onClose}>
            <Icon name="close" size={17} />
          </button>
        </header>
        <div className="drawer-body">
          <ErrorMessage message={error} />
          <div className="thread">
            <div className="bubble from-staff">
              <p>{thread.body}</p>
              <small>أنت · {date(thread.created_at)}</small>
            </div>
            {messages.map((item) => (
              <div key={item.message_id} className={`bubble ${item.from_office ? "from-office" : "from-staff"}`}>
                <p>{item.body}</p>
                <small>
                  {item.from_office ? "الإدارة العليا" : "أنت"} · {date(item.created_at)}
                </small>
              </div>
            ))}
            {!messages.some((item) => item.from_office) && <p className="hint">وصلت رسالتك إلى الإدارة العليا، وسيظهر الرد هنا.</p>}
          </div>
        </div>
        <footer className="drawer-foot">
          <label className="field">
            <span>{thread.status === "resolved" ? "أعد فتح المحادثة برسالة جديدة" : "ردّك"}</span>
            <textarea rows={3} value={reply} onChange={(event) => setReply(event.target.value)} />
          </label>
          <div className="drawer-actions">
            <button className="btn btn-primary" disabled={busy || !reply.trim()} onClick={() => void send()}>
              <Icon name="mail" size={16} />
              إرسال
            </button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

/** Administrators write to head office here and read its replies. */
export function MessagesPage() {
  const [params, setParams] = useSearchParams();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({ category: "", subject: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<{ complaints: Thread[]; categories: string[] }>("/complaints/mine?kind=message")
      .then((data) => {
        setThreads(data.complaints);
        setTopics(data.categories);
      })
      .catch(() => setError("تعذّر تحميل الرسائل."));
  }, []);
  useEffect(load, [load]);
  const open = threads?.find((item) => item.complaint_id === params.get("open"));
  const unread = threads?.filter((item) => item.unread).length ?? 0;

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/complaints", { method: "POST", body: JSON.stringify({ kind: "message", ...draft }) });
      setDraft({ category: "", subject: "", body: "" });
      setComposing(false);
      load();
    } catch (err) {
      setError(errorText(err, "تعذّر إرسال الرسالة."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-enter points-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">حسابي / رسائل الإدارة العليا</p>
          <h1>
            تواصل مع الإدارة العليا. <span>مباشرة.</span>
          </h1>
          <p className="page-description">طلبات واقتراحات ومتابعات تصل إلى الإدارة العليا وحدها، وردّها يظهر هنا وفي الإشعارات.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setComposing(!composing)}>
          <Icon name={composing ? "close" : "plus"} size={16} />
          {composing ? "إلغاء" : "رسالة جديدة"}
        </button>
      </div>
      <ErrorMessage message={error} />
      {composing && (
        <section className="glass panel">
          <div className="panel-heading">
            <h2>رسالة جديدة</h2>
          </div>
          <form className="expense-form" onSubmit={(event) => void send(event)}>
            <div className="field">
              <span>الموضوع</span>
              <div className="day-chips">
                {topics.map((topic) => (
                  <label key={topic} className={draft.category === topic ? "on" : ""}>
                    <input type="radio" name="topic" checked={draft.category === topic} onChange={() => setDraft({ ...draft, category: topic })} />
                    {topic}
                  </label>
                ))}
              </div>
            </div>
            <label className="field">
              <span>العنوان</span>
              <input required maxLength={120} placeholder="مثال: نحتاج مستعلمًا إضافيًا في الجيزة" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} />
            </label>
            <label className="field">
              <span>الرسالة</span>
              <textarea required rows={5} minLength={10} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
            </label>
            <button className="btn btn-primary" disabled={busy || !draft.category || !draft.subject.trim() || draft.body.trim().length < 10}>
              <Icon name="mail" size={16} />
              إرسال إلى الإدارة العليا
            </button>
          </form>
        </section>
      )}
      <section className="glass panel">
        <div className="panel-heading">
          <h2>محادثاتك</h2>
          {!!unread && <span className="nav-badge">{number(unread)}</span>}
        </div>
        <ul className="complaint-list">
          {threads?.map((item) => (
            <li key={item.complaint_id} className={`status-${item.status}`}>
              <button onClick={() => setParams({ open: item.complaint_id })}>
                <span className="notify-icon">
                  <Icon name="message" size={18} />
                </span>
                <div>
                  <strong>
                    {item.subject}
                    {item.unread && <i className="unread-dot" />}
                  </strong>
                  <small>
                    {item.category} · {date(item.created_at)}
                  </small>
                  <p>{item.body}</p>
                </div>
                <span className="complaint-meta">
                  <span className={`badge complaint-${item.status}`}>{STATUS[item.status]}</span>
                  <small className="mono">{item.reference}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {threads && !threads.length && <p className="hint empty">لم ترسل أي رسالة بعد. اكتب للإدارة العليا متى احتجت.</p>}
      </section>
      {open && (
        <Conversation
          thread={open}
          onClose={() => setParams({})}
          onChanged={() => {
            load();
            window.dispatchEvent(new Event("gp-messages-changed"));
          }}
        />
      )}
    </div>
  );
}
