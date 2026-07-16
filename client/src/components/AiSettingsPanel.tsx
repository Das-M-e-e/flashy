import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useLocale } from "../i18n";
import type { LlmConfigView, LlmProvider } from "../types";
import ConfirmDialog from "./ConfirmDialog";

interface DraftFields {
  provider: LlmProvider;
  baseUrl: string;
  model: string;
}

export default function AiSettingsPanel({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { t } = useLocale();

  const [config, setConfig] = useState<LlmConfigView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [provider, setProvider] = useState<LlmProvider>("openai_compatible");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [editingKey, setEditingKey] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Letzter geladener/gespeicherter Stand -- Referenz für Änderungserkennung und "Abbrechen".
  const [baseline, setBaseline] = useState<DraftFields | null>(null);

  const isGithub = provider === "github_models";
  const hasKey = Boolean(config?.hasKey) && !editingKey;

  useEffect(() => {
    api
      .llmConfig()
      .then((cfg) => {
        setConfig(cfg);
        setProvider(cfg.provider);
        setBaseUrl(cfg.baseUrl);
        setModel(cfg.model);
        setBaseline({ provider: cfg.provider, baseUrl: cfg.baseUrl, model: cfg.model });
      })
      .catch((err) => setError(err.message));
  }, []);

  const isDirty = useMemo(
    () =>
      baseline !== null &&
      (provider !== baseline.provider || baseUrl !== baseline.baseUrl || model !== baseline.model),
    [baseline, provider, baseUrl, model]
  );

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  async function saveConfig(): Promise<boolean> {
    if (!model.trim()) {
      setError(t("llm.needModel"));
      return false;
    }
    if (!isGithub && !baseUrl.trim()) {
      setError(t("llm.needBaseUrl"));
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const trimmedBaseUrl = baseUrl.trim();
      const trimmedModel = model.trim();
      const saved = await api.llmSaveConfig({ provider, baseUrl: trimmedBaseUrl, model: trimmedModel });
      setConfig(saved);
      setBaseline({ provider, baseUrl: trimmedBaseUrl, model: trimmedModel });
      setNotice(t("llm.saved"));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.save"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    if (!baseline) return;
    setProvider(baseline.provider);
    setBaseUrl(baseline.baseUrl);
    setModel(baseline.model);
  }

  async function handleSaveKey() {
    if (!key.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await api.llmSaveKey(key.trim());
      setConfig(saved);
      setEditingKey(false);
      setKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.save"));
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    setError(null);
    setNotice(null);
    // Erst die aktuellen Einstellungen sichern, dann testen.
    if (!(await saveConfig())) {
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const result = await api.llmTest();
      setNotice(t("llm.testOk", { model: result.model }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.load"));
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setConfirmClear(false);
    setBusy(true);
    try {
      const cfg = await api.llmClear();
      setConfig(cfg);
      setProvider(cfg.provider);
      setBaseUrl(cfg.baseUrl);
      setModel(cfg.model);
      setKey("");
      setEditingKey(false);
      setNotice(null);
      setBaseline({ provider: cfg.provider, baseUrl: cfg.baseUrl, model: cfg.model });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.delete"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h3>{t("llm.title")}</h3>
      <p className="sync-hint">{t("llm.intro")}</p>
      <p className="sync-hint">{t("llm.privacy")}</p>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="notice-banner">{notice}</div>}

      <section className="sync-section">
        <label>
          {t("llm.provider")}
          <select value={provider} onChange={(e) => setProvider(e.target.value as LlmProvider)}>
            <option value="openai_compatible">{t("llm.provider.openai_compatible")}</option>
            <option value="github_models">{t("llm.provider.github_models")}</option>
          </select>
        </label>

        {!isGithub ? (
          <label>
            {t("llm.baseUrl")}
            <input
              type="text"
              value={baseUrl}
              placeholder={t("llm.baseUrlPlaceholder")}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </label>
        ) : (
          <p className="sync-hint">{t("llm.githubHint")}</p>
        )}
        {!isGithub && <p className="sync-hint">{t("llm.baseUrlHint")}</p>}

        <label>
          {t("llm.model")}
          <input
            type="text"
            value={model}
            placeholder={isGithub ? t("llm.modelPlaceholderGithub") : t("llm.modelPlaceholderOpenai")}
            onChange={(e) => setModel(e.target.value)}
          />
        </label>
      </section>

      <section className="sync-section">
        <h4>{isGithub ? t("llm.keyGithub") : t("llm.key")}</h4>
        {hasKey ? (
          <div className="sync-row">
            <span className="mastery-caption">{t("llm.keySet")}</span>
            <button onClick={() => setEditingKey(true)}>{t("llm.keyChange")}</button>
          </div>
        ) : (
          <>
            <input
              type="password"
              value={key}
              placeholder={t("llm.keyPlaceholder")}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
            />
            <button className="primary" onClick={handleSaveKey} disabled={busy || !key.trim()}>
              {t("llm.saveKey")}
            </button>
          </>
        )}
      </section>

      <section className="sync-section">
        <h4>{t("skill.title")}</h4>
        <p className="sync-hint">{t("skill.intro")}</p>
        <div className="sync-row">
          <a className="button" href="/api/skill/flashcards.zip" download>
            {t("skill.download")}
          </a>
          <a className="mastery-caption" href="/api/skill/flashcards.md" target="_blank" rel="noreferrer">
            {t("skill.view")}
          </a>
        </div>
      </section>

      <div className="modal-actions sync-actions">
        {config?.hasKey && (
          <>
            <button className="danger" onClick={() => setConfirmClear(true)} disabled={busy}>
              {t("llm.clear")}
            </button>
            <button onClick={handleTest} disabled={busy || !hasKey}>
              {t("llm.test")}
            </button>
          </>
        )}
        {isDirty && (
          <>
            <span className="spacer" />
            <button onClick={handleCancel}>{t("common.cancel")}</button>
            <button className="primary" onClick={saveConfig} disabled={busy}>
              {t("common.save")}
            </button>
          </>
        )}
      </div>

      {confirmClear && (
        <ConfirmDialog
          message={t("llm.clearConfirm")}
          onCancel={() => setConfirmClear(false)}
          onConfirm={handleClear}
        />
      )}
    </>
  );
}
