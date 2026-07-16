/** Enthält der Inhalt ein Bild (Markdown-Syntax)? */
export function hasImage(md: string): boolean {
  return /!\[[^\]]*\]\([^)]*\)/.test(md);
}

const CLOZE_RE = /\{\{c\d+::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

/** Eine einzelne Lücke: erwartete Antwort plus optionaler Hinweis. */
export interface ClozeBlank {
  answer: string;
  hint?: string;
}

/** Erkennt den Platzhalter-Token einer Lücke im gerenderten Markdown (`⟦cloze:N⟧`). */
const CLOZE_TOKEN_RE = /^⟦cloze:(\d+)⟧$/;

/**
 * Ersetzt jede Anki-Cloze-Lücke `{{cN::Antwort::Hinweis}}` durch einen Inline-Code-
 * Platzhalter (`` `⟦cloze:N⟧` ``), der sich beim Rendern durch ein Eingabefeld
 * ersetzen lässt, ohne den umgebenden Markdown-Textfluss aufzubrechen.
 */
export function clozeBlanks(text: string): { md: string; blanks: ClozeBlank[] } {
  const blanks: ClozeBlank[] = [];
  const md = text.replace(CLOZE_RE, (_all, answer: string, hint?: string) => {
    const token = `⟦cloze:${blanks.length}⟧`;
    blanks.push({ answer: answer.trim(), hint: hint?.trim() || undefined });
    return `\`${token}\``;
  });
  return { md, blanks };
}

/** Liest den Lücken-Index aus einem Platzhalter-Token, falls der Text einer ist. */
export function clozeTokenIndex(text: string): number | null {
  const m = CLOZE_TOKEN_RE.exec(text.trim());
  return m ? Number(m[1]) : null;
}

/** Breite (in Zeichen) für das Eingabefeld einer Lücke, sodass Hinweis wie Antwort komplett hineinpassen. */
export function clozeBlankWidth(blank: ClozeBlank): number {
  return Math.max(blank.hint?.length ?? 0, blank.answer.length, 8);
}

/** Plain-Text einer Cloze-Karte (Lücken durch ihre Antwort ersetzt) für Auszüge. */
export function clozeToPlain(text: string): string {
  return text.replace(CLOZE_RE, (_all, answer: string) => answer.trim());
}

/** Normalisiert eine getippte Antwort für den (toleranten) Textvergleich. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?¡¿"'`]+$/g, "");
}

/**
 * Einzeiliger Klartext-Auszug für Listenansichten: entfernt Markdown-Syntax,
 * damit dort keine rohen Sonderzeichen oder riesige data-URIs auftauchen.
 */
export function plainExcerpt(md: string, maxLength = 120): string {
  let text = md;

  text = text.replace(/```[\s\S]*?```/g, " "); // Code-Blöcke
  text = text.replace(/`([^`]*)`/g, "$1"); // Inline-Code
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, "$1"); // LaTeX (abgesetzt)
  text = text.replace(/\$([^$\n]+?)\$/g, "$1"); // LaTeX (inline)
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, " "); // Bilder (inkl. data-URI)
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // Links -> Linktext
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, ""); // Überschriften
  text = text.replace(/^\s{0,3}>\s?/gm, ""); // Zitate
  text = text.replace(/^\s*([-*+]|\d+\.)\s+/gm, ""); // Listenpunkte
  text = text.replace(/^\s*[-*_]{3,}\s*$/gm, " "); // Trennlinien
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2"); // fett
  text = text.replace(/(\*|_)(.*?)\1/g, "$2"); // kursiv
  text = text.replace(/~~(.*?)~~/g, "$1"); // durchgestrichen
  text = text.replace(/\|/g, " "); // Tabellen-Trenner

  text = text.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/**
 * Mehrzeilig oder mit Blockelementen? Dann wird die Lernkarte linksbündig
 * und in normaler Schriftgröße statt groß und zentriert dargestellt.
 */
export function isRichContent(md: string): boolean {
  if (md.includes("\n")) return true;
  return /(!\[|^#{1,6}\s|^[-*+]\s|^\d+\.\s|```|\|)/m.test(md);
}
