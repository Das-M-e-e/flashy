import { useMemo, useRef, useState } from "react";
import type { Components } from "react-markdown";
import { useLocale } from "../i18n";
import { imageFromClipboard, insertAtCursor, insertAudio, insertImage, MediaTooLargeError } from "../lib/image";
import { clozeBlankWidth, clozeBlanks, clozeTokenIndex, type ClozeBlank } from "../lib/markdown";
import Markdown from "./Markdown";

interface Props {
  label: string;
  value: string;
  autoFocus?: boolean;
  /** Zeigt zusätzlich einen "Lücke einfügen"-Button (für Cloze-Karten). */
  enableCloze?: boolean;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}

/** Nächste freie Cloze-Nummer im Text (c1, c2, …). */
function nextClozeIndex(text: string): number {
  let max = 0;
  for (const m of text.matchAll(/\{\{c(\d+)::/g)) max = Math.max(max, Number(m[1]));
  return max + 1;
}

/** Textfeld mit Umschalter "Bearbeiten | Vorschau" und Bild-/Audio-Einbindung. */
export default function MarkdownField({ label, value, autoFocus, enableCloze, onChange, onError }: Props) {
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

  // Lücken werden in der Vorschau als deaktivierte Eingabefelder dargestellt: sichtbar, aber nicht ausfüllbar.
  const { md: clozePreviewMd, blanks } = useMemo<{ md: string; blanks: ClozeBlank[] }>(
    () => (enableCloze ? clozeBlanks(value) : { md: value, blanks: [] }),
    [value, enableCloze]
  );
  const clozeComponents = useMemo<Components>(
    () => ({
      code: ({ node: _node, className, children, ...props }) => {
        const i = clozeTokenIndex(String(children));
        const blank = i !== null ? blanks[i] : undefined;
        if (!blank) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }
        return (
          <span className="cloze-blank cloze-blank-static">
            <input type="text" size={clozeBlankWidth(blank)} placeholder={blank.hint ?? ""} disabled />
          </span>
        );
      },
    }),
    [blanks]
  );

  function insertCloze() {
    const textarea = textareaRef.current;
    const n = nextClozeIndex(value);
    if (!textarea) {
      onChange(`${value}{{c${n}::}}`);
      return;
    }
    const { selectionStart, selectionEnd } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const snippet = `{{c${n}::${selected}}}`;
    onChange(value.slice(0, selectionStart) + snippet + value.slice(selectionEnd));
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
          {value.trim() ? (
            <Markdown components={enableCloze ? clozeComponents : undefined}>
              {enableCloze ? clozePreviewMd : value}
            </Markdown>
          ) : (
            <span className="mastery-caption">{t("card.previewEmpty")}</span>
          )}
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
            {enableCloze && (
              <button type="button" onClick={insertCloze}>
                {t("card.insertCloze")}
              </button>
            )}
            <button type="button" onClick={() => imageInputRef.current?.click()} disabled={busy}>
              {busy ? t("card.imageWorking") : t("card.insertImage")}
            </button>
            <button type="button" onClick={() => audioInputRef.current?.click()} disabled={busy}>
              {t("card.insertAudio")}
            </button>
            <span className="md-field-hint">{enableCloze ? t("card.clozeHint") : t("card.markdownHint")}</span>
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
