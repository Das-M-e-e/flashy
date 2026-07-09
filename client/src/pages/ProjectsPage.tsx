import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import ConfirmDialog from "../components/ConfirmDialog";
import type { Project } from "../types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  useEffect(() => {
    api
      .listProjects()
      .then(setProjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const project = await api.createProject(newName.trim());
      setProjects((prev) => [...prev, project]);
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Erstellen");
    }
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    try {
      const updated = await api.renameProject(id, renameValue.trim());
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setRenamingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Umbenennen");
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <div className="topbar">
        <h1>Flashy</h1>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        <input
          type="text"
          placeholder="Neues Projekt..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <button className="primary" onClick={handleCreate}>
          Projekt anlegen
        </button>
      </div>

      {loading ? (
        <p>Lade...</p>
      ) : projects.length === 0 ? (
        <div className="empty-state">Noch keine Projekte. Lege dein erstes Projekt an.</div>
      ) : (
        <div className="list">
          {projects.map((project) => (
            <div className="card-item" key={project.id}>
              <div className="card-item-main">
                {renamingId === project.id ? (
                  <input
                    type="text"
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename(project.id)}
                    onBlur={() => handleRename(project.id)}
                  />
                ) : (
                  <Link to={`/projects/${project.id}`} className="card-item-title">
                    {project.name}
                  </Link>
                )}
              </div>
              <div className="card-item-actions">
                <button
                  onClick={() => {
                    setRenamingId(project.id);
                    setRenameValue(project.name);
                  }}
                >
                  Umbenennen
                </button>
                <button className="danger" onClick={() => setDeleteTarget(project)}>
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Projekt "${deleteTarget.name}" inklusive aller Stapel und Karten wirklich löschen?`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}
    </div>
  );
}
