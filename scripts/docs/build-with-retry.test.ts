import { describe, expect, it, vi } from "vitest";
import {
  isRetryablePrerenderFailure,
  runWithPrerenderRetry,
} from "./build-with-retry.mjs";

const success = { exitCode: 0, output: "built" };

describe("docs build retry", () => {
  it.each([
    "Error: Prerender: Request failed for /docs/development.data: ",
    "Prerender: Request failed for /docs/development.data: connect ECONNREFUSED 127.0.0.1:4173",
    "Prerender: Request failed for /docs/development/: read ECONNRESET",
    "Prerender: Request failed for /docs/development/: socket hang up",
  ])("recognizes a transient preview request failure", (output) => {
    expect(isRetryablePrerenderFailure(output)).toBe(true);
  });

  it.each([
    "Prerender (data): Received a 500 status code",
    "Prerender: Request failed for /docs/development.data: 404 Not Found",
    "Error: MDX compilation failed",
    "Error: Prerender: Request failed for /docs/development/: ",
  ])("does not classify persistent build failures as transient", (output) => {
    expect(isRetryablePrerenderFailure(output)).toBe(false);
  });

  it("returns immediately when the first build succeeds", async () => {
    const runBuild = vi.fn().mockResolvedValue(success);

    await expect(runWithPrerenderRetry(runBuild)).resolves.toBe(0);
    expect(runBuild).toHaveBeenCalledTimes(1);
  });

  it("retries one transient failure after the configured delay", async () => {
    const runBuild = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 1,
        output: "Prerender: Request failed for /docs/development.data: ",
      })
      .mockResolvedValueOnce(success);
    const delay = vi.fn().mockResolvedValue(undefined);
    const log = vi.fn();

    await expect(
      runWithPrerenderRetry(runBuild, { delay, log })
    ).resolves.toBe(0);
    expect(runBuild).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(500);
    expect(log).toHaveBeenCalledOnce();
  });

  it("does not retry a non-transient failure", async () => {
    const runBuild = vi.fn().mockResolvedValue({
      exitCode: 2,
      output: "Error: MDX compilation failed",
    });

    await expect(runWithPrerenderRetry(runBuild)).resolves.toBe(2);
    expect(runBuild).toHaveBeenCalledTimes(1);
  });

  it("returns the second failure after one retry", async () => {
    const failure = {
      exitCode: 1,
      output: "Prerender: Request failed for /docs/development.data: ",
    };
    const runBuild = vi.fn().mockResolvedValue(failure);

    await expect(
      runWithPrerenderRetry(runBuild, {
        delay: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
      })
    ).resolves.toBe(1);
    expect(runBuild).toHaveBeenCalledTimes(2);
  });
});
