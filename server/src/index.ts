import path from "node:path";
import cors from "cors";
import express from "express";
import { cardsRouter, deckCardsRouter } from "./routes/cards";
import { decksRouter, projectDecksRouter } from "./routes/decks";
import { deckExportRouter, deckImportRouter, projectExportRouter } from "./routes/importExport";
import { projectsRouter } from "./routes/projects";
import { deckStatsRouter, projectStatsRouter, projectStudyRouter } from "./routes/study";

const app = express();
const port = Number(process.env.SERVER_PORT ?? 4000);

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

const clientDist = path.join(__dirname, "..", "..", "client", "dist");
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(clientDist, "index.html"));
});

const server = app.listen(port, () => {
  console.log(`Flashy server läuft auf http://localhost:${port}`);
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
