// Headless-Smoke-Test: startet den gebündelten Server, ruft eine API auf und
// stoppt wieder. Prüft insbesondere, ob node:sqlite in der jeweiligen Runtime
// läuft (Node direkt bzw. Electrons Node via ELECTRON_RUN_AS_NODE=1).
const path = require("node:path");
const os = require("node:os");

process.env.DATA_DIR = process.env.SMOKE_DATA || path.join(os.tmpdir(), "flashy-smoke");
process.env.SERVER_PORT = "0";
process.env.HOST = "127.0.0.1";
process.env.CLIENT_DIST = path.join(__dirname, "..", "..", "client", "dist");
process.env.SKILL_DIR = path.join(__dirname, "..", "..", "skills");

const { startServer, stopServer } = require("../dist/server.cjs");

(async () => {
  const { port } = await startServer();
  const res = await fetch(`http://127.0.0.1:${port}/api/projects`);
  const body = await res.text();
  const skill = await fetch(`http://127.0.0.1:${port}/api/skill/flashcards.md`);
  console.log(`SMOKE OK: /api/projects ${res.status} (len ${body.length}), skill ${skill.status}, runtime ${process.versions.node}`);
  await stopServer();
  // Kein hartes process.exit(0): Handles (SQLite/libuv) sauber austrudeln lassen.
})().catch((err) => {
  console.error("SMOKE FAIL:", err && err.stack ? err.stack : err);
  process.exit(1);
});
