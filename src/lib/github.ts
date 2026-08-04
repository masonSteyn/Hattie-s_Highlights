import "server-only";

/**
 * Publishing: one commit, many files, through GitHub's Git Data API.
 *
 * The naive approach — the Contents API, one PUT per file — creates a separate
 * commit per file and races itself when two land together. Building a tree
 * instead means an upload of six photos plus the content file is a single
 * commit that either fully lands or does not land at all. Vercel then sees one
 * push and rebuilds once.
 *
 * It is also why "undo" is a real answer here: every publish is a commit, so
 * anything can be reverted by someone who knows git.
 */

const API = "https://api.github.com";

export type GitFile = {
  path: string;
  /** Text content, or base64 for binary. */
  content: string;
  encoding: "utf-8" | "base64";
};

export type PublishResult =
  | { ok: true; sha: string; url: string; files: number }
  | { ok: false; error: string };

type Config = { token: string; owner: string; repo: string; branch: string };

function config(): Config | null {
  const token = process.env.GITHUB_TOKEN;
  const slug = process.env.GITHUB_REPO;
  if (!token || !slug?.includes("/")) return null;
  const [owner, repo] = slug.split("/");
  return { token, owner, repo, branch: process.env.GITHUB_BRANCH || "main" };
}

export function publishConfigured() {
  return config() !== null;
}

export function publishBlockedReason(): string | null {
  if (!process.env.GITHUB_TOKEN) {
    return "No GitHub token is configured, so changes cannot be published.";
  }

  const slug = process.env.GITHUB_REPO;
  if (!slug) {
    return "GITHUB_REPO is not set. It needs the owner too, like owner/repository.";
  }
  if (!slug.includes("/")) {
    // Echoing the offending value turns a guessing game into a one-look fix.
    // GITHUB_REPO is not a secret — unlike the token, which is never echoed.
    return `GITHUB_REPO is "${slug}", which is missing the owner. It should look like owner/${slug}.`;
  }
  if (slug.trim() !== slug) {
    // A trailing space pasted into a dashboard field is invisible and produces
    // a 404 that looks like a permissions problem.
    return `GITHUB_REPO has a stray space around it ("${slug}"). Retype it without one.`;
  }
  return null;
}

async function gh<T>(cfg: Config, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    // The full response goes to the log for whoever maintains this; the person
    // looking at the screen gets a sentence they can act on. Dumping GitHub's
    // JSON into the editor would be useless to Hattie and alarming besides.
    console.error(`[github] ${response.status} on ${path}: ${body.slice(0, 400)}`);

    const friendly: Record<number, string> = {
      401: "The GitHub token is not valid any more — it has probably expired. A new one needs to be generated.",
      403: "GitHub refused the change. The token may be missing write permission, or too many requests have been made in a short time.",
      404: "Could not find the repository. Check the token still has access to it.",
      409: "Someone else published at the same time. Reload the page and try again — your changes are safe.",
      422: "GitHub rejected the change as invalid. Nothing was published.",
    };

    throw new Error(
      friendly[response.status] ??
        `GitHub returned an unexpected error (${response.status}). Nothing was published.`,
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Commits every file in one go.
 *
 * Files not mentioned are left untouched: the new tree is built with the
 * previous commit as its base, so this only ever adds or replaces.
 */
export async function publishFiles(
  files: GitFile[],
  message: string,
): Promise<PublishResult> {
  const cfg = config();
  if (!cfg) return { ok: false, error: publishBlockedReason() ?? "Publishing is not configured." };
  if (files.length === 0) return { ok: false, error: "Nothing to publish." };

  try {
    // 1. Where the branch currently points.
    const ref = await gh<{ object: { sha: string } }>(cfg, `/git/ref/heads/${cfg.branch}`);
    const baseSha = ref.object.sha;

    const baseCommit = await gh<{ tree: { sha: string } }>(cfg, `/git/commits/${baseSha}`);

    // 2. Upload each file's bytes as a blob.
    const blobs = await Promise.all(
      files.map(async (file) => {
        const blob = await gh<{ sha: string }>(cfg, "/git/blobs", {
          method: "POST",
          body: JSON.stringify({ content: file.content, encoding: file.encoding }),
        });
        return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: blob.sha };
      }),
    );

    // 3. A tree layered on top of the current one.
    const tree = await gh<{ sha: string }>(cfg, "/git/trees", {
      method: "POST",
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: blobs }),
    });

    // 4. The commit.
    const commit = await gh<{ sha: string; html_url: string }>(cfg, "/git/commits", {
      method: "POST",
      body: JSON.stringify({ message, tree: tree.sha, parents: [baseSha] }),
    });

    // 5. Move the branch. Not forced: if someone else pushed since step 1,
    //    this fails rather than discarding their work.
    await gh(cfg, `/git/refs/heads/${cfg.branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });

    return { ok: true, sha: commit.sha.slice(0, 7), url: commit.html_url, files: files.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[publish] failed:", message);
    return { ok: false, error: message };
  }
}

/** Confirms the token works and can write, without changing anything. */
export async function checkAccess(): Promise<{ ok: boolean; detail: string }> {
  const cfg = config();
  if (!cfg) return { ok: false, detail: publishBlockedReason() ?? "not configured" };

  try {
    const repo = await gh<{ full_name: string; permissions?: { push?: boolean }; default_branch: string }>(
      cfg,
      "",
    );
    if (repo.permissions && !repo.permissions.push) {
      return { ok: false, detail: `${repo.full_name}: token is read-only` };
    }
    await gh(cfg, `/git/ref/heads/${cfg.branch}`);
    return { ok: true, detail: `${repo.full_name} @ ${cfg.branch}` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}
