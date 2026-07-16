import type {
  Card,
  CardInput,
  Deck,
  DeckStats,
  Direction,
  Exam,
  ExamConfig,
  GeneralConfigView,
  LlmConfigView,
  LlmProvider,
  Project,
  ProjectStats,
  RepoOption,
  SyncConfigView,
  SyncStatus,
} from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Anfrage fehlgeschlagen (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface ExportOptions {
  format: "flashy" | "genericJson" | "anki" | "quizlet" | "csv";
  cardTypes: string[] | null;
  fields: string[];
}

/** POSTet die Export-Optionen und löst den Datei-Download im Browser aus. */
async function downloadExport(url: string, opts: ExportOptions): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Export fehlgeschlagen (${res.status})`);
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : "export";
  const blob = await res.blob();
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export const api = {
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (name: string) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify({ name }) }),
  renameProject: (id: string, name: string) =>
    request<Project>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),
  exportProject: (id: string, opts: ExportOptions) => downloadExport(`/api/projects/${id}/export`, opts),
  importProject: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/projects/import`, { method: "POST", body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Import fehlgeschlagen (${res.status})`);
    }
    return res.json() as Promise<{ project: Project; decks: Deck[]; imported: number }>;
  },
  projectStats: (id: string) => request<ProjectStats>(`/api/projects/${id}/stats`),
  studyProjectCards: (id: string) => request<Card[]>(`/api/projects/${id}/study-cards`),

  listDecks: (projectId: string) => request<Deck[]>(`/api/projects/${projectId}/decks`),
  getDeck: (id: string) => request<Deck>(`/api/decks/${id}`),
  createDeck: (projectId: string, name: string) =>
    request<Deck>(`/api/projects/${projectId}/decks`, { method: "POST", body: JSON.stringify({ name }) }),
  renameDeck: (id: string, name: string) =>
    request<Deck>(`/api/decks/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteDeck: (id: string) => request<void>(`/api/decks/${id}`, { method: "DELETE" }),
  deckStats: (id: string) => request<DeckStats>(`/api/decks/${id}/stats`),
  exportDeck: (id: string, opts: ExportOptions) => downloadExport(`/api/decks/${id}/export`, opts),
  importDeck: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/decks/${id}/import`, { method: "POST", body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Import fehlgeschlagen (${res.status})`);
    }
    return res.json() as Promise<{ imported: number; cards: Card[] }>;
  },

  listCards: (deckId: string) => request<Card[]>(`/api/decks/${deckId}/cards`),
  createCard: (deckId: string, input: CardInput) =>
    request<Card>(`/api/decks/${deckId}/cards`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCard: (id: string, input: CardInput) =>
    request<Card>(`/api/cards/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteCard: (id: string) => request<void>(`/api/cards/${id}`, { method: "DELETE" }),
  exportCard: (id: string, opts: ExportOptions) => downloadExport(`/api/cards/${id}/export`, opts),
  answerCard: (id: string, direction: Direction, correct: boolean) =>
    request<Card>(`/api/cards/${id}/answer`, {
      method: "POST",
      body: JSON.stringify({ direction, correct }),
    }),

  // ---------- Sync ----------
  syncConfig: () => request<SyncConfigView>("/api/sync/config"),
  syncSaveToken: (token: string) =>
    request<{ login: string }>("/api/sync/token", { method: "POST", body: JSON.stringify({ token }) }),
  syncDeleteToken: () => request<void>("/api/sync/token", { method: "DELETE" }),
  syncRepos: () => request<RepoOption[]>("/api/sync/repos"),
  syncBranches: (owner: string, repo: string) =>
    request<string[]>(`/api/sync/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`),
  syncSaveConfig: (config: {
    owner: string;
    repo: string;
    branch: string;
    path: string;
    deviceName: string;
    autoSync: boolean;
    intervalMinutes: number;
  }) => request<SyncConfigView>("/api/sync/config", { method: "PUT", body: JSON.stringify(config) }),
  syncUnlink: () => request<SyncConfigView>("/api/sync/config", { method: "DELETE" }),
  syncStatus: () => request<SyncStatus>("/api/sync/status"),
  syncNow: () => request<SyncStatus>("/api/sync/now", { method: "POST", body: JSON.stringify({}) }),
  syncResolve: (choice: "local" | "remote") =>
    request<SyncStatus>("/api/sync/resolve", { method: "POST", body: JSON.stringify({ choice }) }),

  // ---------- LLM ----------
  llmConfig: () => request<LlmConfigView>("/api/llm/config"),
  llmSaveConfig: (config: { provider: LlmProvider; baseUrl: string; model: string }) =>
    request<LlmConfigView>("/api/llm/config", { method: "PUT", body: JSON.stringify(config) }),
  llmSaveKey: (key: string) =>
    request<LlmConfigView>("/api/llm/key", { method: "POST", body: JSON.stringify({ key }) }),
  llmClear: () => request<LlmConfigView>("/api/llm/config", { method: "DELETE" }),
  llmTest: () => request<{ ok: boolean; model: string }>("/api/llm/test", { method: "POST", body: JSON.stringify({}) }),

  // ---------- Allgemeine Einstellungen ----------
  generalConfig: () => request<GeneralConfigView>("/api/general/config"),
  generalSaveConfig: (patch: {
    theme?: "light" | "dark" | "system";
    lang?: "de" | "en";
    confirmUnsavedChanges?: boolean;
  }) => request<GeneralConfigView>("/api/general/config", { method: "PUT", body: JSON.stringify(patch) }),

  // ---------- Prüfungen ----------
  getExam: (id: string) => request<Exam>(`/api/exams/${id}`),
  deleteExam: (id: string) => request<void>(`/api/exams/${id}`, { method: "DELETE" }),
  listProjectExams: (projectId: string) => request<Exam[]>(`/api/projects/${projectId}/exams`),
  listDeckExams: (deckId: string) => request<Exam[]>(`/api/decks/${deckId}/exams`),
  createProjectExam: (projectId: string, body: { title: string; config: ExamConfig }) =>
    request<Exam>(`/api/projects/${projectId}/exams`, { method: "POST", body: JSON.stringify(body) }),
  createDeckExam: (deckId: string, body: { title: string; config: ExamConfig }) =>
    request<Exam>(`/api/decks/${deckId}/exams`, { method: "POST", body: JSON.stringify(body) }),
  startExam: (id: string) =>
    request<Exam>(`/api/exams/${id}/start`, { method: "POST", body: JSON.stringify({}) }),
  saveExamAnswers: (id: string, answers: Record<string, string>) =>
    request<{ ok: boolean }>(`/api/exams/${id}/answers`, { method: "PUT", body: JSON.stringify({ answers }) }),
  submitExam: (id: string, answers: Record<string, string>) =>
    request<Exam>(`/api/exams/${id}/submit`, { method: "POST", body: JSON.stringify({ answers }) }),
  gradeExam: (id: string) =>
    request<Exam>(`/api/exams/${id}/grade`, { method: "POST", body: JSON.stringify({}) }),
};
