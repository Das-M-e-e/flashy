import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import ConfirmDialog from "../components/ConfirmDialog";
import MasteryBar from "../components/MasteryBar";
import type { Deck, DeckStats, Project } from "../types";

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [stats, setStats] = useState<Record<string, DeckStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDeckName, setNewDeckName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Deck | null>(null);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    try {
      const [projects, deckList] = await Promise.all([api.listProjects(), api.listDecks(projectId)]);
      const current = projects.find((p) => p.id === projectId) ?? null;
      setProject(current);
      setDecks(deckList);
      const statEntries = await Promise.all(
        deckList.map(async (deck) => [deck.id, await api.deckStats(deck.id)] as const)
      );
      setStats(Object.fromEntries(statEntries));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleCreateDeck() {
    if (!projectId || !newDeckName.trim()) return;
    try {
      const deck = await api.createDeck(projectId, newDeckName.trim());
      setDecks((prev) => [...prev, deck]);
      setStats((prev) => ({
        ...prev,
        [deck.id]: { deckId: deck.id, itemCount: 0, masteryPercent: 0, masteryLabel: "keine Karten" },
      }));
      setNewDeckName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Erstellen");
    }
  }

  async function handleRenameDeck(id: string) {
    if (!renameValue.trim()) return;
    try {
      const updated = await api.renameDeck(id, renameValue.trim());
      setDecks((prev) => prev.map((d) => (d.id === id ? updated : d)));
      setRenamingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Umbenennen");
    }
  }

  async function handleDeleteDeck(id: string) {
    try {
      await api.deleteDeck(id);
      setDecks((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    } finally {
      setDeleteTarget(null);
    }
  }

  if (loading) return <p>Lade...</p>;
  if (!project) return <div className="empty-state">Projekt nicht gefunden. <Link to="/">Zurück</Link></div>;

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/">Projekte</Link>
      </div>
      <div className="topbar">
        <h1>{project.name}</h1>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <input
          type="text"
          placeholder="Neuer Stapel..."
          value={newDeckName}
          onChange={(e) => setNewDeckName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateDeck()}
        />
        <button className="primary" onClick={handleCreateDeck}>
          Stapel anlegen
        </button>
        <button
          disabled={decks.length === 0}
          onClick={() => navigate(`/study/project/${project.id}`)}
        >
          Alle Stapel gemischt lernen
        </button>
        <a className="button" href={api.exportProjectUrl(project.id)}>
          Projekt exportieren (ZIP)
        </a>
      </div>

      {decks.length === 0 ? (
        <div className="empty-state">Noch keine Stapel. Lege deinen ersten Stapel an.</div>
      ) : (
        <div className="list">
          {decks.map((deck) => (
            <div className="card-item" key={deck.id}>
              <div className="card-item-main">
                {renamingId === deck.id ? (
                  <input
                    type="text"
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRenameDeck(deck.id)}
                    onBlur={() => handleRenameDeck(deck.id)}
                  />
                ) : (
                  <Link to={`/decks/${deck.id}`} className="card-item-title">
                    {deck.name}
                  </Link>
                )}
                <MasteryBar stats={stats[deck.id]} />
              </div>
              <div className="card-item-actions">
                <button onClick={() => navigate(`/study/deck/${deck.id}`)}>Lernen</button>
                <button
                  onClick={() => {
                    setRenamingId(deck.id);
                    setRenameValue(deck.name);
                  }}
                >
                  Umbenennen
                </button>
                <button className="danger" onClick={() => setDeleteTarget(deck)}>
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Stapel "${deleteTarget.name}" inklusive aller Karten wirklich löschen?`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDeleteDeck(deleteTarget.id)}
        />
      )}
    </div>
  );
}
