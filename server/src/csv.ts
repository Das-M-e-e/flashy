export interface CsvCardRow {
  front: string;
  back: string;
  bidirectional: boolean;
}

function splitLine(line: string): string[] {
  const delimiter = line.includes("\t") ? "\t" : ",";
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export function parseCsv(content: string): CsvCardRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0 && !line.trim().startsWith("#"));
  const rows: CsvCardRow[] = [];
  for (const line of lines) {
    const fields = splitLine(line);
    if (fields.length < 2) continue;
    const [front, back, bidirectionalRaw] = fields;
    if (!front.trim() && !back.trim()) continue;
    const bidirectional = bidirectionalRaw === undefined ? true : bidirectionalRaw.trim() !== "0";
    rows.push({ front: front.trim(), back: back.trim(), bidirectional });
  }
  return rows;
}

function escapeField(value: string): string {
  if (/[",\n\t]/.test(value)) {
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
