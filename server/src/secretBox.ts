import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Verschlüsselt Geheimnisse (GitHub-PAT, LLM-API-Key) ruhend in der SQLite-Datei
 * mit AES-256-GCM. Der Schlüssel liegt als separate Datei neben der DB (0600) --
 * das schützt nicht vor einem vollständig kompromittierten Host, aber sehr wohl
 * davor, dass die DB-Datei allein (Kopie, Backup, Cloud-Sync) die Klartext-
 * Geheimnisse preisgibt.
 */

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "data");

const KEY_FILE = path.join(dataDir, "secret.key");
const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";

let cachedKey: Buffer | null = null;

function loadOrCreateKey(): Buffer {
  if (cachedKey) return cachedKey;
  fs.mkdirSync(dataDir, { recursive: true });
  if (fs.existsSync(KEY_FILE)) {
    cachedKey = Buffer.from(fs.readFileSync(KEY_FILE, "utf8").trim(), "hex");
    return cachedKey;
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key.toString("hex"), { mode: 0o600 });
  try {
    fs.chmodSync(KEY_FILE, 0o600);
  } catch {
    // Auf Windows greift chmod nur eingeschränkt -- kein hartes Erfordernis.
  }
  cachedKey = key;
  return key;
}

/** Verschlüsselt einen Klartext-String; `null` bleibt `null`. */
export function encryptSecret(plain: string | null): string | null {
  if (plain === null) return null;
  const key = loadOrCreateKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

/**
 * Entschlüsselt einen gespeicherten Wert. Werte ohne das Präfix gelten als
 * Alt-Klartext (vor Einführung der Verschlüsselung) und werden unverändert
 * zurückgegeben -- `migrateLegacySecrets()` holt sie beim Start nach.
 */
export function decryptSecret(stored: string | null): string | null {
  if (stored === null) return null;
  if (!stored.startsWith(PREFIX)) return stored;
  const key = loadOrCreateKey();
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Ist der gespeicherte Wert bereits im neuen, verschlüsselten Format? */
export function isEncrypted(stored: string | null): boolean {
  return stored !== null && stored.startsWith(PREFIX);
}
