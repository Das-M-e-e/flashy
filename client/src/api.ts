import type { Card, Deck, DeckStats, Direction, Project } from "./types";

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

export const api = {
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (name: string) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify({ name }) }),
  renameProject: (id: string, name: string) =>
    request<Project>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),
  exportProjectUrl: (id: string) => `/api/projects/${id}/export`,
  studyProjectCards: (id: string) => request<Card[]>(`/api/projects/${id}/study-cards`),

  listDecks: (projectId: string) => request<Deck[]>(`/api/projects/${projectId}/decks`),
  getDeck: (id: string) => request<Deck>(`/api/decks/${id}`),
  createDeck: (projectId: string, name: string) =>
    request<Deck>(`/api/projects/${projectId}/decks`, { method: "POST", body: JSON.stringify({ name }) }),
  renameDeck: (id: string, name: string) =>
    request<Deck>(`/api/decks/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteDeck: (id: string) => request<void>(`/api/decks/${id}`, { method: "DELETE" }),
  deckStats: (id: string) => request<DeckStats>(`/api/decks/${id}/stats`),
  exportDeckUrl: (id: string) => `/api/decks/${id}/export`,
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
  createCard: (deckId: string, front: string, back: string, bidirectional: boolean) =>
    request<Card>(`/api/decks/${deckId}/cards`, {
      method: "POST",
      body: JSON.stringify({ front, back, bidirectional }),
    }),
  updateCard: (id: string, front: string, back: string, bidirectional: boolean) =>
    request<Card>(`/api/cards/${id}`, {
      method: "PUT",
      body: JSON.stringify({ front, back, bidirectional }),
    }),
  deleteCard: (id: string) => request<void>(`/api/cards/${id}`, { method: "DELETE" }),
  answerCard: (id: string, direction: Direction, correct: boolean) =>
    request<Card>(`/api/cards/${id}/answer`, {
      method: "POST",
      body: JSON.stringify({ direction, correct }),
    }),
};
