import fs from "node:fs";
import JSZip from "jszip";
import * as db from "../db";
import type { Card, CardData, CardType } from "../types";
import {
  degraded,
  EXPORTABLE_FIELDS,
  fieldValue,
  filterByType,
  mediaRefsOf,
  type ExportField,
} from "./fields";

type CardInput = db.CardInput;

export type ExportFormat = "flashy" | "genericJson" | "anki" | "quizlet" | "csv";

export interface ExportOptions {
  format: ExportFormat;
  cardTypes?: CardType[] | null;
  fields?: ExportField[];
}

export interface ExportFile {
  filename: string;
  mime: string;
  buffer: Buffer;
}

export interface ImportedCard {
  input: CardInput;
  stats?: { direction: "forward" | "backward"; correctCount: number; incorrectCount: number }[];
}

const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|wav|weba|opus)$/i;

function selectedFields(opts: ExportOptions): ExportField[] {
  const req = opts.fields ?? [];
  return EXPORTABLE_FIELDS.filter((f) => req.includes(f));
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "deck";
}

/** Hängt die referenzierten Mediendateien in ein ZIP; liefert true, wenn welche dabei waren. */
function addMedia(zip: JSZip, cards: Card[]): boolean {
  let any = false;
  for (const ref of mediaRefsOf(cards)) {
    const parsed = db.parseMediaRef(ref);
    if (!parsed) continue;
    const fp = db.mediaFilePath(parsed.hash, parsed.ext);
    if (fs.existsSync(fp)) {
      zip.file(ref, fs.readFileSync(fp));
      any = true;
    }
  }
  return any;
}

// ---------- Encoder (Content, ohne ZIP) ----------

/** Ergebnis eines Encoders: die Primärdatei plus Info, ob Medien gebündelt werden. */
interface DeckContent {
  /** Dateiendung ohne Punkt. */
  ext: string;
  mime: string;
  content: string;
  /** Format referenziert Medien -> bei Vorhandensein als ZIP mit media/-Ordner ausliefern. */
  bundlesMedia: boolean;
}

function flashyContent(cards: Card[], deckName: string): DeckContent {
  const payload = { format: "flashy-deck", formatVersion: 1, deck: { name: deckName }, cards };
  return { ext: "json", mime: "application/json", content: JSON.stringify(payload, null, 2), bundlesMedia: true };
}

function genericJsonContent(cards: Card[], deckName: string, fields: ExportField[]): DeckContent {
  const payload = {
    name: deckName,
    cards: cards.map((c) => {
      const out: Record<string, unknown> = { type: c.type, front: c.front, back: c.back };
      if (c.data && Object.keys(c.data).length > 0) out.data = c.data;
      for (const f of fields) out[f] = fieldValue(c, f);
      return out;
    }),
  };
  return { ext: "json", mime: "application/json", content: JSON.stringify(payload, null, 2), bundlesMedia: true };
}

/** Wandelt Markdown-Feld in ein Anki-HTML-Feld (Medien -> <img>/[sound:], Umbrüche -> <br>). */
function toAnkiField(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\((media\/[a-f0-9]{64}\.[a-z0-9]+)\)/gi, (_all, ref: string) => {
      const name = ref.split("/")[1];
      return AUDIO_EXT.test(name) ? `[sound:${name}]` : `<img src="${name}">`;
    })
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, "<br>");
}

function ankiContent(cards: Card[], deckName: string): DeckContent {
  const header = ["#separator:tab", "#html:true", "#notetype column:1", "#deck column:2"].join("\n");
  const rows = cards.map((c) => {
    if (c.type === "cloze") return ["Cloze", deckName, toAnkiField(c.front), ""].join("\t");
    const d = degraded(c);
    return ["Basic", deckName, toAnkiField(d.front), toAnkiField(d.back)].join("\t");
  });
  return { ext: "txt", mime: "text/plain; charset=utf-8", content: `${header}\n${rows.join("\n")}\n`, bundlesMedia: true };
}

function toPlain(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function quizletContent(cards: Card[]): DeckContent {
  const rows = cards.map((c) => {
    const d = degraded(c);
    return `${toPlain(d.front)}\t${toPlain(d.back)}`;
  });
  return { ext: "txt", mime: "text/plain; charset=utf-8", content: rows.join("\n") + "\n", bundlesMedia: false };
}

function csvEscape(value: string): string {
  if (/^#/.test(value) || /[",\n\r\t]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function csvContent(cards: Card[], fields: ExportField[]): DeckContent {
  const columns = ["front", "back", ...fields];
  const lines = [`# flashy-columns: ${columns.join(",")}`];
  for (const c of cards) {
    const d = degraded(c);
    const cells = [d.front, d.back, ...fields.map((f) => String(fieldValue(c, f)))];
    lines.push(cells.map(csvEscape).join(","));
  }
  return { ext: "csv", mime: "text/csv; charset=utf-8", content: lines.join("\n") + "\n", bundlesMedia: false };
}

function buildContent(cards: Card[], deckName: string, opts: ExportOptions): DeckContent {
  const fields = selectedFields(opts);
  switch (opts.format) {
    case "flashy":
      return flashyContent(cards, deckName);
    case "genericJson":
      return genericJsonContent(cards, deckName, fields);
    case "anki":
      return ankiContent(cards, deckName);
    case "quizlet":
      return quizletContent(cards);
    case "csv":
      return csvContent(cards, fields);
  }
}

/** Legt Medien für ein Anki-ZIP flach ab (Anki erwartet Dateinamen ohne media/-Präfix). */
function ankiReadme(): string {
  return "Importiere die .txt in Anki (Datei -> Importieren).\nKopiere die Dateien aus dem media-Ordner in den collection.media-Ordner deiner Anki-Sammlung.";
}

export async function exportDeck(cards: Card[], deckName: string, opts: ExportOptions): Promise<ExportFile> {
  const selected = filterByType(cards, opts.cardTypes);
  const c = buildContent(selected, deckName, opts);
  const base = safeName(deckName);

  if (c.bundlesMedia && mediaRefsOf(selected).size > 0) {
    const zip = new JSZip();
    zip.file(`deck.${c.ext}`, c.content);
    addMedia(zip, selected);
    if (opts.format === "anki") zip.file("README.txt", ankiReadme());
    return {
      filename: `${base}.${opts.format}.zip`,
      mime: "application/zip",
      buffer: await zip.generateAsync({ type: "nodebuffer" }),
    };
  }
  return { filename: `${base}.${c.ext}`, mime: c.mime, buffer: Buffer.from(c.content, "utf-8") };
}

/** Projekt-Export: eine ZIP mit einer Datei pro Stapel plus gemeinsamem media/-Ordner. */
export async function exportProject(
  decks: { name: string; cards: Card[] }[],
  projectName: string,
  opts: ExportOptions
): Promise<ExportFile> {
  const zip = new JSZip();
  const used = new Set<string>();
  const allCards: Card[] = [];
  for (const deck of decks) {
    const selected = filterByType(deck.cards, opts.cardTypes);
    allCards.push(...selected);
    const c = buildContent(selected, deck.name, opts);
    let name = `${safeName(deck.name)}.${c.ext}`;
    let n = 2;
    while (used.has(name)) name = `${safeName(deck.name)}-${n++}.${c.ext}`;
    used.add(name);
    zip.file(name, c.content);
  }
  const anyBundles = opts.format === "flashy" || opts.format === "genericJson" || opts.format === "anki";
  if (anyBundles) {
    addMedia(zip, allCards);
    if (opts.format === "anki") zip.file("README.txt", ankiReadme());
  }
  return {
    filename: `${safeName(projectName)}.${opts.format}.zip`,
    mime: "application/zip",
    buffer: await zip.generateAsync({ type: "nodebuffer" }),
  };
}

// ---------- Decoder (Import) ----------

const VALID_TYPES: CardType[] = ["basic", "type_answer", "choice", "truefalse", "cloze"];

function coerceType(t: unknown): CardType {
  return VALID_TYPES.includes(t as CardType) ? (t as CardType) : "basic";
}

/** Baut aus einem generischen/nativen Kartenobjekt eine ImportedCard. */
function objectToImported(o: Record<string, unknown>): ImportedCard | null {
  const front = String(o.front ?? "").trim();
  if (!front) return null;
  const type = coerceType(o.type);
  const back = String(o.back ?? "");
  const data = (o.data ?? null) as CardData | null;
  const input: CardInput = { type, front, back, bidirectional: Boolean(o.bidirectional ?? type === "basic"), data };

  const stats = Array.isArray(o.stats)
    ? (o.stats as { direction: "forward" | "backward"; correctCount: number; incorrectCount: number }[])
    : undefined;
  const correct = Number(o.correct);
  const incorrect = Number(o.incorrect);
  const flatStats =
    !stats && (Number.isFinite(correct) || Number.isFinite(incorrect))
      ? [{ direction: "forward" as const, correctCount: correct || 0, incorrectCount: incorrect || 0 }]
      : undefined;

  return { input, stats: stats ?? flatStats };
}

/** Text (CSV/TSV/Anki) -> Karten. Erkennt flashy-columns, Anki-Header und Cloze. */
function importText(text: string): ImportedCard[] {
  const columnsMatch = text.match(/^#\s*flashy-columns:\s*(.+)$/im);
  const columns = columnsMatch ? columnsMatch[1].split(",").map((c) => c.trim()) : null;
  const hasNotetypeCol = /^#\s*notetype column:\s*1/im.test(text);

  const cards: ImportedCard[] = [];
  for (const rec of rawParse(text)) {
    if (rec.length === 0 || rec.every((f) => !f.trim())) continue;

    let front = "";
    let back = "";
    let type: CardType = "basic";
    let bidirectional = true;
    const meta: Record<string, string> = {};

    if (columns) {
      columns.forEach((col, i) => {
        const v = rec[i] ?? "";
        if (col === "front") front = v;
        else if (col === "back") back = v;
        else if (col === "type") type = coerceType(v);
        else if (col === "bidirectional") bidirectional = v !== "0" && v.toLowerCase() !== "false";
        else meta[col] = v;
      });
    } else if (hasNotetypeCol) {
      // Anki-Spalten: notetype, [deck], feld1, feld2 …
      const notetype = (rec[0] ?? "").toLowerCase();
      const content = rec.length >= 4 ? rec.slice(2) : rec.slice(1);
      front = content[0] ?? "";
      back = content[1] ?? "";
      type = notetype.includes("cloze") || /\{\{c\d+::/.test(front) ? "cloze" : "basic";
    } else {
      front = rec[0] ?? "";
      back = rec[1] ?? "";
      bidirectional = rec[2] === undefined ? true : rec[2].trim() !== "0";
      if (/\{\{c\d+::/.test(front)) type = "cloze";
    }

    front = front.trim();
    if (!front) continue;

    const input: CardInput = {
      type,
      front,
      back: back.trim(),
      bidirectional: type === "basic" ? bidirectional : false,
      data: null,
    };
    const correct = Number(meta.correct);
    const incorrect = Number(meta.incorrect);
    const flatStats =
      Number.isFinite(correct) || Number.isFinite(incorrect)
        ? [{ direction: "forward" as const, correctCount: correct || 0, incorrectCount: incorrect || 0 }]
        : undefined;
    cards.push({ input, stats: flatStats });
  }
  return cards;
}

// Roher RFC4180-Parser (liefert alle Felder je Datensatz), ignoriert #-Kommentarzeilen.
function rawParse(content: string): string[][] {
  const text = content.replace(/^﻿/, "");
  const delimiter = text.includes("\t") ? "\t" : ",";
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  let atStart = true;

  const endField = () => {
    record.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
    atStart = true;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (atStart && ch === "#") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      atStart = false;
    } else if (ch === delimiter) {
      endField();
      atStart = false;
    } else if (ch === "\r") {
      if (text[i + 1] !== "\n") endRecord();
    } else if (ch === "\n") {
      endRecord();
    } else {
      field += ch;
      atStart = false;
    }
  }
  if (inQuotes || field.length > 0 || record.length > 0) endRecord();
  return records.map((r) => r.map((f) => f.trim()));
}

async function readZip(buffer: Buffer): Promise<{ cards: ImportedCard[]; media: Map<string, Buffer> }> {
  const zip = await JSZip.loadAsync(buffer);
  const media = new Map<string, Buffer>();
  let cards: ImportedCard[] = [];

  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name];
    if (entry.dir) continue;
    if (/^media\//i.test(name)) {
      media.set(name.toLowerCase(), await entry.async("nodebuffer"));
    }
  }
  // Karten aus deck.json oder erster .json/.txt/.csv
  const jsonName = Object.keys(zip.files).find((n) => /\.json$/i.test(n));
  const textName = Object.keys(zip.files).find((n) => /\.(txt|csv|tsv)$/i.test(n));
  if (jsonName) {
    cards = parseJsonCards(await zip.files[jsonName].async("string"));
  } else if (textName) {
    cards = importText(await zip.files[textName].async("string"));
  }
  return { cards, media };
}

function parseJsonCards(text: string): ImportedCard[] {
  const obj = JSON.parse(text) as { cards?: unknown[] };
  if (!obj || !Array.isArray(obj.cards)) throw new Error("Ungültige JSON-Datei: 'cards' fehlt");
  const out: ImportedCard[] = [];
  for (const c of obj.cards) {
    const imported = objectToImported(c as Record<string, unknown>);
    if (imported) out.push(imported);
  }
  return out;
}

/** Erkennt das Format am Dateinamen/Inhalt und liefert Karten (+ Medien bei ZIP). */
export async function importData(
  buffer: Buffer,
  filename: string
): Promise<{ cards: ImportedCard[]; media: Map<string, Buffer> }> {
  if (/\.zip$/i.test(filename) || buffer.slice(0, 2).toString("latin1") === "PK") {
    return readZip(buffer);
  }
  const text = buffer.toString("utf-8");
  const trimmed = text.trimStart();
  if (/\.json$/i.test(filename) || trimmed.startsWith("{")) {
    return { cards: parseJsonCards(text), media: new Map() };
  }
  return { cards: importText(text), media: new Map() };
}
