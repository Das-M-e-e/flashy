import path from "node:path";
import cors from "cors";
import express from "express";
import { cardsRouter, deckCardsRouter } from "./routes/cards";
import { decksRouter, projectDecksRouter } from "./routes/decks";
import { deckExportRouter, deckImportRouter, projectExportRouter } from "./routes/importExport";
import { projectsRouter } from "./routes/projects";
import { deckStatsRouter, projectStudyRouter } from "./routes/study";

const app = express();
const port = Number(process.env.SERVER_PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.use("/api/projects", projectsRouter);
app.use("/api/projects/:projectId/decks", projectDecksRouter);
app.use("/api/projects/:projectId/export", projectExportRouter);
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

app.listen(port, () => {
  console.log(`Flashy server läuft auf http://localhost:${port}`);
});
