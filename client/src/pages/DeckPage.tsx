import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import CardEditorModal from "../components/CardEditorModal";
import ConfirmDialog from "../components/ConfirmDialog";
import MasteryBar from "../components/MasteryBar";
import type { Card, Deck, DeckStats } from "../types";

export default function DeckPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [stats, setStats] = useState<DeckStats | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<Card | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Card | null>(null);

  async function load() {
    if (!deckId) return;
    setLoading(true);
    try {
      const [deckInfo, cardList, deckStats] = await Promise.all([
        api.getDeck(deckId),
        api.listCards(deckId),
        api.deckStats(deckId),
      ]);
      setDeck(deckInfo);
      setCards(cardList);
      setStats(deckStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  async function handleSaveCard(front: string, back: string, bidirectional: boolean) {
    if (!deckId) return;
    if (editingCard === "new") {
      const card = await api.createCard(deckId, front, back, bidirectional);
      setCards((prev) => [...prev, card]);
    } else if (editingCard) {
      const card = await api.updateCard(editingCard.id, front, back, bidirectional);
      setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
    }
    setEditingCard(null);
    if (deckId) api.deckStats(deckId).then(setStats);
  }

  async function handleDeleteCard(id: string) {
    try {
      await api.deleteCard(id);
      setCards((prev) => prev.filter((c) => c.id !== id));
      if (deckId) api.deckStats(deckId).then(setStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !deckId) return;
    try {
      const result = await api.importDeck(deckId, file);
      setCards(result.cards);
      api.deckStats(deckId).then(setStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import fehlgeschlagen");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) return <p>Lade...</p>;

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/">Projekte</Link>
        {deck && <> &rsaquo; <Link to={`/projects/${deck.projectId}`}>Projekt</Link></>}
      </div>
      <div className="topbar">
        <h1>{deck?.name || "Stapel"}</h1>
      </div>
      {stats && <MasteryBar stats={stats} />}
      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar" style={{ marginTop: 16 }}>
        <button className="primary" onClick={() => setEditingCard("new")}>
          Karte hinzufügen
        </button>
        <button disabled={cards.length === 0} onClick={() => navigate(`/study/deck/${deckId}`)}>
          Stapel lernen
        </button>
        <button onClick={() => fileInputRef.current?.click()}>CSV importieren</button>
        <input
          type="file"
          accept=".csv,text/csv"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleImport}
        />
        {deckId && (
          <a className="button" href={api.exportDeckUrl(deckId)}>
            CSV exportieren
          </a>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="empty-state">Noch keine Karten. Füge manuell welche hinzu oder importiere eine CSV-Datei.</div>
      ) : (
        <div className="list">
          {cards.map((card) => (
            <div className="card-item" key={card.id}>
              <div className="card-item-main">
                <div className="card-item-title">{card.front}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{card.back}</div>
              </div>
              <span className="badge">{card.bidirectional ? "bidirektional" : "einseitig"}</span>
              <div className="card-item-actions">
                <button onClick={() => setEditingCard(card)}>Bearbeiten</button>
                <button className="danger" onClick={() => setDeleteTarget(card)}>
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingCard && (
        <CardEditorModal
          initial={editingCard === "new" ? undefined : editingCard}
          onCancel={() => setEditingCard(null)}
          onSave={handleSaveCard}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Karte "${deleteTarget.front}" wirklich löschen?`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDeleteCard(deleteTarget.id)}
        />
      )}
    </div>
  );
}
