import { useEffect, useState } from "react";
import { apiBlob } from "../api";
import { Icon, number } from "./ui";
import "../intake.css";

// ───────────── one attachment, fetched with the admin's token ─────────────

/** Types safe to show in this origin. Anything else from an email is only downloaded, never opened. */
const VIEWABLE = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "application/pdf"];

export function Attachment({ messageId, file }: { messageId: string; file: { index: number; name: string; type: string; bytes: number } }) {
  const [url, setUrl] = useState<string | null>(null);
  const type = file.type.toLowerCase();
  const viewable = VIEWABLE.includes(type);
  const image = viewable && type.startsWith("image/");
  useEffect(() => {
    if (!image) return;
    let revoked: string | null = null;
    apiBlob(`/investigations/intake/messages/${messageId}/files/${file.index}`)
      .then((blob) => {
        revoked = URL.createObjectURL(new Blob([blob], { type }));
        setUrl(revoked);
      })
      .catch(() => setUrl(null));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [messageId, file.index, image, type]);
  async function open() {
    const blob = await apiBlob(`/investigations/intake/messages/${messageId}/files/${file.index}`);
    const url = URL.createObjectURL(new Blob([blob], { type: viewable ? type : "application/octet-stream" }));
    if (viewable) window.open(url, "_blank", "noopener");
    else {
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  if (image && file.bytes < 15_000) return null;
  return image ? (
    <button type="button" className="mail-attachment image" onClick={() => void open()} title={file.name}>
      {url ? <img src={url} alt={file.name} /> : <span className="image-skeleton" />}
    </button>
  ) : (
    <button type="button" className="mail-attachment" onClick={() => void open()}>
      <Icon name="file" size={18} />
      <span dir="auto">{file.name}</span>
      <small>{number(Math.max(1, Math.round(file.bytes / 1024)))} KB</small>
    </button>
  );
}
