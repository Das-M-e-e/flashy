import { useRef, useState } from "react";
import { useLocale } from "../i18n";
import { imageFromClipboard, insertAtCursor, insertAudio, insertImage, MediaTooLargeError } from "../lib/image";
import Markdown from "./Markdown";

interface Props {
  label: string;
  value: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}

/** Textfeld mit Umschalter "Bearbeiten | Vorschau" und Bild-/Audio-Einbindung. */
export default function MarkdownField({ label, value, autoFocus, onChange, onError }: Props) {
  const { t } = useLocale();
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  async function embed(makeRef: () => Promise<string>) {
    setBusy(true);
    try {
      const ref = await makeRef();
      const snippet = `![](${ref})`;
      const textarea = textareaRef.current;
      onChange(textarea ? insertAtCursor(textarea, snippet) : value + snippet);
    } catch (err) {
      if (err instanceof MediaTooLargeError) onError(t("card.imageTooLarge"));
      else onError(err instanceof Error ? err.message : t("card.imageFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const file = imageFromClipboard(e);
    if (!file) return;
    e.preventDefault();
    await embed(() => insertImage(file));
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await embed(() => insertImage(file));
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleAudioFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await embed(() => insertAudio(file));
    if (audioInputRef.current) audioInputRef.current.value = "";
  }

  return (
    <div className="md-field">
      <div className="md-field-head">
        <span className="md-field-label">{label}</span>
        <div className="md-tabs">
          <button type="button" className={preview ? "" : "active"} onClick={() => setPreview(false)}>
            {t("card.tabEdit")}
          </button>
          <button type="button" className={preview ? "active" : ""} onClick={() => setPreview(true)}>
            {t("card.tabPreview")}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="md-preview">
          {value.trim() ? <Markdown>{value}</Markdown> : <span className="mastery-caption">{t("card.previewEmpty")}</span>}
        </div>
      ) : (
        <>
          <textarea
            ref={textareaRef}
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
          />
          <div className="md-field-actions">
            <button type="button" onClick={() => imageInputRef.current?.click()} disabled={busy}>
              {busy ? t("card.imageWorking") : t("card.insertImage")}
            </button>
            <button type="button" onClick={() => audioInputRef.current?.click()} disabled={busy}>
              {t("card.insertAudio")}
            </button>
            <span className="md-field-hint">{t("card.markdownHint")}</span>
            <input
              type="file"
              accept="image/*"
              ref={imageInputRef}
              style={{ display: "none" }}
              onChange={handleImageFile}
            />
            <input
              type="file"
              accept="audio/*"
              ref={audioInputRef}
              style={{ display: "none" }}
              onChange={handleAudioFile}
            />
          </div>
        </>
      )}
    </div>
  );
}
