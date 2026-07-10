import type { RepoOption } from "../types";

const API_BASE = process.env.GITHUB_API_BASE ?? "https://api.github.com";

/** Remote-Datei existiert nicht (HTTP 404). */
export const NOT_FOUND = Symbol("not-found");

/** Remote-Datei wurde zwischenzeitlich verändert (HTTP 409 / sha-Konflikt). */
export class RemoteChangedError extends Error {
  constructor() {
    super("Remote-Datei wurde zwischenzeitlich verändert");
    this.name = "RemoteChangedError";
  }
}

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "flashy",
  };
}

async function request(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers(token), ...(init?.headers as Record<string, string> | undefined) },
  });
}

/** Liest eine Fehlermeldung aus einer GitHub-Antwort, ohne je den Token zu berühren. */
async function errorFrom(res: Response): Promise<GitHubError> {
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as { message?: string };
    if (body?.message) message = body.message;
  } catch {
    // Antwort war kein JSON -- Statuszeile genügt.
  }
  if (res.status === 401) message = "Token ungültig oder abgelaufen";
  if (res.status === 403) message = `Zugriff verweigert: ${message}`;
  return new GitHubError(res.status, message);
}

export async function getUser(token: string): Promise<{ login: string }> {
  const res = await request(token, "/user");
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { login: string };
  return { login: body.login };
}

interface RepoApiEntry {
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  updated_at: string;
  owner: { login: string };
}

/** Alle Repos, auf die der Token Zugriff hat (bis zu 3 Seiten à 100). */
export async function listRepos(token: string): Promise<RepoOption[]> {
  const repos: RepoOption[] = [];
  for (let page = 1; page <= 3; page++) {
    const res = await request(token, `/user/repos?per_page=100&sort=updated&page=${page}`);
    if (!res.ok) throw await errorFrom(res);
    const batch = (await res.json()) as RepoApiEntry[];
    for (const r of batch) {
      repos.push({
        owner: r.owner.login,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch,
        updatedAt: r.updated_at,
      });
    }
    if (batch.length < 100) break;
  }
  return repos;
}

export async function listBranches(token: string, owner: string, repo: string): Promise<string[]> {
  const res = await request(token, `/repos/${owner}/${repo}/branches?per_page=100`);
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { name: string }[];
  return body.map((b) => b.name);
}

export interface RemoteFile {
  content: string;
  sha: string;
}

export async function getFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<RemoteFile | typeof NOT_FOUND> {
  const res = await request(
    token,
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`
  );
  if (res.status === 404) return NOT_FOUND;
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { content: string; encoding: string; sha: string };
  const content = Buffer.from(body.content, "base64").toString("utf-8");
  return { content, sha: body.sha };
}

/**
 * Schreibt die Datei als Commit. `sha` ist der zuletzt bekannte Stand
 * (Optimistic Locking); fehlt er, muss die Datei neu sein.
 */
export async function putFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
  content: string,
  message: string,
  sha?: string
): Promise<string> {
  const res = await request(token, `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  // 409 = sha veraltet; 422 = sha fehlte, Datei existiert aber bereits.
  if (res.status === 409 || res.status === 422) throw new RemoteChangedError();
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { content: { sha: string } };
  return body.content.sha;
}
