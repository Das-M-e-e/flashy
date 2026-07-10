import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useLocale } from "../i18n";
import { useSync } from "../sync";
import type { RepoOption, SyncConfigView } from "../types";
import ConfirmDialog from "./ConfirmDialog";

export default function SyncSettingsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  const { status, syncNow, refresh } = useSync();

  const [config, setConfig] = useState<SyncConfigView | null>(null);
  const [repos, setRepos] = useState<RepoOption[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Stufe 1
  const [token, setToken] = useState("");
  const [editingToken, setEditingToken] = useState(false);

  // Stufe 2 + 3
  const [fullName, setFullName] = useState("");
  const [branch, setBranch] = useState("");
  const [path, setPath] = useState("flashy-data.json");
  const [deviceName, setDeviceName] = useState("");
  const [autoSync, setAutoSync] = useState(true);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [filter, setFilter] = useState("");
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const hasToken = Boolean(config?.hasToken) && !editingToken;

  useEffect(() => {
    api
      .syncConfig()
      .then((cfg) => {
        setConfig(cfg);
        setPath(cfg.path);
        setDeviceName(cfg.deviceName);
        setAutoSync(cfg.autoSync);
        setIntervalMinutes(cfg.intervalMinutes);
        if (cfg.owner && cfg.repo) setFullName(`${cfg.owner}/${cfg.repo}`);
        if (cfg.branch) setBranch(cfg.branch);
        if (cfg.hasToken) void loadRepos();
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRepos() {
    try {
      setRepos(await api.syncRepos());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.load"));
    }
  }

  async function handleCheckToken() {
    if (!token.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { login } = await api.syncSaveToken(token.trim());
      setConfig((prev) => (prev ? { ...prev, hasToken: true, githubLogin: login } : prev));
      setEditingToken(false);
      setToken("");
      await loadRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.save"));
    } finally {
      setBusy(false);
    }
  }

  // Branches nachladen, sobald ein Repo gewählt ist.
  useEffect(() => {
    const repo = repos.find((r) => r.fullName === fullName);
    if (!repo) return;
    let cancelled = false;
    api
      .syncBranches(repo.owner, repo.name)
      .then((list) => {
        if (cancelled) return;
        setBranches(list);
        setBranch((current) => (current && list.includes(current) ? current : repo.defaultBranch));
      })
      .catch((err) => setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [fullName, repos]);

  async function handleSave() {
    const repo = repos.find((r) => r.fullName === fullName);
    if (!repo || !branch) {
      setError(t("sync.needRepo"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await api.syncSaveConfig({
        owner: repo.owner,
        repo: repo.name,
        branch,
        path: path.trim() || "flashy-data.json",
        deviceName: deviceName.trim(),
        autoSync,
        intervalMinutes,
      });
      // Ohne das blieben "Jetzt synchronisieren"/"Verknüpfung lösen" verborgen.
      setConfig(saved);
      setNotice(t("sync.saved"));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.save"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncNow() {
    setBusy(true);
    setNotice(null);
    await syncNow();
    setBusy(false);
  }

  async function handleUnlink() {
    setConfirmUnlink(false);
    setBusy(true);
    try {
      const cfg = await api.syncUnlink();
      setConfig(cfg);
      setRepos([]);
      setBranches([]);
      setFullName("");
      setBranch("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.delete"));
    } finally {
      setBusy(false);
    }
  }

  const visibleRepos = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return repos;
    return repos.filter((r) => r.fullName.toLowerCase().includes(needle));
  }, [repos, filter]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>{t("sync.title")}</h3>
        {error && <div className="error-banner">{error}</div>}
        {notice && <div className="notice-banner">{notice}</div>}

        {/* Stufe 1: Token */}
        <section className="sync-section">
          <h4>{t("sync.step1")}</h4>
          {hasToken ? (
            <div className="sync-row">
              <span className="mastery-caption">
                {t("sync.signedInAs", { login: config?.githubLogin ?? "?" })}
              </span>
              <button onClick={() => setEditingToken(true)}>{t("sync.tokenChange")}</button>
            </div>
          ) : (
            <>
              <label>
                {t("sync.tokenLabel")}
                <input
                  type="password"
                  value={token}
                  placeholder={t("sync.tokenPlaceholder")}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCheckToken()}
                />
              </label>
              <button className="primary" onClick={handleCheckToken} disabled={busy || !token.trim()}>
                {t("sync.tokenCheck")}
              </button>
            </>
          )}
          <p className="sync-hint">{t("sync.tokenHint")}</p>
        </section>

        {/* Stufe 2: Repo + Branch */}
        <section className={`sync-section ${hasToken ? "" : "sync-section-disabled"}`}>
          <h4>{t("sync.step2")}</h4>
          {repos.length > 8 && (
            <input
              type="text"
              placeholder={t("sync.repoFilter")}
              value={filter}
              disabled={!hasToken}
              onChange={(e) => setFilter(e.target.value)}
            />
          )}
          <label>
            {t("sync.repoLabel")}
            <select value={fullName} disabled={!hasToken} onChange={(e) => setFullName(e.target.value)}>
              <option value="">{t("sync.repoSelect")}</option>
              {visibleRepos.map((r) => (
                <option key={r.fullName} value={r.fullName}>
                  {r.fullName}
                  {r.private ? ` (${t("sync.repoPrivate")})` : ""}
                </option>
              ))}
            </select>
          </label>
          {hasToken && repos.length === 0 && <p className="sync-hint">{t("sync.repoNone")}</p>}
          <label>
            {t("sync.branchLabel")}
            <select value={branch} disabled={!hasToken || !fullName} onChange={(e) => setBranch(e.target.value)}>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("sync.pathLabel")}
            <input type="text" value={path} disabled={!hasToken} onChange={(e) => setPath(e.target.value)} />
          </label>
        </section>

        {/* Stufe 3: Optionen */}
        <section className={`sync-section ${hasToken ? "" : "sync-section-disabled"}`}>
          <h4>{t("sync.step3")}</h4>
          <label>
            {t("sync.deviceLabel")}
            <input
              type="text"
              value={deviceName}
              disabled={!hasToken}
              onChange={(e) => setDeviceName(e.target.value)}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={autoSync}
              disabled={!hasToken}
              onChange={(e) => setAutoSync(e.target.checked)}
            />
            {t("sync.autoSync")}
          </label>
          <label>
            {t("sync.intervalLabel")}
            <input
              type="number"
              min={1}
              value={intervalMinutes}
              disabled={!hasToken || !autoSync}
              onChange={(e) => setIntervalMinutes(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </section>

        <div className="modal-actions sync-actions">
          {config?.configured && (
            <>
              <button className="danger" onClick={() => setConfirmUnlink(true)} disabled={busy}>
                {t("sync.unlink")}
              </button>
              <button onClick={handleSyncNow} disabled={busy || status?.state === "syncing"}>
                {t("sync.now")}
              </button>
            </>
          )}
          <span className="spacer" />
          <button onClick={onClose}>{t("common.cancel")}</button>
          <button className="primary" onClick={handleSave} disabled={busy || !hasToken}>
            {t("common.save")}
          </button>
        </div>
      </div>

      {confirmUnlink && (
        <ConfirmDialog
          message={t("sync.unlinkConfirm")}
          onCancel={() => setConfirmUnlink(false)}
          onConfirm={handleUnlink}
        />
      )}
    </div>
  );
}
