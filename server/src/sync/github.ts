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

  // Über 1 MB liefert die Contents-API den Inhalt nicht als JSON aus --
  // je nach Größe mit 403 oder mit leerem `content`. Dann über den
  // raw-Medientyp holen (trägt bis 100 MB).
  if (res.status === 403) {
    const message = (await res.clone().text()).toLowerCase();
    if (message.includes("too large") || message.includes("larger than")) {
      return getLargeFile(token, owner, repo, path, branch);
    }
  }
  if (!res.ok) throw await errorFrom(res);

  const body = (await res.json()) as { content: string; encoding: string; sha: string; size: number };
  if (body.size > 0 && !body.content) {
    return getLargeFile(token, owner, repo, path, branch);
  }
  const content = Buffer.from(body.content, "base64").toString("utf-8");
  return { content, sha: body.sha };
}

/**
 * Holt Inhalt und sha getrennt: den Inhalt über den raw-Medientyp,
 * den sha aus dem Verzeichnis-Listing (das nur Metadaten liefert).
 */
async function getLargeFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<RemoteFile | typeof NOT_FOUND> {
  const rawRes = await request(
    token,
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
    { headers: { Accept: "application/vnd.github.raw" } }
  );
  if (rawRes.status === 404) return NOT_FOUND;
  if (!rawRes.ok) throw await errorFrom(rawRes);
  const content = await rawRes.text();

  const sha = await getFileSha(token, owner, repo, path, branch);
  if (sha === undefined) return NOT_FOUND;
  return { content, sha };
}

async function getFileSha(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<string | undefined> {
  const slash = path.lastIndexOf("/");
  const dir = slash === -1 ? "" : path.slice(0, slash);
  const name = slash === -1 ? path : path.slice(slash + 1);

  const res = await request(
    token,
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(dir)}?ref=${encodeURIComponent(branch)}`
  );
  if (res.status === 404) return undefined;
  if (!res.ok) throw await errorFrom(res);
  const entries = (await res.json()) as { name: string; sha: string }[];
  if (!Array.isArray(entries)) return undefined;
  return entries.find((e) => e.name === name)?.sha;
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

// ---------- Medien (binär, inhaltsadressiert) ----------

export interface DirEntry {
  name: string;
  sha: string;
}

/** Listet ein Verzeichnis; leeres Array, falls es (noch) nicht existiert. */
export async function listDir(
  token: string,
  owner: string,
  repo: string,
  dir: string,
  branch: string
): Promise<DirEntry[]> {
  const res = await request(
    token,
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(dir)}?ref=${encodeURIComponent(branch)}`
  );
  if (res.status === 404) return [];
  if (!res.ok) throw await errorFrom(res);
  const body = await res.json();
  if (!Array.isArray(body)) return [];
  return (body as { name: string; sha: string }[]).map((e) => ({ name: e.name, sha: e.sha }));
}

/** Lädt eine (auch große) Datei als Rohbytes. */
export async function getRawBytes(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<Buffer | typeof NOT_FOUND> {
  const res = await request(
    token,
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
    { headers: { Accept: "application/vnd.github.raw" } }
  );
  if (res.status === 404) return NOT_FOUND;
  if (!res.ok) throw await errorFrom(res);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Legt eine binäre Datei an. Medien sind unveränderlich -- existiert die Datei
 * schon (422/409), gilt das als Erfolg (kein Überschreiben nötig).
 */
export async function putBinaryFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
  bytes: Buffer,
  message: string
): Promise<void> {
  const res = await request(token, `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: bytes.toString("base64"), branch }),
  });
  if (res.status === 409 || res.status === 422) return; // existiert bereits -> ok
  if (!res.ok) throw await errorFrom(res);
}
