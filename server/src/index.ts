import type http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import cors from "cors";
import express from "express";
import { db, failInterruptedExams, migrateEmbeddedMedia } from "./db";
import { cardsRouter, deckCardsRouter } from "./routes/cards";
import { decksRouter, projectDecksRouter } from "./routes/decks";
import { deckExamsRouter, examsRouter, projectExamsRouter } from "./routes/exams";
import { deckExportRouter, deckImportRouter, projectExportRouter } from "./routes/importExport";
import { llmRouter } from "./routes/llm";
import { mediaRouter } from "./routes/media";
import { skillRouter } from "./routes/skill";
import { projectsRouter } from "./routes/projects";
import { deckStatsRouter, projectStatsRouter, projectStudyRouter } from "./routes/study";
import { syncRouter } from "./routes/sync";
import * as syncEngine from "./sync/engine";

/** Baut die Express-App mit allen Routen und der Auslieferung des Clients. */
export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  // Karten dürfen Bilder als data-URI enthalten; die Vorgabe von 100 KB reicht dafür nicht.
  app.use(express.json({ limit: "40mb" }));

  app.use("/api/projects", projectsRouter);
  app.use("/api/projects/:projectId/decks", projectDecksRouter);
  app.use("/api/projects/:projectId/export", projectExportRouter);
  app.use("/api/projects/:projectId/stats", projectStatsRouter);
  app.use("/api/projects/:projectId/study-cards", projectStudyRouter);
  app.use("/api/projects/:projectId/exams", projectExamsRouter);

  app.use("/api/decks", decksRouter);
  app.use("/api/decks/:deckId/cards", deckCardsRouter);
  app.use("/api/decks/:deckId/import", deckImportRouter);
  app.use("/api/decks/:deckId/export", deckExportRouter);
  app.use("/api/decks/:deckId/stats", deckStatsRouter);
  app.use("/api/decks/:deckId/exams", deckExamsRouter);

  app.use("/api/cards", cardsRouter);
  app.use("/api/media", mediaRouter);
  app.use("/api/sync", syncRouter);
  app.use("/api/llm", llmRouter);
  app.use("/api/exams", examsRouter);
  app.use("/api/skill", skillRouter);

  // API-Fehler als JSON ausliefern -- der Client erwartet {error}, keine HTML-Seite.
  app.use((err: NodeJS.ErrnoException & { status?: number; type?: string }, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.path.startsWith("/api")) {
      next(err);
      return;
    }
    const status = err.status ?? 500;
    const message =
      err.type === "entity.too.large"
        ? "Inhalt ist zu groß. Bitte ein kleineres Bild verwenden."
        : err.message || "Interner Fehler";
    res.status(status).json({ error: message });
  });

  // In der Desktop-Hülle liegt der Client an einem anderen Ort -> per Env setzbar.
  const clientDist = process.env.CLIENT_DIST
    ? path.resolve(process.env.CLIENT_DIST)
    : path.join(__dirname, "..", "..", "client", "dist");
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
  return app;
}

let serverRef: http.Server | null = null;

/**
 * Startet den Server und führt Start-Aufgaben aus (Migration, erster Sync).
 * `SERVER_PORT=0` wählt einen freien Port -- der tatsächliche Port wird
 * zurückgegeben. Aufrufbar aus der CLI und aus der Electron-Hülle.
 */
export function startServer(): Promise<{ server: http.Server; port: number }> {
  const app = createApp();
  const requestedPort = Number(process.env.SERVER_PORT ?? 4000);
  const host = process.env.HOST ?? "127.0.0.1";

  return new Promise((resolve, reject) => {
    const server = app.listen(requestedPort, host, () => {
      serverRef = server;
      const port = (server.address() as AddressInfo).port;
      console.log(`Flashy server läuft auf http://localhost:${port}`);
      // Altbestand mit eingebetteten Medien auf Dateien umstellen ...
      migrateEmbeddedMedia();
      // Prüfungen, deren Generierung/Bewertung ein Neustart unterbrochen hat, freigeben.
      failInterruptedExams();
      // ... dann beim Start einmal abgleichen und im Intervall weiterlaufen.
      void syncEngine.sync();
      syncEngine.rescheduleAutoSync();
      resolve({ server, port });
    });
    server.on("error", reject);
  });
}

/**
 * Fährt den Server sauber herunter: schließt Verbindungen, sichert noch
 * ausstehende Änderungen per Sync und schließt die Datenbank.
 */
export async function stopServer(): Promise<void> {
  if (serverRef) {
    serverRef.close();
    serverRef = null;
  }
  try {
    await syncEngine.syncOnShutdown();
  } catch (err) {
    console.error("Sync beim Beenden fehlgeschlagen:", err instanceof Error ? err.message : err);
  }
  db.close();
}

// ---------- CLI-Betrieb (npm start / tsx) ----------

/** Nur ausführen, wenn direkt gestartet -- nicht beim Import aus Electron. */
if (require.main === module) {
  startServer().catch((err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      const port = Number(process.env.SERVER_PORT ?? 4000);
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
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await stopServer();
    console.log(`Flashy beendet (${signal}).`);
    // Kein sofortiges process.exit(): das würde libuv mitten im Schließen offener
    // Handles (fetch-Keepalive, SQLite) abwürgen. Sauber austrudeln lassen -- und
    // nur falls doch etwas hängt, nach kurzer Frist hart beenden.
    process.exitCode = 0;
    setTimeout(() => process.exit(0), 3000).unref();
  };

  for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"] as const) {
    process.on(signal, () => void shutdown(signal));
  }
}
