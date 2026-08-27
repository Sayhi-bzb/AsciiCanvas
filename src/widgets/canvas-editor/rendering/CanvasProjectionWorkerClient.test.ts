import { afterEach, describe, expect, it } from "vitest";
import {
  CellPlaneIndex,
  cellPlanePatchToOperation,
} from "@/domains/canvas/public";
import { CanvasProjectionWorkerClient } from "./CanvasProjectionWorkerClient";
import type {
  CanvasProjectionWorkerRequest,
  CanvasProjectionWorkerResponse,
} from "./canvasProjectionWorkerProtocol";

class FakeWorker {
  static latest: FakeWorker | null = null;
  readonly messages: CanvasProjectionWorkerRequest[] = [];
  onmessage: ((event: MessageEvent<CanvasProjectionWorkerResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;

  constructor() {
    FakeWorker.latest = this;
  }

  postMessage(message: CanvasProjectionWorkerRequest) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  respond(response: CanvasProjectionWorkerResponse) {
    this.onmessage?.({ data: response } as MessageEvent<CanvasProjectionWorkerResponse>);
  }
}

const originalWorker = globalThis.Worker;

afterEach(() => {
  globalThis.Worker = originalWorker;
  FakeWorker.latest = null;
});

const operation = (id: string, x: number, text: string) =>
  cellPlanePatchToOperation(id, {
    rows: [{
      y: 0,
      erase: [],
      spans: [{ x, text, color: "#fff" }],
    }],
  })!;

describe("CanvasProjectionWorkerClient", () => {
  it("syncs once and appends only new operations", async () => {
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    const reader = new CellPlaneIndex([operation("initial", 0, "A")]);
    const client = new CanvasProjectionWorkerClient();
    const first = client.project(reader, { x: 0, y: 0, width: 1, height: 1 })!;
    const worker = FakeWorker.latest!;

    expect(worker.messages.map(({ type }) => type)).toEqual(["sync", "project"]);
    const firstRequest = worker.messages[1] as Extract<
      CanvasProjectionWorkerRequest,
      { type: "project" }
    >;
    worker.respond({
      type: "projected",
      requestId: firstRequest.requestId,
      sourceId: firstRequest.sourceId,
      revision: firstRequest.revision,
      rows: [],
      durationMs: 2,
    });
    await expect(first).resolves.toEqual([]);

    reader.append(operation("next", 1, "B"));
    const second = client.project(reader, { x: 0, y: 0, width: 2, height: 1 })!;
    expect(worker.messages.slice(2).map(({ type }) => type)).toEqual([
      "append",
      "project",
    ]);
    const append = worker.messages[2] as Extract<
      CanvasProjectionWorkerRequest,
      { type: "append" }
    >;
    expect(append.operations).toHaveLength(1);
    const secondRequest = worker.messages[3] as Extract<
      CanvasProjectionWorkerRequest,
      { type: "project" }
    >;
    worker.respond({
      type: "projected",
      requestId: secondRequest.requestId,
      sourceId: secondRequest.sourceId,
      revision: secondRequest.revision,
      rows: [],
      durationMs: 3,
    });
    await second;
    expect(client.getStats()).toMatchObject({
      requests: 2,
      completed: 2,
      workerDurationMs: 5,
    });
  });

  it("rejects stale results and permanently falls back after worker failure", async () => {
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    const reader = new CellPlaneIndex([operation("initial", 0, "A")]);
    const client = new CanvasProjectionWorkerClient();
    const result = client.project(reader, { x: 0, y: 0, width: 1, height: 1 })!;
    const worker = FakeWorker.latest!;
    const request = worker.messages[1] as Extract<
      CanvasProjectionWorkerRequest,
      { type: "project" }
    >;
    worker.respond({
      type: "stale",
      requestId: request.requestId,
      sourceId: request.sourceId,
      revision: request.revision,
    });
    await expect(result).rejects.toThrow("stale");

    const pending = client.project(reader, { x: 0, y: 0, width: 1, height: 1 })!;
    worker.onerror?.();
    await expect(pending).rejects.toThrow("worker failed");
    expect(client.project(reader, { x: 0, y: 0, width: 1, height: 1 })).toBeNull();
  });

  it("keeps shared pane sources until the final retainer releases them", async () => {
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    const reader = new CellPlaneIndex([operation("initial", 0, "A")]);
    const client = new CanvasProjectionWorkerClient();
    const releasePrimary = client.retain(reader);
    const releaseSecondary = client.retain(reader);
    const pending = client.project(reader, { x: 0, y: 0, width: 1, height: 1 })!;
    const worker = FakeWorker.latest!;

    releasePrimary();
    expect(worker.messages.at(-1)?.type).toBe("project");
    releaseSecondary();
    expect(worker.messages.at(-1)?.type).toBe("release");
    await expect(pending).rejects.toThrow("released");
    expect(client.getStats()).toMatchObject({ sources: 0, pending: 0 });
  });

  it("falls back when the worker cannot be constructed", () => {
    globalThis.Worker = class {
      constructor() {
        throw new Error("blocked");
      }
    } as unknown as typeof Worker;
    const reader = new CellPlaneIndex([operation("initial", 0, "A")]);
    const client = new CanvasProjectionWorkerClient();

    expect(client.project(reader, { x: 0, y: 0, width: 1, height: 1 })).toBeNull();
    expect(client.getStats()).toMatchObject({ available: false, failures: 1 });
  });
});
