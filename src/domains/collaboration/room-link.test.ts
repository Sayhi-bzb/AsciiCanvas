import { describe, expect, it, vi } from "vitest";
import {
  buildCollaborationUrl,
  createCollaborationDescriptor,
  parseCollaborationUrl,
  validateCollaborationEndpoint,
} from "./room-link";

describe("collaboration room links", () => {
  it("keeps the room secret in the URL fragment", () => {
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(7) });
    const descriptor = createCollaborationDescriptor();
    const url = buildCollaborationUrl(descriptor, "https://canvas.test/editor?theme=dark");
    expect(new URL(url).searchParams.has("room")).toBe(false);
    expect(new URL(url).hash).toContain("room=");
    expect(parseCollaborationUrl(url)).toEqual(descriptor);
    vi.unstubAllGlobals();
  });

  it("accepts secure endpoints and local ws development only", () => {
    expect(validateCollaborationEndpoint("wss://sync.example.com/yjs")).toBe("wss://sync.example.com/yjs");
    expect(validateCollaborationEndpoint("ws://localhost:1234")).toBe("ws://localhost:1234");
    expect(validateCollaborationEndpoint("ws://sync.example.com")).toBeNull();
    expect(validateCollaborationEndpoint("https://sync.example.com")).toBeNull();
  });

  it("rejects malformed descriptors", () => {
    expect(parseCollaborationUrl("https://canvas.test/#room=e30")).toBeNull();
  });
});

