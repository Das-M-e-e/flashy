import { Router } from "express";
import * as db from "../db";
import type { GeneralConfigView } from "../types";

export const generalRouter = Router();

function configView(): GeneralConfigView {
  const c = db.getGeneralConfig();
  return {
    theme: c.theme === "light" || c.theme === "dark" || c.theme === "system" ? c.theme : null,
    lang: c.lang === "de" || c.lang === "en" ? c.lang : null,
    confirmUnsavedChanges: c.confirmUnsaved !== 0,
  };
}

generalRouter.get("/config", (_req, res) => {
  res.json(configView());
});

generalRouter.put("/config", (req, res) => {
  const patch: { theme?: string; lang?: string; confirmUnsaved?: boolean } = {};
  if (req.body?.theme === "light" || req.body?.theme === "dark" || req.body?.theme === "system") {
    patch.theme = req.body.theme;
  }
  if (req.body?.lang === "de" || req.body?.lang === "en") patch.lang = req.body.lang;
  if (typeof req.body?.confirmUnsavedChanges === "boolean") patch.confirmUnsaved = req.body.confirmUnsavedChanges;
  db.setGeneralConfig(patch);
  res.json(configView());
});
