import { Router } from "express";
import * as db from "../db";
import * as engine from "../sync/engine";
import * as github from "../sync/github";
import type { SyncConfigView } from "../types";

export const syncRouter = Router();

function configView(): SyncConfigView {
  const config = db.getSyncConfig();
  return {
    configured: Boolean(config.token && config.owner && config.repo && config.branch),
    owner: config.owner,
    repo: config.repo,
    branch: config.branch,
    path: config.path,
    // Der Token verlässt den Server nie.
    hasToken: Boolean(config.token),
    githubLogin: config.githubLogin,
    deviceName: config.deviceName ?? db.defaultDeviceName(),
    autoSync: config.autoSync === 1,
    intervalMinutes: config.intervalMinutes,
  };
}

function failure(err: unknown): { status: number; message: string } {
  if (err instanceof github.GitHubError) {
    return { status: err.status === 401 || err.status === 403 ? err.status : 502, message: err.message };
  }
  return { status: 500, message: err instanceof Error ? err.message : String(err) };
}

function requireToken(): string {
  const token = db.getSyncConfig().token;
  if (!token) throw new github.GitHubError(401, "Kein Token hinterlegt");
  return token;
}

syncRouter.get("/config", (_req, res) => {
  res.json(configView());
});

syncRouter.post("/token", async (req, res) => {
  const token = String(req.body?.token ?? "").trim();
  if (!token) {
    res.status(400).json({ error: "Token ist erforderlich" });
    return;
  }
  try {
    const user = await github.getUser(token);
    db.setSyncToken(token, user.login);
    res.json({ login: user.login });
  } catch (err) {
    const { status, message } = failure(err);
    res.status(status).json({ error: message });
  }
});

syncRouter.delete("/token", (_req, res) => {
  db.setSyncToken(null, null);
  engine.rescheduleAutoSync();
  res.status(204).end();
});

syncRouter.get("/repos", async (_req, res) => {
  try {
    res.json(await github.listRepos(requireToken()));
  } catch (err) {
    const { status, message } = failure(err);
    res.status(status).json({ error: message });
  }
});

syncRouter.get("/branches", async (req, res) => {
  const owner = String(req.query.owner ?? "");
  const repo = String(req.query.repo ?? "");
  if (!owner || !repo) {
    res.status(400).json({ error: "owner und repo sind erforderlich" });
    return;
  }
  try {
    res.json(await github.listBranches(requireToken(), owner, repo));
  } catch (err) {
    const { status, message } = failure(err);
    res.status(status).json({ error: message });
  }
});

syncRouter.put("/config", (req, res) => {
  const owner = String(req.body?.owner ?? "").trim();
  const repo = String(req.body?.repo ?? "").trim();
  const branch = String(req.body?.branch ?? "").trim();
  const path = String(req.body?.path ?? "").trim() || "flashy-data.json";
  const deviceName = String(req.body?.deviceName ?? "").trim() || db.defaultDeviceName();
  const autoSync = Boolean(req.body?.autoSync ?? true);
  const intervalMinutes = Math.max(1, Number(req.body?.intervalMinutes ?? 5) || 5);

  if (!owner || !repo || !branch) {
    res.status(400).json({ error: "owner, repo und branch sind erforderlich" });
    return;
  }
  db.setSyncTarget({ owner, repo, branch, path, deviceName, autoSync, intervalMinutes });
  engine.rescheduleAutoSync();
  res.json(configView());
});

syncRouter.delete("/config", (_req, res) => {
  db.clearSyncConfig();
  engine.rescheduleAutoSync();
  res.json(configView());
});

syncRouter.get("/status", (_req, res) => {
  res.json(engine.getStatus());
});

syncRouter.post("/now", async (_req, res) => {
  res.json(await engine.sync());
});

syncRouter.post("/resolve", async (req, res) => {
  const choice = req.body?.choice;
  if (choice !== "local" && choice !== "remote") {
    res.status(400).json({ error: "choice muss 'local' oder 'remote' sein" });
    return;
  }
  res.json(await engine.resolve(choice));
});
