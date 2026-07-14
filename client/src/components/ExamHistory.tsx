import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useLocale, type TranslateKey } from "../i18n";
import type { Exam, ExamStatus } from "../types";
import ConfirmDialog from "./ConfirmDialog";

const STATUS_KEY: Record<ExamStatus, TranslateKey> = {
  draft: "exam.st.draft",
  generating: "exam.st.generating",
  ready: "exam.st.ready",
  in_progress: "exam.st.inProgress",
  submitted: "exam.st.submitted",
  grading: "exam.st.grading",
  graded: "exam.st.graded",
  error: "exam.st.error",
};

interface Props {
  projectId?: string;
  deckId?: string;
}

export default function ExamHistory({ projectId, deckId }: Props) {
  const { t, lang } = useLocale();
  const [exams, setExams] = useState<Exam[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);

  async function load() {
    try {
      const list = deckId
        ? await api.listDeckExams(deckId)
        : projectId
          ? await api.listProjectExams(projectId)
          : [];
      setExams(list);
    } catch {
      // Stumm: Historie ist nachrangig.
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, deckId]);

  async function handleDelete(id: string) {
    setDeleteTarget(null);
    try {
      await api.deleteExam(id);
      setExams((prev) => prev.filter((e) => e.id !== id));
    } catch {
      load();
    }
  }

  if (exams.length === 0) return null;

  return (
    <section className="exam-history">
      <h3>{t("exam.history")}</h3>
      <div className="list">
        {exams.map((exam) => (
          <div className="exam-history-row" key={exam.id}>
            <Link to={`/exam/${exam.id}`} className="exam-history-main">
              <span className="exam-history-title">{exam.title}</span>
              <span className="exam-history-meta">
                {new Date(exam.createdAt).toLocaleDateString(lang)} · {t(STATUS_KEY[exam.status])}
                {exam.status === "graded" && exam.result
                  ? ` · ${exam.result.totalAwarded}/${exam.result.totalPoints}`
                  : ""}
              </span>
            </Link>
            <button className="danger" onClick={() => setDeleteTarget(exam)}>
              {t("common.delete")}
            </button>
          </div>
        ))}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          message={t("exam.deleteConfirm", { title: deleteTarget.title })}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}
    </section>
  );
}
