export interface CsvCardRow {
  front: string;
  back: string;
  bidirectional: boolean;
}

/**
 * Bestimmt das Trennzeichen anhand der ersten Zeile außerhalb von Quotes.
 * Anki exportiert wahlweise Tab- oder Komma-getrennt.
 */
function detectDelimiter(content: string): "," | "\t" {
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (char === "\t") return "\t";
      if (char === ",") return ",";
      if (char === "\n") break;
    }
  }
  return ",";
}

/**
 * RFC4180-Tokenizer über den gesamten Text: Zeilenumbrüche innerhalb von
 * Anführungszeichen gehören zum Feld. Das ist nötig, weil Karteninhalte
 * mehrzeiliges Markdown sein können.
 */
function parseRecords(content: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;

  const endField = () => {
    record.push(fieldWasQuoted ? field : field.trim());
    field = "";
    fieldWasQuoted = false;
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
  };

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    // Anki-Konvention: '#' am Satzanfang leitet eine Kommentarzeile ein.
    // Gequotete Felder erreichen diesen Zweig nie, '# Überschrift' bleibt also erhalten.
    const atRecordStart = record.length === 0 && field.length === 0 && !fieldWasQuoted;
    if (atRecordStart && char === "#") {
      while (i < content.length && content[i] !== "\n") i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      fieldWasQuoted = true;
    } else if (char === delimiter) {
      endField();
    } else if (char === "\r") {
      // \r\n wird über das folgende \n behandelt; einzelnes \r beendet den Satz.
      if (content[i + 1] !== "\n") endRecord();
    } else if (char === "\n") {
      endRecord();
    } else {
      field += char;
    }
  }

  // Letzter Satz ohne abschließenden Zeilenumbruch.
  if (inQuotes || field.length > 0 || record.length > 0) endRecord();

  return records;
}

export function parseCsv(content: string): CsvCardRow[] {
  // BOM entfernen, sonst landet es in der ersten Vorderseite.
  const text = content.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: CsvCardRow[] = [];

  for (const fields of parseRecords(text, delimiter)) {
    if (fields.length < 2) continue;
    const [front, back, bidirectionalRaw] = fields;
    if (!front.trim() && !back.trim()) continue;
    const bidirectional = bidirectionalRaw === undefined ? true : bidirectionalRaw.trim() !== "0";
    rows.push({ front, back, bidirectional });
  }
  return rows;
}

function escapeField(value: string): string {
  // Ein führendes '#' muss gequotet werden, sonst liest der Import die Zeile
  // als Anki-Kommentar -- eine Markdown-Überschrift ginge damit verloren.
  if (/^#/.test(value) || /[",\n\r\t]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: CsvCardRow[]): string {
  const lines = rows.map(
    (row) => `${escapeField(row.front)},${escapeField(row.back)},${row.bidirectional ? 1 : 0}`
  );
  return lines.join("\n");
}
