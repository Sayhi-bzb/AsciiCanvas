// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { AgentToolDefinition } from "./contracts";
import { startOriginSiteToolGateway } from "./originGateway";

const tools: readonly AgentToolDefinition[] = [{
  name: "chardesk_test_read",
  title: "Read",
  description: "Read test state.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  readOnly: true,
  execute: () => ({ ok: true }),
}];

type PendingLock = {
  callback: LockGrantedCallback<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
};

class FakeLockManager {
  #held = false;
  #queue: PendingLock[] = [];

  request(
    _name: string,
    options: LockOptions,
    callback: LockGrantedCallback<unknown>,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const pending = { callback, resolve, reject, signal: options.signal };
      if (options.signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      options.signal?.addEventListener("abort", () => {
        const index = this.#queue.indexOf(pending);
        if (index < 0) return;
        this.#queue.splice(index, 1);
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
      this.#queue.push(pending);
      queueMicrotask(() => this.#drain());
    });
  }

  #drain() {
    if (this.#held) return;
    const pending = this.#queue.shift();
    if (!pending) return;
    this.#held = true;
    void Promise.resolve(pending.callback({ mode: "exclusive", name: "gateway" } as Lock))
      .then(pending.resolve, pending.reject)
      .finally(() => {
        this.#held = false;
        this.#drain();
      });
  }
}

const createDocument = (registerTool = vi.fn()) => {
  const target = document.implementation.createHTMLDocument();
  Object.defineProperty(target, "modelContext", {
    configurable: true,
    value: { registerTool, getTools: vi.fn() },
  });
  return { target, registerTool };
};

describe("origin site tool gateway", () => {
  it("registers one leader and transfers ownership after disposal", async () => {
    const locks = new FakeLockManager() as unknown as LockManager;
    const first = createDocument();
    const second = createDocument();
    const firstGateway = startOriginSiteToolGateway({
      target: first.target,
      tools,
      lockManager: locks,
    });
    const secondGateway = startOriginSiteToolGateway({
      target: second.target,
      tools,
      lockManager: locks,
    });

    await vi.waitFor(() => expect(firstGateway.getSnapshot().status).toBe("ready"));
    expect(firstGateway.getSnapshot().role).toBe("leader");
    expect(secondGateway.getSnapshot()).toMatchObject({ role: "standby", status: "waiting" });
    expect(first.registerTool).toHaveBeenCalledOnce();
    expect(second.registerTool).not.toHaveBeenCalled();

    firstGateway.dispose();
    await vi.waitFor(() => expect(secondGateway.getSnapshot().status).toBe("ready"));
    expect(secondGateway.getSnapshot().role).toBe("leader");
    expect(second.registerTool).toHaveBeenCalledOnce();
    secondGateway.dispose();
  });

  it("fails closed when origin locking is unavailable", () => {
    const { target, registerTool } = createDocument();
    const gateway = startOriginSiteToolGateway({ target, tools, lockManager: null });

    expect(gateway.getSnapshot()).toMatchObject({ role: "unsupported", status: "failed" });
    expect(registerTool).not.toHaveBeenCalled();
    gateway.dispose();
  });

  it("waits for a late-injected host before joining the ownership queue", async () => {
    vi.useFakeTimers();
    const locks = new FakeLockManager() as unknown as LockManager;
    const target = document.implementation.createHTMLDocument();
    const gateway = startOriginSiteToolGateway({
      target,
      tools,
      lockManager: locks,
      retryDelays: [10],
    });
    const registerTool = vi.fn(() => undefined);

    await vi.advanceTimersByTimeAsync(100);
    expect(gateway.getSnapshot()).toMatchObject({ role: "standby", status: "waiting" });
    Object.defineProperty(target, "modelContext", {
      configurable: true,
      value: { registerTool, getTools: vi.fn() },
    });
    await vi.advanceTimersByTimeAsync(10);

    expect(gateway.getSnapshot()).toMatchObject({ role: "leader", status: "ready" });
    expect(registerTool).toHaveBeenCalledOnce();
    gateway.dispose();
    vi.useRealTimers();
  });
});
