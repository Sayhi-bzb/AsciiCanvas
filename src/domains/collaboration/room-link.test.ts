import { describe, expect, it, vi } from "vitest";
import {
  buildCollaborationUrl,
  createCollaborationDescriptor,
  parseCollaborationUrl,
  sameCollaborationRoom,
  validateCollaborationEndpoint,
} from "./room-link";

describe("collaboration room links", () => {
  it("creates V3 links and keeps the room secret in the URL fragment", () => {
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(7) });
    const descriptor = createCollaborationDescriptor("freeform");
    const url = buildCollaborationUrl(descriptor, "https://canvas.test/editor?theme=dark");
    expect(new URL(url).searchParams.has("room")).toBe(false);
    expect(new URL(url).hash).toContain("room=");
    expect(descriptor.version).toBe(3);
    expect(parseCollaborationUrl(url)).toEqual({ status: "valid", descriptor });
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

  it("accepts V2 room links without upgrading them", () => {
    const descriptor = {
      version: 2,
      documentVersion: 2,
      mode: "freeform",
      provider: "p2p",
      roomId: "room-id-1234567890",
      key: "room-key-1234567890123456789012345678901234567890",
    } as const;
    const url = buildCollaborationUrl(descriptor, "https://canvas.test/");
    expect(parseCollaborationUrl(url)).toEqual({ status: "valid", descriptor });
  });

  it.each([1, 4])(
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
      version: 2,
      documentVersion: 2,
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

  it("treats V2 and V3 namespaces as different rooms", () => {
    const legacy = {
      version: 2,
      documentVersion: 2,
      mode: "freeform",
      provider: "p2p",
      roomId: "room-id-1234567890",
      key: "room-key-1234567890123456789012345678901234567890",
    } as const;
    expect(sameCollaborationRoom(legacy, { ...legacy, version: 3 })).toBe(false);
  });
});
