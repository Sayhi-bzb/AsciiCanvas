import { useEffect, useState } from "react";

const CACHE_STORAGE_KEY = "chardesk-github-stars-v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface GitHubStarsCache {
  repositoryUrl: string;
  count: number;
  fetchedAt: number;
}

function readCache(repositoryUrl: string): GitHubStarsCache | null {
  try {
    const cache = JSON.parse(
      window.localStorage.getItem(CACHE_STORAGE_KEY) ?? "null"
    ) as Partial<GitHubStarsCache> | null;

    if (
      cache?.repositoryUrl !== repositoryUrl ||
      !Number.isSafeInteger(cache.count) ||
      Number(cache.count) < 0 ||
      !Number.isFinite(cache.fetchedAt)
    ) {
      return null;
    }

    return cache as GitHubStarsCache;
  } catch {
    return null;
  }
}

function writeCache(cache: GitHubStarsCache) {
  try {
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Star metadata is optional; storage failures must not affect the menu.
  }
}

function getRepositoryApiUrl(repositoryUrl: string): string | null {
  try {
    const url = new URL(repositoryUrl);
    const [owner, repositoryName] = url.pathname.split("/").filter(Boolean);
    const repository = repositoryName?.replace(/\.git$/, "");

    if (url.hostname !== "github.com" || !owner || !repository) return null;

    return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
  } catch {
    return null;
  }
}

export function useGitHubStars(repositoryUrl: string, enabled: boolean) {
  const [count, setCount] = useState<number | null>(
    () => readCache(repositoryUrl)?.count ?? null
  );

  useEffect(() => {
    if (!enabled) return;

    const cache = readCache(repositoryUrl);
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return;

    const apiUrl = getRepositoryApiUrl(repositoryUrl);
    if (!apiUrl) return;

    const controller = new AbortController();

    void fetch(apiUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`);
        return response.json() as Promise<{ stargazers_count?: unknown }>;
      })
      .then(({ stargazers_count: stars }) => {
        if (!Number.isSafeInteger(stars) || Number(stars) < 0) return;

        const nextCount = Number(stars);
        setCount(nextCount);
        writeCache({ repositoryUrl, count: nextCount, fetchedAt: Date.now() });
      })
      .catch(() => {
        // Keep stale data (or no count) when GitHub is unavailable or rate-limited.
      });

    return () => controller.abort();
  }, [enabled, repositoryUrl]);

  return count;
}
