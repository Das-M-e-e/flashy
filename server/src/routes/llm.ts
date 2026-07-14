import { Router } from "express";
import * as db from "../db";
import * as llm from "../llm/client";
import type { LlmConfigView, LlmProvider } from "../types";

export const llmRouter = Router();

function configView(): LlmConfigView {
  const c = db.getLlmConfig();
  return {
    configured: llm.isConfigured(c),
    provider: c.provider,
    baseUrl: c.baseUrl,
    model: c.model,
    // Der Key verlässt den Server nie.
    hasKey: Boolean(c.apiKey),
  };
}

llmRouter.get("/config", (_req, res) => {
  res.json(configView());
});

llmRouter.put("/config", (req, res) => {
  const provider: LlmProvider =
    req.body?.provider === "github_models" ? "github_models" : "openai_compatible";
  const baseUrl = String(req.body?.baseUrl ?? "").trim();
  const model = String(req.body?.model ?? "").trim();
  if (provider === "openai_compatible" && !baseUrl) {
    res.status(400).json({ error: "Basis-URL ist erforderlich" });
    return;
  }
  if (!model) {
    res.status(400).json({ error: "Modell ist erforderlich" });
    return;
  }
  db.setLlmConfig({ provider, baseUrl, model });
  res.json(configView());
});

llmRouter.post("/key", (req, res) => {
  const key = String(req.body?.key ?? "").trim();
  if (!key) {
    res.status(400).json({ error: "Key ist erforderlich" });
    return;
  }
  db.setLlmKey(key);
  res.json(configView());
});

llmRouter.delete("/config", (_req, res) => {
  db.clearLlmConfig();
  res.json(configView());
});

llmRouter.post("/test", async (_req, res) => {
  try {
    const result = await llm.testConnection(db.getLlmConfig());
    res.json({ ok: true, model: result.model });
  } catch (err) {
    const status =
      err instanceof llm.LlmError
        ? err.status === 401 || err.status === 403
          ? err.status
          : 502
        : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
