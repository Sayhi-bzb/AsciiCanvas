import { describe, expect, it, vi } from "vitest";
import {
  buildCollaborationUrl,
  createCollaborationDescriptor,
  getCollaborationDocumentId,
  parseCollaborationUrl,
  sameCollaborationRoom,
  stripCollaborationUrl,
  validateCollaborationEndpoint,
} from "./room-link";

describe("collaboration room links", () => {
  it("creates V6 links and keeps the room secret in the URL fragment", () => {
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(7) });
    const descriptor = createCollaborationDescriptor("freeform", "wss://sync.example.com");
    const url = buildCollaborationUrl(descriptor, "https://canvas.test/editor?theme=dark");
    expect(new URL(url).searchParams.has("room")).toBe(false);
    expect(new URL(url).hash).toContain("room=");
    expect(descriptor.version).toBe(6);
    expect(getCollaborationDocumentId(descriptor)).toBe(
      `collaboration:${descriptor.roomId}`
    );
    expect(parseCollaborationUrl(url)).toEqual({ status: "valid", descriptor });
    vi.unstubAllGlobals();
  });

  it("adds and removes room identity without discarding unrelated URL state", () => {
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(7) });
    const descriptor = createCollaborationDescriptor("freeform", "wss://sync.example.com");
    const url = buildCollaborationUrl(
      descriptor,
      "https://canvas.test/editor?theme=dark&room=legacy#panel=layers"
    );

    expect(new URL(url).search).toBe("?theme=dark");
    expect(new URLSearchParams(new URL(url).hash.slice(1)).get("panel")).toBe("layers");
    expect(stripCollaborationUrl(url)).toBe(
      "https://canvas.test/editor?theme=dark#panel=layers"
    );
    vi.unstubAllGlobals();
  });

  it("accepts secure endpoints and local ws development only", () => {
    expect(validateCollaborationEndpoint("wss://sync.example.com/yjs")).toBe("wss://sync.example.com/yjs");
    expect(validateCollaborationEndpoint("ws://localhost:1234")).toBe("ws://localhost:1234");
    expect(validateCollaborationEndpoint("ws://sync.example.com")).toBeNull();
    expect(validateCollaborationEndpoint("https://sync.example.com")).toBeNull();
  });

  it("rejects malformed descriptors", () => {
    expect(parseCollaborationUrl("https://canvas.test/#room=e30")).toEqual({
      status: "invalid",
    });
  });

  it("rejects legacy room links instead of upgrading them", () => {
    const descriptor = {
      version: 2,
      documentVersion: 3,
      mode: "freeform",
      provider: "p2p",
      roomId: "room-id-1234567890",
      key: "room-key-1234567890123456789012345678901234567890",
    } as const;
    const encoded = btoa(JSON.stringify(descriptor)).replace(/=+$/g, "");
    expect(parseCollaborationUrl(`https://canvas.test/#room=${encoded}`)).toEqual({
      status: "unsupported",
      version: 2,
    });
  });

  it("reports V6 P2P links as retired", () => {
    const descriptor = {
      version: 6,
      documentVersion: 6,
      mode: "freeform",
      provider: "p2p",
      roomId: "room-id-1234567890",
      key: "room-key-1234567890123456789012345678901234567890",
    } as const;
    const encoded = btoa(JSON.stringify(descriptor)).replace(/=+$/g, "");
    expect(parseCollaborationUrl(`https://canvas.test/#room=${encoded}`)).toEqual({
      status: "retired",
      provider: "p2p",
    });
  });

  it.each([1, 2, 3, 4, 5])(
    "reports collaboration descriptor version %i as unsupported",
    (version) => {
      const encoded = btoa(JSON.stringify({ version })).replace(/=+$/g, "");
      expect(parseCollaborationUrl(`https://canvas.test/#room=${encoded}`)).toEqual({
        status: "unsupported",
        version,
      });
    }
  );

  it("treats WebSocket endpoints as part of room identity", () => {
    const first = {
      version: 6,
      documentVersion: 6,
      mode: "freeform",
      provider: "websocket",
      roomId: "room-id-1234567890",
      key: "room-key-1234567890123456789012345678901234567890",
      endpoint: "wss://one.example.com",
    } as const;
    expect(
      sameCollaborationRoom(first, {
        ...first,
        endpoint: "wss://two.example.com",
      })
    ).toBe(false);
  });

  it("matches supported descriptors with the same room identity", () => {
    const room = {
      version: 6,
      documentVersion: 6,
      mode: "freeform",
      provider: "websocket",
      roomId: "room-id-1234567890",
      key: "room-key-1234567890123456789012345678901234567890",
      endpoint: "wss://sync.example.com",
    } as const;
    expect(sameCollaborationRoom(room, { ...room })).toBe(true);
  });
});
