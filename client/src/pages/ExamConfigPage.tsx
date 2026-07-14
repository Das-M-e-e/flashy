import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useLocale } from "../i18n";
import { plainExcerpt } from "../lib/markdown";
import type { Card, Deck, ExamConfig } from "../types";

interface Props {
  mode: "deck" | "project";
}

export default function ExamConfigPage({ mode }: Props) {
  const { t, lang } = useLocale();
  const { deckId, projectId } = useParams<{ deckId: string; projectId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [llmReady, setLlmReady] = useState(true);

  const [decks, setDecks] = useState<Deck[]>([]); // Projektmodus: wählbare Themen
  const [cards, setCards] = useState<Card[]>([]); // Deckmodus: wählbare Karten
  const [scopeName, setScopeName] = useState("");
  const [backTo, setBackTo] = useState("/");

  // Formularzustand
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [allowedAids, setAllowedAids] = useState("");
  const [language, setLanguage] = useState<"de" | "en">(lang);
  const [durationMin, setDurationMin] = useState(60);
  const [totalPoints, setTotalPoints] = useState(100);
  const [transferPct, setTransferPct] = useState(30);
  const [answerFormat, setAnswerFormat] = useState<"text" | "mc" | "mixed">("mixed");
  const [mcPct, setMcPct] = useState(40);

  const [selectedDecks, setSelectedDecks] = useState<Set<string>>(new Set());
  const [perTopicPoints, setPerTopicPoints] = useState(false);
  const [topicPoints, setTopicPoints] = useState<Record<string, number>>({});

  const [excludedCards, setExcludedCards] = useState<Set<string>>(new Set());
  const [directCards, setDirectCards] = useState<Set<string>>(new Set());
  const [showCards, setShowCards] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setLlmReady((await api.llmConfig()).configured);
        if (mode === "project" && projectId) {
          const projects = await api.listProjects();
          const project = projects.find((p) => p.id === projectId);
          setScopeName(project?.name ?? "");
          setSubject(project?.name ?? "");
          setBackTo(`/projects/${projectId}`);
          const deckList = await api.listDecks(projectId);
          setDecks(deckList);
          setSelectedDecks(new Set(deckList.map((d) => d.id)));
        } else if (mode === "deck" && deckId) {
          const deck = await api.getDeck(deckId);
          setScopeName(deck.name);
          setSubject(deck.name);
          setBackTo(`/decks/${deckId}`);
          setCards(await api.listCards(deckId));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("error.load"));
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, deckId, projectId]);

  const activeDeckCards = useMemo(
    () => cards.filter((c) => !excludedCards.has(c.id)),
    [cards, excludedCards]
  );

  function toggle(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  }

  async function handleCreate() {
    setError(null);
    const deckIds = mode === "project" ? [...selectedDecks] : deckId ? [deckId] : [];
    if (deckIds.length === 0) {
      setError(t("exam.needTopic"));
      return;
    }

    const topics =
      mode === "project"
        ? decks
            .filter((d) => selectedDecks.has(d.id))
            .map((d) => ({
              deckId: d.id,
              name: d.name,
              points: perTopicPoints ? (topicPoints[d.id] ?? 0) : null,
            }))
        : [];

    const config: ExamConfig = {
      deckIds,
      cardIds:
        mode === "deck" && excludedCards.size > 0
          ? activeDeckCards.map((c) => c.id)
          : null,
      topics,
      transferRatio: transferPct / 100,
      directCardIds: [...directCards],
      answerFormat,
      mcRatio: mcPct / 100,
      durationSeconds: Math.max(60, Math.round(durationMin * 60)),
      totalPoints: Math.max(1, Math.round(totalPoints)),
      perTopicPoints: mode === "project" && perTopicPoints,
      subject: subject.trim(),
      allowedAids: allowedAids.trim(),
      language,
    };

    const body = { title: title.trim() || t("exam.defaultTitle"), config };
    setBusy(true);
    try {
      const exam =
        mode === "project" && projectId
          ? await api.createProjectExam(projectId, body)
          : await api.createDeckExam(deckId!, body);
      navigate(`/exam/${exam.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.create"));
      setBusy(false);
    }
  }

  if (loading) return <p>{t("common.loading")}</p>;

  return (
    <div className="exam-config">
      <div className="breadcrumb">
        <Link to={backTo}>{t("common.back")}</Link>
      </div>

      <h1>{t("exam.createTitle")}</h1>
      <p className="mastery-caption">{scopeName}</p>

      {!llmReady && <div className="error-banner">{t("exam.noLlm")}</div>}
      {error && <div className="error-banner">{error}</div>}

      <section className="sync-section">
        <label>
          {t("exam.title")}
          <input
            type="text"
            value={title}
            placeholder={t("exam.defaultTitle")}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          {t("exam.subject")}
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label>
          {t("exam.language")}
          <select value={language} onChange={(e) => setLanguage(e.target.value as "de" | "en")}>
            <option value="de">{t("lang.de")}</option>
            <option value="en">{t("lang.en")}</option>
          </select>
        </label>
      </section>

      {/* Themen / Karten */}
      {mode === "project" ? (
        <section className="sync-section">
          <h4>{t("exam.topics")}</h4>
          {decks.length === 0 && <p className="mastery-caption">{t("project.empty")}</p>}
          {decks.map((d) => (
            <div className="exam-topic-row" key={d.id}>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedDecks.has(d.id)}
                  onChange={() => setSelectedDecks((s) => toggle(s, d.id))}
                />
                {d.name}
              </label>
              {perTopicPoints && selectedDecks.has(d.id) && (
                <input
                  type="number"
                  min={0}
                  className="exam-points-input"
                  value={topicPoints[d.id] ?? 0}
                  onChange={(e) =>
                    setTopicPoints((p) => ({ ...p, [d.id]: Math.max(0, Number(e.target.value) || 0) }))
                  }
                />
              )}
            </div>
          ))}
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={perTopicPoints}
              onChange={(e) => setPerTopicPoints(e.target.checked)}
            />
            {t("exam.perTopicPoints")}
          </label>
        </section>
      ) : (
        <section className="sync-section">
          <h4>{t("exam.cards")}</h4>
          <button onClick={() => setShowCards((v) => !v)}>
            {showCards ? t("exam.hideCards") : t("exam.pickCards", { count: activeDeckCards.length })}
          </button>
          {showCards && (
            <div className="exam-card-list">
              {cards.map((c) => (
                <div className="exam-card-row" key={c.id}>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={!excludedCards.has(c.id)}
                      onChange={() => setExcludedCards((s) => toggle(s, c.id))}
                    />
                    {plainExcerpt(c.front, 70)}
                  </label>
                  <label className="checkbox-row exam-direct">
                    <input
                      type="checkbox"
                      checked={directCards.has(c.id)}
                      disabled={excludedCards.has(c.id)}
                      onChange={() => setDirectCards((s) => toggle(s, c.id))}
                    />
                    {t("exam.direct")}
                  </label>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Fragetyp-Mix */}
      <section className="sync-section">
        <h4>{t("exam.questionMix")}</h4>
        <label>
          {t("exam.transfer", { direct: 100 - transferPct, transfer: transferPct })}
          <input
            type="range"
            min={0}
            max={100}
            value={transferPct}
            onChange={(e) => setTransferPct(Number(e.target.value))}
          />
        </label>

        <h4>{t("exam.answerFormat")}</h4>
        <div className="exam-format-choices">
          {(["text", "mixed", "mc"] as const).map((f) => (
            <label className="checkbox-row" key={f}>
              <input
                type="radio"
                name="answerFormat"
                checked={answerFormat === f}
                onChange={() => setAnswerFormat(f)}
              />
              {t(`exam.format.${f}`)}
            </label>
          ))}
        </div>
        {answerFormat === "mixed" && (
          <label>
            {t("exam.mcRatio", { pct: mcPct })}
            <input
              type="range"
              min={0}
              max={100}
              value={mcPct}
              onChange={(e) => setMcPct(Number(e.target.value))}
            />
          </label>
        )}
      </section>

      {/* Rahmen */}
      <section className="sync-section">
        <h4>{t("exam.frame")}</h4>
        <label>
          {t("exam.duration")}
          <input
            type="number"
            min={1}
            value={durationMin}
            onChange={(e) => setDurationMin(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <label>
          {t("exam.totalPoints")}
          <input
            type="number"
            min={1}
            value={totalPoints}
            onChange={(e) => setTotalPoints(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <label>
          {t("exam.aids")}
          <input type="text" value={allowedAids} onChange={(e) => setAllowedAids(e.target.value)} />
        </label>
      </section>

      <div className="modal-actions">
        <span className="spacer" />
        <Link to={backTo} className="button">
          {t("common.cancel")}
        </Link>
        <button className="primary" onClick={handleCreate} disabled={busy || !llmReady}>
          {busy ? t("exam.creating") : t("exam.create")}
        </button>
      </div>
    </div>
  );
}
