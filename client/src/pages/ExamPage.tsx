import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import ExamResult from "../components/ExamResult";
import { useLocale } from "../i18n";
import type { Exam } from "../types";

const POLL_MS = 2500;

/** Status-, Deckblatt- und Ergebnisansicht einer Prüfung. */
export default function ExamPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (!examId) return;
      try {
        const next = await api.getExam(examId);
        if (cancelled) return;
        setExam(next);
        if (next.status === "generating" || next.status === "grading") {
          timer.current = window.setTimeout(poll, POLL_MS);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("error.load"));
      }
    }
    poll();
    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  async function handleStart() {
    if (!examId) return;
    setBusy(true);
    try {
      await api.startExam(examId);
      navigate(`/exam/${examId}/take`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.save"));
      setBusy(false);
    }
  }

  async function handleGrade() {
    if (!examId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.gradeExam(examId);
      setExam(next);
      // Wieder in den Poll-Zyklus (Status grading).
      timer.current = window.setTimeout(async () => {
        try {
          setExam(await api.getExam(examId));
        } catch {
          /* nächster Render */
        }
      }, POLL_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.save"));
    } finally {
      setBusy(false);
    }
  }

  const backTo = exam
    ? exam.deckId
      ? `/decks/${exam.deckId}`
      : `/projects/${exam.projectId}`
    : "/";

  if (error && !exam) return <div className="error-banner">{error}</div>;
  if (!exam) return <p>{t("common.loading")}</p>;

  const minutes = Math.round(exam.durationSeconds / 60);
  const badge =
    exam.status === "graded"
      ? t("exam.graded")
      : exam.status === "in_progress"
        ? t("exam.inProgress")
        : exam.status === "submitted" || exam.status === "grading"
          ? t("exam.submitted")
          : t("exam.ready");

  return (
    <div className="exam-status">
      <div className="breadcrumb">
        <Link to={backTo}>{t("common.back")}</Link>
      </div>
      <h1>{exam.title}</h1>
      {error && <div className="error-banner">{error}</div>}

      {exam.status === "generating" && (
        <div className="exam-generating">
          <div className="spinner" />
          <p>{t("exam.generating")}</p>
        </div>
      )}

      {exam.status === "grading" && (
        <div className="exam-generating">
          <div className="spinner" />
          <p>{t("exam.gradingNow")}</p>
        </div>
      )}

      {exam.status === "error" && (
        <>
          <div className="error-banner">{exam.error ?? t("exam.genFailed")}</div>
          <Link to={backTo} className="button">
            {t("common.back")}
          </Link>
        </>
      )}

      {exam.status === "graded" && exam.paper ? (
        <ExamResult exam={exam} />
      ) : (
        (exam.status === "ready" ||
          exam.status === "in_progress" ||
          exam.status === "submitted") &&
        exam.paper && (
          <>
            <div className="exam-ready-badge">{badge}</div>
            <div className="exam-cover">
              <div className="exam-cover-row">
                <span>{t("exam.subject")}</span>
                <strong>{exam.paper.subject || "—"}</strong>
              </div>
              <div className="exam-cover-row">
                <span>{t("exam.topics")}</span>
                <strong>{exam.paper.topicNames.join(", ") || "—"}</strong>
              </div>
              <div className="exam-cover-row">
                <span>{t("exam.totalPoints")}</span>
                <strong>{exam.paper.totalPoints}</strong>
              </div>
              <div className="exam-cover-row">
                <span>{t("exam.duration")}</span>
                <strong>{t("exam.minutes", { count: minutes })}</strong>
              </div>
              <div className="exam-cover-row">
                <span>{t("exam.taskCount")}</span>
                <strong>{exam.paper.tasks.length}</strong>
              </div>
            </div>

            {exam.status === "submitted" && exam.error && (
              <div className="error-banner">{exam.error}</div>
            )}

            <div className="modal-actions">
              <span className="spacer" />
              {exam.status === "ready" && (
                <button className="primary" onClick={handleStart} disabled={busy}>
                  {t("exam.start")}
                </button>
              )}
              {exam.status === "in_progress" && (
                <button className="primary" onClick={() => navigate(`/exam/${exam.id}/take`)}>
                  {t("exam.resume")}
                </button>
              )}
              {exam.status === "submitted" && (
                <button className="primary" onClick={handleGrade} disabled={busy}>
                  {t("exam.gradeNow")}
                </button>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}
