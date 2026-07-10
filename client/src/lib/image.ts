/** Maximale Kantenlänge nach dem Herunterrechnen. */
const MAX_EDGE = 1600;

/** Grenze für die fertige data-URI. Darüber wächst die Sync-Datei zu stark. */
export const MAX_DATA_URL_BYTES = 1024 * 1024;

export class ImageTooLargeError extends Error {
  constructor(public bytes: number) {
    super("Bild ist zu groß");
    this.name = "ImageTooLargeError";
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
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

/**
 * Rechnet ein Bild auf eine vernünftige Größe herunter und liefert es als
 * data-URI. PNG bleibt PNG (Transparenz), alles andere wird JPEG.
 */
export async function fileToDataUrl(file: File): Promise<string> {
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
  let dataUrl = keepsAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85);

  // PNG-Fotos werden schnell riesig -- dann doch als JPEG versuchen.
  if (dataUrl.length > MAX_DATA_URL_BYTES && keepsAlpha) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  }
  if (dataUrl.length > MAX_DATA_URL_BYTES) {
    throw new ImageTooLargeError(dataUrl.length);
  }
  return dataUrl;
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
