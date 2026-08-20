import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGitHubStars } from "./use-github-stars";

const REPOSITORY_URL = "https://github.com/Sayhi-bzb/CharDesk";
const API_URL = "https://api.github.com/repos/Sayhi-bzb/CharDesk";
const CACHE_STORAGE_KEY = "chardesk-github-stars-v1";

describe("useGitHubStars", () => {
  beforeEach(() => {
    window.localStorage.removeItem(CACHE_STORAGE_KEY);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-19T12:00:00Z"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("loads stars only after it is enabled and caches the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stargazers_count: 1234 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ enabled }) => useGitHubStars(REPOSITORY_URL, enabled),
      { initialProps: { enabled: false } }
    );

    expect(fetchMock).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current).toBe(1234));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      API_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    const cache = JSON.parse(window.localStorage.getItem(CACHE_STORAGE_KEY) ?? "null");
    expect(cache).toMatchObject({ repositoryUrl: REPOSITORY_URL, count: 1234 });
  });

  it("uses a fresh six-hour cache without requesting GitHub", () => {
    window.localStorage.setItem(
      CACHE_STORAGE_KEY,
      JSON.stringify({
        repositoryUrl: REPOSITORY_URL,
        count: 987,
        fetchedAt: Date.now() - 5 * 60 * 60 * 1000,
      })
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useGitHubStars(REPOSITORY_URL, true));

    expect(result.current).toBe(987);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps stale stars visible when a refresh fails", async () => {
    window.localStorage.setItem(
      CACHE_STORAGE_KEY,
      JSON.stringify({
        repositoryUrl: REPOSITORY_URL,
        count: 321,
        fetchedAt: Date.now() - 7 * 60 * 60 * 1000,
      })
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const { result } = renderHook(() => useGitHubStars(REPOSITORY_URL, true));

    expect(result.current).toBe(321);
    await act(async () => Promise.resolve());
    expect(result.current).toBe(321);
  });
});
