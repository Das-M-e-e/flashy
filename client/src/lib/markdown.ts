/** Enthält der Inhalt ein Bild (Markdown-Syntax)? */
export function hasImage(md: string): boolean {
  return /!\[[^\]]*\]\([^)]*\)/.test(md);
}

/**
 * Einzeiliger Klartext-Auszug für Listenansichten: entfernt Markdown-Syntax,
 * damit dort keine rohen Sonderzeichen oder riesige data-URIs auftauchen.
 */
export function plainExcerpt(md: string, maxLength = 120): string {
  let text = md;

  text = text.replace(/```[\s\S]*?```/g, " "); // Code-Blöcke
  text = text.replace(/`([^`]*)`/g, "$1"); // Inline-Code
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
