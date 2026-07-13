/** Maximale Kantenlänge, auf die Bilder vor dem Upload heruntergerechnet werden. */
const MAX_EDGE = 1600;

export class MediaTooLargeError extends Error {
  constructor() {
    super("Mediendatei ist zu groß");
    this.name = "MediaTooLargeError";
  }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bild konnte nicht gelesen werden"));
    };
    img.src = url;
  });
}

/** Rechnet ein Bild auf eine vernünftige Größe herunter und liefert einen Blob. */
async function downscaleImage(file: File): Promise<{ blob: Blob; ext: string }> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  ctx.drawImage(img, 0, 0, width, height);

  const keepsAlpha = file.type === "image/png" || file.type === "image/webp";
  const mime = keepsAlpha ? "image/png" : "image/jpeg";
  const ext = keepsAlpha ? "png" : "jpg";
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht kodiert werden"))), mime, 0.85)
  );
  return { blob, ext };
}

/** Lädt eine Datei/einen Blob als Medium hoch und liefert die Referenz `media/<hash>.<ext>`. */
async function uploadMedia(data: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", data, filename);
  const res = await fetch("/api/media", { method: "POST", body: form });
  if (res.status === 413) throw new MediaTooLargeError();
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Upload fehlgeschlagen (${res.status})`);
  }
  const body = (await res.json()) as { ref: string };
  return body.ref;
}

/** Bild herunterrechnen und hochladen -> Medien-Referenz. */
export async function insertImage(file: File): Promise<string> {
  const { blob, ext } = await downscaleImage(file);
  return uploadMedia(blob, `image.${ext}`);
}

/** Audiodatei unverändert hochladen -> Medien-Referenz. */
export async function insertAudio(file: File): Promise<string> {
  return uploadMedia(file, file.name || "audio");
}

/** Erste Bilddatei aus einem Zwischenablage-Ereignis, falls vorhanden. */
export function imageFromClipboard(event: React.ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

/** Fügt Text an der Cursorposition eines Textfelds ein. */
export function insertAtCursor(textarea: HTMLTextAreaElement, snippet: string): string {
  const { selectionStart, selectionEnd, value } = textarea;
  return value.slice(0, selectionStart) + snippet + value.slice(selectionEnd);
}
