import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { cardToStudyItems, StudyQueue, type StudyItem } from "../lib/studyQueue";
import type { Card } from "../types";

interface Props {
  mode: "deck" | "project";
}

export default function StudyPage({ mode }: Props) {
  const { deckId, projectId } = useParams<{ deckId: string; projectId: string }>();
  const backTo = mode === "deck" ? `/decks/${deckId}` : `/projects/${projectId}`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<StudyQueue | null>(null);
  const [current, setCurrent] = useState<StudyItem | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let cards: Card[];
        if (mode === "deck" && deckId) {
          cards = await api.listCards(deckId);
        } else if (mode === "project" && projectId) {
          cards = await api.studyProjectCards(projectId);
        } else {
          cards = [];
        }
        const items = cards.flatMap(cardToStudyItems);
        const q = new StudyQueue(items);
        setQueue(q);
        setCurrent(q.next());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, deckId, projectId]);

  async function handleAnswer(correct: boolean) {
    if (!current || !queue) return;
    try {
      await api.answerCard(current.cardId, current.direction, correct);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Antwort konnte nicht gespeichert werden");
    }
    queue.updateItem(current.cardId, current.direction, correct);
    setAnswered((n) => n + 1);
    if (correct) setCorrectCount((n) => n + 1);
    setFlipped(false);
    setCurrent(queue.next());
  }

  const accuracy = useMemo(
    () => (answered === 0 ? 0 : Math.round((correctCount / answered) * 100)),
    [answered, correctCount]
  );

  if (loading) return <p>Lade...</p>;

  return (
    <div>
      <div className="breadcrumb">
        <Link to={backTo}>Zurück</Link>
      </div>
      {error && <div className="error-banner">{error}</div>}

      {!queue || queue.size === 0 ? (
        <div className="empty-state">Keine Karten zum Lernen vorhanden.</div>
      ) : (
        <>
          <div className="study-header">
            <span>{queue.size} Lern-Items im Umlauf</span>
            <span>
              Beantwortet: {answered} &middot; Richtig: {correctCount} ({accuracy}%)
            </span>
          </div>

          {current && (
            <>
              <div className="study-card" onClick={() => setFlipped((f) => !f)}>
                <div>
                  {flipped ? current.back : current.front}
                  <div className="study-card-hint">
                    {flipped ? "" : "Klicken zum Umdrehen"}
                  </div>
                </div>
              </div>

              {flipped ? (
                <div className="study-answer-row">
                  <button className="danger" onClick={() => handleAnswer(false)}>
                    Falsch
                  </button>
                  <button className="primary" onClick={() => handleAnswer(true)}>
                    Richtig
                  </button>
                </div>
              ) : (
                <div className="study-answer-row">
                  <button className="primary" onClick={() => setFlipped(true)}>
                    Umdrehen
                  </button>
                </div>
              )}
            </>
          )}

          <div className="toolbar" style={{ marginTop: 24, justifyContent: "center" }}>
            <Link to={backTo} className="button">
              Session beenden
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
