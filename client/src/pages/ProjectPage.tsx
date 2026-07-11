import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import Avatar from "../components/Avatar";
import ConfirmDialog from "../components/ConfirmDialog";
import DistributionBar from "../components/DistributionBar";
import NameDialog from "../components/NameDialog";
import ProgressRing from "../components/ProgressRing";
import { useLocale } from "../i18n";
import type { Deck, DeckStats, Project, ProjectStats } from "../types";

const EMPTY_BUCKETS = { new: 0, learning: 0, known: 0, mastered: 0 };

export default function ProjectPage() {
  const { t } = useLocale();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [stats, setStats] = useState<Record<string, DeckStats>>({});
  const [projectStats, setProjectStats] = useState<ProjectStats | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Deck | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Deck | null>(null);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    try {
      const [projects, deckList, projStats] = await Promise.all([
        api.listProjects(),
        api.listDecks(projectId),
        api.projectStats(projectId),
      ]);
      setProject(projects.find((p) => p.id === projectId) ?? null);
      setDecks(deckList);
      setProjectStats(projStats);
      const statEntries = await Promise.all(
        deckList.map(async (deck) => [deck.id, await api.deckStats(deck.id)] as const)
      );
      setStats(Object.fromEntries(statEntries));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function refreshDeckStats(deckId: string) {
    api.deckStats(deckId).then((s) => setStats((prev) => ({ ...prev, [deckId]: s })));
  }

  async function handleCreateDeck(name: string) {
    if (!projectId) return;
    const deck = await api.createDeck(projectId, name);
    setDecks((prev) => [...prev, deck]);
    setStats((prev) => ({
      ...prev,
      [deck.id]: { deckId: deck.id, itemCount: 0, masteryPercent: 0, masteryLabel: "empty", buckets: EMPTY_BUCKETS },
    }));
    setCreating(false);
  }

  async function handleRenameDeck(id: string, name: string) {
    const updated = await api.renameDeck(id, name);
    setDecks((prev) => prev.map((d) => (d.id === id ? updated : d)));
    setRenameTarget(null);
  }

  async function handleDeleteDeck(id: string) {
    try {
      await api.deleteDeck(id);
      setDecks((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.delete"));
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleImportDeck(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    try {
      const deckName = file.name.replace(/\.[^.]+$/, "") || t("deck.fallbackTitle");
      const deck = await api.createDeck(projectId, deckName);
      await api.importDeck(deck.id, file);
      setDecks((prev) => [...prev, deck]);
      refreshDeckStats(deck.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.import"));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) return <p>{t("common.loading")}</p>;
  if (!project)
    return (
      <div className="empty-state">
        {t("project.notFound")} <Link to="/">{t("common.back")}</Link>
      </div>
    );

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/">{t("nav.projects")}</Link>
      </div>
      <div className="summary-hero">
        <Avatar name={project.name} size={52} />
        <div className="summary-hero-main">
          <h1>{project.name}</h1>
          {projectStats && projectStats.itemCount > 0 ? (
            <>
              <div className="mastery-caption">
                {t("mastery.secure", { percent: projectStats.masteryPercent })} ·{" "}
                {t(`mastery.${projectStats.masteryLabel}`)} ·{" "}
                {projectStats.deckCount === 1
                  ? t("stats.decks.one")
                  : t("stats.decks", { count: projectStats.deckCount })}{" "}
                ·{" "}
                {projectStats.itemCount === 1
                  ? t("stats.cards.one")
                  : t("stats.cards", { count: projectStats.itemCount })}
              </div>
              <DistributionBar buckets={projectStats.buckets} showLegend />
            </>
          ) : (
            <div className="mastery-caption">{t("mastery.empty")}</div>
          )}
        </div>
        <div className="entity-viz">
          <ProgressRing
            percent={projectStats?.masteryPercent ?? 0}
            size={72}
            stroke={8}
            empty={!projectStats || projectStats.itemCount === 0}
          />
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <button className="primary" onClick={() => setCreating(true)}>
          {t("project.newDeck")}
        </button>
        <button onClick={() => fileInputRef.current?.click()}>{t("project.importDeck")}</button>
        <input
          type="file"
          accept=".csv,text/csv"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleImportDeck}
        />
        <button disabled={decks.length === 0} onClick={() => navigate(`/study/project/${project.id}`)}>
          {t("project.studyAll")}
        </button>
        <a className="button" href={api.exportProjectUrl(project.id)}>
          {t("project.exportZip")}
        </a>
      </div>

      {decks.length === 0 ? (
        <div className="empty-state">{t("project.empty")}</div>
      ) : (
        <div className="list">
          {decks.map((deck) => {
            const s = stats[deck.id];
            return (
              <div className="entity-card" key={deck.id}>
                <Avatar name={deck.name} />
                <div className="entity-main">
                  <Link to={`/decks/${deck.id}`} className="entity-title">
                    {deck.name}
                  </Link>
                  <div className="entity-meta">
                    <span>
                      {s?.itemCount === 1
                        ? t("stats.cards.one")
                        : t("stats.cards", { count: s?.itemCount ?? 0 })}
                    </span>
                    {s && s.itemCount > 0 && (
                      <>
                        <span className="dot">·</span>
                        <span>{t("mastery.secure", { percent: s.masteryPercent })}</span>
                      </>
                    )}
                  </div>
                  {s && s.itemCount > 0 && <DistributionBar buckets={s.buckets} />}
                </div>
                <div className="entity-viz">
                  <ProgressRing percent={s?.masteryPercent ?? 0} empty={!s || s.itemCount === 0} />
                </div>
                <div className="entity-actions">
                  <button onClick={() => navigate(`/study/deck/${deck.id}`)}>{t("common.study")}</button>
                  <button onClick={() => setRenameTarget(deck)}>{t("common.rename")}</button>
                  <button className="danger" onClick={() => setDeleteTarget(deck)}>
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
          title={t("project.newDeckTitle")}
          label={t("project.deckNameLabel")}
          placeholder={t("project.deckNamePlaceholder")}
          submitLabel={t("common.create")}
          onCancel={() => setCreating(false)}
          onSubmit={handleCreateDeck}
        />
      )}

      {renameTarget && (
        <NameDialog
          title={t("project.renameDeckTitle")}
          label={t("project.deckNameLabel")}
          initialValue={renameTarget.name}
          onCancel={() => setRenameTarget(null)}
          onSubmit={(name) => handleRenameDeck(renameTarget.id, name)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={t("project.deckDeleteConfirm", { name: deleteTarget.name })}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDeleteDeck(deleteTarget.id)}
        />
      )}
    </div>
  );
}
