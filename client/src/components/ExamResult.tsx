import { useLocale } from "../i18n";
import type { Exam, ExamTask } from "../types";
import Markdown from "./Markdown";

export default function ExamResult({ exam }: { exam: Exam }) {
  const { t } = useLocale();
  if (!exam.paper || !exam.result) return null;
  const { paper, result } = exam;
  const answers = exam.answers ?? {};
  const byTask = new Map(result.taskResults.map((r) => [r.taskId, r]));

  const pct =
    result.totalPoints > 0 ? Math.round((result.totalAwarded / result.totalPoints) * 100) : 0;

  function optionClass(task: ExamTask, opt: string): string {
    const chosen = answers[task.id] === opt;
    const correct = task.expected === opt;
    if (correct) return "correct";
    if (chosen) return "wrong";
    return "";
  }

  return (
    <div className="exam-result">
      <div className="exam-score">
        <span className="exam-score-value">
          {result.totalAwarded} / {result.totalPoints}
        </span>
        <span className="exam-score-pct">{pct} %</span>
      </div>

      {result.feedback && (
        <div className="exam-feedback">
          <h4>{t("exam.feedback")}</h4>
          <Markdown>{result.feedback}</Markdown>
        </div>
      )}

      <div className="exam-result-tasks">
        {paper.tasks.map((task, i) => {
          const r = byTask.get(task.id);
          const answer = answers[task.id];
          return (
            <div className="exam-result-task" key={task.id}>
              <div className="exam-task-head">
                <span>{t("exam.taskN", { n: i + 1, total: paper.tasks.length })}</span>
                <span className="exam-task-points">
                  {r?.awardedPoints ?? 0} / {task.points} {t("exam.pointsUnit")}
                </span>
              </div>
              <div className="exam-task-prompt">
                <Markdown>{task.prompt}</Markdown>
              </div>

              {task.format === "mc" && task.options ? (
                <div className="exam-mc">
                  {task.options.map((opt, k) => (
                    <div key={k} className={`exam-mc-option ${optionClass(task, opt)}`}>
                      <Markdown>{opt}</Markdown>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="exam-result-answer">
                  <div className="exam-result-label">{t("exam.yourAnswer")}</div>
                  <div className="exam-result-text">{answer?.trim() || t("exam.noAnswer")}</div>
                  {task.expected && (
                    <>
                      <div className="exam-result-label">{t("exam.expected")}</div>
                      <div className="exam-result-text muted">
                        <Markdown>{task.expected}</Markdown>
                      </div>
                    </>
                  )}
                </div>
              )}

              {r?.comment && <div className="exam-result-comment">{r.comment}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
