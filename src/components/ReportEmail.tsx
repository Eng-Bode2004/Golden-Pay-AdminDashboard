import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../api";
import { ErrorMessage, Icon } from "./ui";

interface Draft {
  inbox: string | null;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  in_reply_to: string | null;
  attachments: { kind: "pdf" | "docx"; name: string }[];
}

interface DraftResponse {
  draft: Draft;
  inboxes: string[];
  contacts: { address: string; name: string | null; seen_count: number }[];
  sent: { sent_id: string; to_addresses: string[]; cc_addresses: string[]; subject: string; status: string; error: string | null; sent_at: string }[];
  report_ready: boolean;
  approved: boolean;
}

const INBOX_LABELS: Record<string, string> = { retail: "Retail", info: "Info", sme: "SME" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The approved report back to the client: the administrator writes the email, picks which of
 * the client's addresses receive it (learned from the emails the client sends), attaches the
 * filled report and sends it from the company inbox the request came to.
 */
export function ReportEmail({ investigationId }: { investigationId: string }) {
  const [data, setData] = useState<DraftResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState("");
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<string[]>(["pdf"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function load() {
    try {
      const next = await api<DraftResponse>(`/investigations/${investigationId}/email-draft`);
      setData(next);
      setInbox(next.draft.inbox ?? next.inboxes[0] ?? "");
      setTo(next.draft.to);
      setCc(next.draft.cc);
      setSubject(next.draft.subject);
      setBody(next.draft.body);
    } catch {
      setError("تعذّر تحميل بيانات البريد.");
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investigationId]);

  if (!data) return error ? <ErrorMessage message={error} /> : null;

  const addresses = [...new Set([...data.draft.to, ...data.draft.cc, ...data.contacts.map((c) => c.address), ...to, ...cc])];
  const role = (address: string) => (to.includes(address) ? "to" : cc.includes(address) ? "cc" : "");
  const setRole = (address: string, next: "" | "to" | "cc") => {
    setTo((list) => (next === "to" ? [...new Set([...list, address])] : list.filter((a) => a !== address)));
    setCc((list) => (next === "cc" ? [...new Set([...list, address])] : list.filter((a) => a !== address)));
  };
  const addExtra = () => {
    const address = extra.trim().toLowerCase();
    if (!EMAIL.test(address)) return setError("اكتب عنوان بريد صحيح.");
    setError("");
    setRole(address, to.length ? "cc" : "to");
    setExtra("");
  };

  async function send() {
    setBusy(true);
    setError("");
    setDone("");
    try {
      const result = await api<{ saved_to_sent?: boolean }>(`/investigations/${investigationId}/email`, {
        method: "POST",
        body: JSON.stringify({
          inbox,
          to,
          cc,
          subject,
          body,
          attachments: files,
          in_reply_to: data?.draft.in_reply_to,
          file_name: data?.draft.subject.replace(/^RE:\s*/i, "").slice(0, 120),
        }),
      });
      setDone(
        `أُرسل إلى ${to.length + cc.length} عنوان.${result.saved_to_sent ? " وحُفظت نسخة في المرسل." : " لم تُحفظ نسخة في مجلد المرسل."}`,
      );
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "تعذّر الإرسال.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="report-email">
      <div className="report-email-head">
        <Icon name="mail" size={22} />
        <div>
          <strong>إرسال التقرير للعميل</strong>
          <small>
            {data.sent.length
              ? `أُرسل ${data.sent.filter((s) => s.status === "sent").length} مرة — آخرها ${new Date(data.sent[0]!.sent_at).toLocaleString("ar-EG")}`
              : data.inboxes.length
                ? "اكتب الرسالة واختر من يستلمها، ويُرفق التقرير تلقائيًا."
                : "لا يوجد بريد شركة مضبوط على الخادم."}
          </small>
        </div>
        {!open && data.inboxes.length > 0 && (
          <button className="btn small btn-primary" disabled={!data.report_ready} onClick={() => setOpen(true)}>
            كتابة البريد
          </button>
        )}
      </div>
      {done && <p className="hint ok-text">{done}</p>}
      {open && (
        <div className="report-email-form">
          <div className="form-row">
            <label className="field">
              <span>يُرسل من</span>
              <select value={inbox} onChange={(event) => setInbox(event.target.value)}>
                {data.inboxes.map((name) => (
                  <option key={name} value={name}>
                    {INBOX_LABELS[name] ?? name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>الموضوع</span>
              <input value={subject} maxLength={300} onChange={(event) => setSubject(event.target.value)} />
            </label>
          </div>
          <div className="field">
            <span>المستلمون (عناوين هذه الجهة)</span>
            <div className="recipient-list">
              {addresses.map((address) => (
                <div key={address} className={`recipient ${role(address)}`}>
                  <span dir="ltr">{address}</span>
                  <div className="segmented">
                    {(["to", "cc", ""] as const).map((value) => (
                      <button key={value || "none"} type="button" className={role(address) === value ? "active" : ""} onClick={() => setRole(address, value)}>
                        {value === "to" ? "إلى" : value === "cc" ? "نسخة" : "لا"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!addresses.length && <p className="hint">لم يُعرف بعد أي عنوان لهذه الجهة. أضف عنوانًا.</p>}
            </div>
            <div className="inline-add">
              <input dir="ltr" placeholder="name@bank.com" value={extra} onChange={(event) => setExtra(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addExtra()} />
              <button type="button" className="btn small" onClick={addExtra}>
                إضافة
              </button>
            </div>
          </div>
          <label className="field">
            <span>نص الرسالة</span>
            <textarea rows={7} value={body} onChange={(event) => setBody(event.target.value)} />
          </label>
          <div className="field">
            <span>المرفقات</span>
            <div className="attach-choices">
              {data.draft.attachments.map((file) => (
                <label key={file.kind} className="check">
                  <input
                    type="checkbox"
                    checked={files.includes(file.kind)}
                    onChange={(event) =>
                      setFiles((list) => (event.target.checked ? [...list, file.kind] : list.filter((k) => k !== file.kind)))
                    }
                  />
                  <Icon name="file" size={15} />
                  <span dir="auto">{file.name}</span>
                </label>
              ))}
            </div>
          </div>
          <ErrorMessage message={error} />
          <div className="drawer-actions">
            <button
              className="btn btn-primary"
              disabled={busy || !to.length || !subject.trim() || !body.trim() || !files.length}
              onClick={() => void send()}
            >
              <Icon name="mail" size={16} />
              {busy ? "جارٍ الإرسال…" : `إرسال إلى ${to.length + cc.length}`}
            </button>
            <button className="btn ghost" onClick={() => setOpen(false)}>
              إلغاء
            </button>
          </div>
        </div>
      )}
      {data.sent.length > 0 && (
        <ul className="sent-list">
          {data.sent.map((item) => (
            <li key={item.sent_id} className={item.status}>
              <Icon name={item.status === "sent" ? "check" : "close"} size={14} />
              <span dir="ltr">{[...item.to_addresses, ...item.cc_addresses].join(", ")}</span>
              <small>{new Date(item.sent_at).toLocaleString("ar-EG")}</small>
              {item.error && <small className="hint">{item.error}</small>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
