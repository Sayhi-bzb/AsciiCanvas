import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import {
  encryptCollaborationRelayPayload,
  importCollaborationRelayKey,
} from "@chardesk/collaboration-protocol";
import { createSyncServer } from "./server.js";

const openSocket = (url: string) => new Promise<WebSocket>((resolve, reject) => {
  const socket = new WebSocket(url, { origin: "https://chardesk.com" });
  socket.once("open", () => resolve(socket));
  socket.once("error", reject);
});

const rejectedStatus = (url: string, origin: string) => new Promise<number>((resolve, reject) => {
  const socket = new WebSocket(url, { origin });
  socket.once("unexpected-response", (_request, response) => resolve(response.statusCode ?? 0));
  socket.once("open", () => reject(new Error("Expected connection rejection")));
  socket.once("error", () => {});
});

describe("sync relay", () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  });

  it("relays opaque frames and reclaims an empty room", async () => {
    const relay = createSyncServer({
      port: 0,
      allowedOrigins: new Set(["https://chardesk.com"]),
      logger: () => {},
    });
    const address = await relay.listen();
    cleanups.push(relay.close);
    const url = `ws://127.0.0.1:${address.port}/v1/rooms/room-123456789012`;
    const first = await openSocket(url);
    const second = await openSocket(url);
    const key = await importCollaborationRelayKey(
      "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"
    );
    const frame = await encryptCollaborationRelayPayload(
      key,
      "room-123456789012",
      "sync",
      Uint8Array.of(1, 2, 3)
    );
    const received = new Promise<Buffer>((resolve) => second.once("message", resolve));
    first.send(frame);
    expect(new Uint8Array(await received)).toEqual(frame);
    first.close();
    second.close();
    await new Promise<void>((resolve) => second.once("close", () => resolve()));
    await vi.waitFor(() => expect(relay.rooms.size).toBe(0));
  });

  it("rejects unknown origins and excess room members", async () => {
    const relay = createSyncServer({
      port: 0,
      allowedOrigins: new Set(["https://chardesk.com"]),
      maxConnectionsPerRoom: 1,
      logger: () => {},
    });
    const address = await relay.listen();
    cleanups.push(relay.close);
    const url = `ws://127.0.0.1:${address.port}/v1/rooms/room-123456789012`;
    expect(await rejectedStatus(url, "https://attacker.example")).toBe(403);
    const first = await openSocket(url);
    expect(await rejectedStatus(url, "https://chardesk.com")).toBe(409);
    first.close();
    await new Promise<void>((resolve) => first.once("close", () => resolve()));
  });

  it("closes clients that send plaintext", async () => {
    const relay = createSyncServer({ port: 0, logger: () => {} });
    const address = await relay.listen();
    cleanups.push(relay.close);
    const socket = await openSocket(
      `ws://127.0.0.1:${address.port}/v1/rooms/room-123456789012`
    );
    const closed = new Promise<number>((resolve) => socket.once("close", resolve));
    socket.send("canvas text");
    expect(await closed).toBe(4450);
  });

  it("exposes uncached health and readiness checks", async () => {
    const relay = createSyncServer({ port: 0, logger: () => {} });
    const address = await relay.listen();
    cleanups.push(relay.close);

    for (const path of ["healthz", "readyz"]) {
      const response = await fetch(`http://127.0.0.1:${address.port}/${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toMatchObject({ ok: true });
    }
  });
});
