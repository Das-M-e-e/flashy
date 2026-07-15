import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Avatar from "../components/Avatar";
import ConfirmDialog from "../components/ConfirmDialog";
import DistributionBar from "../components/DistributionBar";
import NameDialog from "../components/NameDialog";
import ProgressRing from "../components/ProgressRing";
import { useLocale } from "../i18n";
import type { Project, ProjectStats } from "../types";

export default function ProjectsPage() {
  const { t } = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  async function load() {
    try {
      const list = await api.listProjects();
      setProjects(list);
      const entries = await Promise.all(
        list.map(async (p) => [p.id, await api.projectStats(p.id)] as const)
      );
      setStats(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(name: string) {
    const project = await api.createProject(name);
    setProjects((prev) => [...prev, project]);
    setStats((prev) => ({
      ...prev,
      [project.id]: {
        projectId: project.id,
        deckCount: 0,
        cardCount: 0,
        itemCount: 0,
        masteryPercent: 0,
        masteryLabel: "empty",
        buckets: { new: 0, learning: 0, known: 0, mastered: 0 },
      },
    }));
    setCreating(false);
  }

  async function handleImportProject(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const { project } = await api.importProject(file);
      const projectStats = await api.projectStats(project.id);
      setProjects((prev) => [...prev, project]);
      setStats((prev) => ({ ...prev, [project.id]: projectStats }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.import"));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRename(id: string, name: string) {
    const updated = await api.renameProject(id, name);
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    setRenameTarget(null);
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.delete"));
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <div className="topbar">
        <h1>{t("projects.heading")}</h1>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        <button className="primary" onClick={() => setCreating(true)}>
          {t("projects.new")}
        </button>
        <button disabled={importing} onClick={() => fileInputRef.current?.click()}>
          {importing ? t("common.loading") : t("projects.import")}
        </button>
        <input
          type="file"
          accept=".zip"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleImportProject}
        />
      </div>

      {loading ? (
        <p>{t("common.loading")}</p>
      ) : projects.length === 0 ? (
        <div className="empty-state">{t("projects.empty")}</div>
      ) : (
        <div className="list">
          {projects.map((project) => {
            const s = stats[project.id];
            return (
              <div className="entity-card" key={project.id}>
                <Avatar name={project.name} />
                <div className="entity-main">
                  <Link to={`/projects/${project.id}`} className="entity-title">
                    {project.name}
                  </Link>
                  <div className="entity-meta">
                    <span>
                      {s?.deckCount === 1
                        ? t("stats.decks.one")
                        : t("stats.decks", { count: s?.deckCount ?? 0 })}
                    </span>
                    <span className="dot">·</span>
                    <span>
                      {/* itemCount wie auf der Stapel-Karte: bidirektionale Karten zählen doppelt. */}
                      {s?.itemCount === 1
                        ? t("stats.cards.one")
                        : t("stats.cards", { count: s?.itemCount ?? 0 })}
                    </span>
                  </div>
                  {s && s.itemCount > 0 && <DistributionBar buckets={s.buckets} />}
                </div>
                <div className="entity-viz">
                  <ProgressRing percent={s?.masteryPercent ?? 0} empty={!s || s.itemCount === 0} />
                </div>
                <div className="entity-actions">
                  <button onClick={() => setRenameTarget(project)}>{t("common.rename")}</button>
                  <button className="danger" onClick={() => setDeleteTarget(project)}>
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <NameDialog
          title={t("projects.newTitle")}
          label={t("projects.nameLabel")}
          placeholder={t("projects.namePlaceholder")}
          submitLabel={t("common.create")}
          onCancel={() => setCreating(false)}
          onSubmit={handleCreate}
        />
      )}

      {renameTarget && (
        <NameDialog
          title={t("projects.renameTitle")}
          label={t("projects.nameLabel")}
          initialValue={renameTarget.name}
          onCancel={() => setRenameTarget(null)}
          onSubmit={(name) => handleRename(renameTarget.id, name)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={t("projects.deleteConfirm", { name: deleteTarget.name })}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}
    </div>
  );
}
