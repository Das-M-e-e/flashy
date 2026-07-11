import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import Avatar from "../components/Avatar";
import CardConfidence from "../components/CardConfidence";
import CardControls, { DEFAULT_FILTER, useFilteredCards, type CardFilterState } from "../components/CardControls";
import CardEditorModal from "../components/CardEditorModal";
import ConfirmDialog from "../components/ConfirmDialog";
import DistributionBar from "../components/DistributionBar";
import ProgressRing from "../components/ProgressRing";
import { useLocale } from "../i18n";
import { hasImage, plainExcerpt } from "../lib/markdown";
import type { Card, Deck, DeckStats } from "../types";

export default function DeckPage() {
  const { t } = useLocale();
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
  const [filter, setFilter] = useState<CardFilterState>(DEFAULT_FILTER);

  const visibleCards = useFilteredCards(cards, filter);

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
      setError(err instanceof Error ? err.message : t("error.load"));
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
      setError(err instanceof Error ? err.message : t("error.delete"));
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
      setError(err instanceof Error ? err.message : t("error.import"));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) return <p>{t("common.loading")}</p>;

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/">{t("nav.projects")}</Link>
        {deck && (
          <>
            <span className="dot">›</span>
            <Link to={`/projects/${deck.projectId}`}>{t("deck.fallbackTitle")}</Link>
          </>
        )}
      </div>

      <div className="deck-hero">
        <Avatar name={deck?.name || t("deck.fallbackTitle")} size={52} />
        <div className="deck-hero-main">
          <h1>{deck?.name || t("deck.fallbackTitle")}</h1>
          {stats && stats.itemCount > 0 ? (
            <>
              <div className="mastery-caption">
                {t("mastery.secure", { percent: stats.masteryPercent })} · {t(`mastery.${stats.masteryLabel}`)}
              </div>
              <DistributionBar buckets={stats.buckets} showLegend />
            </>
          ) : (
            <div className="mastery-caption">{t("mastery.empty")}</div>
          )}
        </div>
        <div className="entity-viz">
          <ProgressRing
            percent={stats?.masteryPercent ?? 0}
            size={72}
            stroke={8}
            empty={!stats || stats.itemCount === 0}
          />
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <button className="primary" onClick={() => setEditingCard("new")}>
          {t("deck.addCard")}
        </button>
        <button disabled={cards.length === 0} onClick={() => navigate(`/study/deck/${deckId}`)}>
          {t("deck.study")}
        </button>
        <button onClick={() => fileInputRef.current?.click()}>{t("deck.importCsv")}</button>
        <input
          type="file"
          accept=".csv,text/csv"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleImport}
        />
        {deckId && (
          <a className="button" href={api.exportDeckUrl(deckId)}>
            {t("deck.exportCsv")}
          </a>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="empty-state">{t("deck.empty")}</div>
      ) : (
        <>
          <CardControls value={filter} onChange={setFilter} />
          {visibleCards.length === 0 ? (
            <div className="empty-state">{t("cards.noMatches")}</div>
          ) : (
            <div className="list">
              {visibleCards.map((card) => (
                <div className="flashcard-row" key={card.id}>
                  <CardConfidence card={card} />
                  <div className="flashcard-text">
                    <div className="flashcard-front">
                      {hasImage(card.front) && <span className="image-mark" title={t("card.hasImage")} />}
                      {plainExcerpt(card.front)}
                    </div>
                    <div className="flashcard-back">
                      {hasImage(card.back) && <span className="image-mark" title={t("card.hasImage")} />}
                      {plainExcerpt(card.back)}
                    </div>
                  </div>
                  <span className={card.bidirectional ? "badge bi" : "badge"}>
                    {card.bidirectional ? t("card.bidirectional") : t("card.oneway")}
                  </span>
                  <div className="entity-actions">
                    <button onClick={() => setEditingCard(card)}>{t("common.edit")}</button>
                    <button className="danger" onClick={() => setDeleteTarget(card)}>
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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
          message={t("card.deleteConfirm", { front: plainExcerpt(deleteTarget.front, 60) })}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDeleteCard(deleteTarget.id)}
        />
      )}
    </div>
  );
}
