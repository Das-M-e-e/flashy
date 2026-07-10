import path from "node:path";
import cors from "cors";
import express from "express";
import { db } from "./db";
import { cardsRouter, deckCardsRouter } from "./routes/cards";
import { decksRouter, projectDecksRouter } from "./routes/decks";
import { deckExportRouter, deckImportRouter, projectExportRouter } from "./routes/importExport";
import { projectsRouter } from "./routes/projects";
import { deckStatsRouter, projectStatsRouter, projectStudyRouter } from "./routes/study";
import { syncRouter } from "./routes/sync";
import * as syncEngine from "./sync/engine";

const app = express();
const port = Number(process.env.SERVER_PORT ?? 4000);
// Nur lokal erreichbar: in der SQLite-Datei liegt der GitHub-Token.
const host = process.env.HOST ?? "127.0.0.1";

app.use(cors());
app.use(express.json());

app.use("/api/projects", projectsRouter);
app.use("/api/projects/:projectId/decks", projectDecksRouter);
app.use("/api/projects/:projectId/export", projectExportRouter);
app.use("/api/projects/:projectId/stats", projectStatsRouter);
app.use("/api/projects/:projectId/study-cards", projectStudyRouter);

app.use("/api/decks", decksRouter);
app.use("/api/decks/:deckId/cards", deckCardsRouter);
app.use("/api/decks/:deckId/import", deckImportRouter);
app.use("/api/decks/:deckId/export", deckExportRouter);
app.use("/api/decks/:deckId/stats", deckStatsRouter);

app.use("/api/cards", cardsRouter);
app.use("/api/sync", syncRouter);

const clientDist = path.join(__dirname, "..", "..", "client", "dist");
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(clientDist, "index.html"));
});

const server = app.listen(port, host, () => {
  console.log(`Flashy server läuft auf http://localhost:${port}`);
  // Beim Start einmal abgleichen, danach im konfigurierten Intervall.
  void syncEngine.sync();
  syncEngine.rescheduleAutoSync();
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\nPort ${port} ist bereits belegt.\n` +
        `Vermutlich läuft schon eine Flashy-Instanz (z.B. 'npm run dev').\n` +
        `Beende sie oder starte mit einem anderen Port: SERVER_PORT=4001 npm start\n`
    );
    process.exit(1);
  }
  throw err;
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close();
  try {
    await syncEngine.syncOnShutdown();
  } catch (err) {
    console.error("Sync beim Beenden fehlgeschlagen:", err instanceof Error ? err.message : err);
  }
  console.log(`Flashy beendet (${signal}).`);

  // Kein sofortiges process.exit(): das würde libuv mitten im Schließen offener
  // Handles (fetch-Keepalive, SQLite) abwürgen. Stattdessen sauber austrudeln
  // lassen -- und nur falls doch etwas hängt, nach kurzer Frist hart beenden.
  process.exitCode = 0;
  db.close();
  setTimeout(() => process.exit(0), 3000).unref();
}

for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"] as const) {
  process.on(signal, () => void shutdown(signal));
}
