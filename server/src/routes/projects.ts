import { randomUUID } from "node:crypto";
import { Router } from "express";
import * as db from "../db";

export const projectsRouter = Router();

projectsRouter.get("/", (_req, res) => {
  res.json(db.listProjects());
});

projectsRouter.post("/", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "Name ist erforderlich" });
    return;
  }
  const project = db.createProject(randomUUID(), name);
  res.status(201).json(project);
});

projectsRouter.put("/:id", (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: "Projekt nicht gefunden" });
    return;
  }
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "Name ist erforderlich" });
    return;
  }
  db.renameProject(project.id, name);
  res.json(db.getProject(project.id));
});

projectsRouter.delete("/:id", (req, res) => {
  db.deleteProject(req.params.id);
  res.status(204).end();
});
