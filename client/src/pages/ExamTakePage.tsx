import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import ConfirmDialog from "../components/ConfirmDialog";
import Markdown from "../components/Markdown";
import { useLocale } from "../i18n";
import type { Exam } from "../types";

/** Sekunden Kulanz nach Zeitablauf, um den letzten Satz zu Ende zu schreiben. */
const GRACE_SECONDS = 20;
const AUTOSAVE_MS = 1500;

function storageKey(id: string): string {
  return `flashy-exam-${id}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function ExamTakePage() {
  const { t } = useLocale();
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0); // 0 = Deckblatt, 1..N = Aufgaben
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const saveTimer = useRef<number | null>(null);
  const loaded = useRef(false);

  // Prüfung laden; nur laufende Prüfungen sind bearbeitbar.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!examId) return;
      try {
        const e = await api.getExam(examId);
        if (cancelled) return;
        if (e.status !== "in_progress") {
          navigate(`/exam/${examId}`, { replace: true });
          return;
        }
        // Lokales Backup (nach Reload/Absturz) hat Vorrang vor dem Serverstand.
        let initial = e.answers ?? {};
        try {
          const backup = localStorage.getItem(storageKey(examId));
          if (backup) initial = { ...initial, ...JSON.parse(backup) };
        } catch {
          // Kaputtes Backup ignorieren.
        }
        setExam(e);
        setAnswers(initial);
        loaded.current = true;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("error.load"));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  // Sekundentakt für den Timer.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const flush = useCallback(async () => {
    if (!examId || !loaded.current) return;
    try {
      await api.saveExamAnswers(examId, answersRef.current);
    } catch {
      // Nächster Speicherlauf versucht es erneut; lokal ist gesichert.
    }
  }, [examId]);

  // Debounced-Autosave bei Antwortänderung.
  useEffect(() => {
    if (!loaded.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, AUTOSAVE_MS);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [answers, flush]);

  // Beim Verlassen der Seite noch sichern.
  useEffect(() => () => void flush(), [flush]);

  function setAnswer(taskId: string, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [taskId]: value };
      if (examId) {
        try {
          localStorage.setItem(storageKey(examId), JSON.stringify(next));
        } catch {
          // Kein localStorage verfügbar -- Serverspeicher genügt.
        }
      }
      return next;
    });
  }

  async function handleSubmit() {
    setConfirmSubmit(false);
    if (!examId) return;
    setSubmitting(true);
    try {
      await api.submitExam(examId, answersRef.current);
      localStorage.removeItem(storageKey(examId));
      navigate(`/exam/${examId}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.save"));
      setSubmitting(false);
    }
  }

  if (error) return <div className="error-banner">{error}</div>;
  if (!exam || !exam.paper) return <p>{t("common.loading")}</p>;

  const paper = exam.paper;
  const endTime = exam.startedAt ? Date.parse(exam.startedAt) + exam.durationSeconds * 1000 : 0;
  const remainingMs = endTime - now;
  const phase = remainingMs > 0 ? "running" : remainingMs > -GRACE_SECONDS * 1000 ? "grace" : "locked";
  const locked = phase === "locked";

  const displaySeconds =
    phase === "running"
      ? Math.ceil(remainingMs / 1000)
      : phase === "grace"
        ? Math.ceil((remainingMs + GRACE_SECONDS * 1000) / 1000)
        : 0;
  const timeLabel = `${pad(Math.floor(displaySeconds / 60))}:${pad(displaySeconds % 60)}`;

  const totalPages = paper.tasks.length + 1;
  const task = page > 0 ? paper.tasks[page - 1] : null;

  return (
    <div className="exam-take">
      <header className={`exam-take-bar ${phase !== "running" ? "warn" : ""}`}>
        <span className="exam-take-title">{exam.title}</span>
        <span className={`exam-timer ${phase !== "running" ? "warn" : ""}`}>
          {phase === "grace" ? t("exam.graceTimer", { time: timeLabel }) : timeLabel}
        </span>
        <button className="primary" onClick={() => setConfirmSubmit(true)} disabled={submitting}>
          {t("exam.submit")}
        </button>
      </header>

      {phase === "grace" && <div className="exam-banner warn">{t("exam.timeUpGrace")}</div>}
      {locked && <div className="exam-banner danger">{t("exam.timeUpLocked")}</div>}

      <div className="exam-page">
        {page === 0 ? (
          <div className="exam-cover exam-cover-sheet">
            <h1>{paper.subject || exam.title}</h1>
            <div className="exam-cover-row">
              <span>{t("exam.topics")}</span>
              <strong>{paper.topicNames.join(", ") || "—"}</strong>
            </div>
            <div className="exam-cover-row">
              <span>{t("exam.totalPoints")}</span>
              <strong>{paper.totalPoints}</strong>
            </div>
            <div className="exam-cover-row">
              <span>{t("exam.duration")}</span>
              <strong>{t("exam.minutes", { count: Math.round(exam.durationSeconds / 60) })}</strong>
            </div>
            <div className="exam-cover-row">
              <span>{t("exam.aids")}</span>
              <strong>{paper.allowedAids || "—"}</strong>
            </div>
            <div className="exam-cover-row">
              <span>{t("exam.taskCount")}</span>
              <strong>{paper.tasks.length}</strong>
            </div>
            <p className="mastery-caption">{t("exam.coverHint")}</p>
          </div>
        ) : task ? (
          <div className="exam-task">
            <div className="exam-task-head">
              <span>{t("exam.taskN", { n: page, total: paper.tasks.length })}</span>
              <span className="exam-task-points">{t("exam.points", { count: task.points })}</span>
            </div>
            <div className="exam-task-prompt">
              <Markdown>{task.prompt}</Markdown>
            </div>

            {task.format === "mc" && task.options ? (
              <div className="exam-mc">
                {task.options.map((opt, i) => (
                  <label key={i} className={`exam-mc-option ${answers[task.id] === opt ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name={task.id}
                      checked={answers[task.id] === opt}
                      disabled={locked}
                      onChange={() => setAnswer(task.id, opt)}
                    />
                    <Markdown>{opt}</Markdown>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="exam-answer"
                value={answers[task.id] ?? ""}
                readOnly={locked}
                placeholder={t("exam.answerPlaceholder")}
                onChange={(e) => setAnswer(task.id, e.target.value)}
              />
            )}
          </div>
        ) : null}
      </div>

      <nav className="exam-nav">
        <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          {t("exam.prevPage")}
        </button>
        <span className="exam-page-indicator">
          {t("exam.pageOf", { page: page + 1, total: totalPages })}
        </span>
        {page < totalPages - 1 ? (
          <button className="primary" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
            {t("exam.nextPage")}
          </button>
        ) : (
          <button className="primary" onClick={() => setConfirmSubmit(true)} disabled={submitting}>
            {t("exam.submit")}
          </button>
        )}
      </nav>

      {confirmSubmit && (
        <ConfirmDialog
          message={t("exam.submitConfirm")}
          confirmLabel={t("exam.submit")}
          danger={false}
          onCancel={() => setConfirmSubmit(false)}
          onConfirm={handleSubmit}
        />
      )}
    </div>
  );
}
