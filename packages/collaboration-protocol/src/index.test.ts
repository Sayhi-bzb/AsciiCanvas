import { describe, expect, it } from "vitest";
import {
  decryptCollaborationRelayPayload,
  encryptCollaborationRelayPayload,
  importCollaborationRelayKey,
  inspectCollaborationRelayFrame,
} from "./index.js";

const key = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";

describe("collaboration relay protocol", () => {
  it("round trips an encrypted payload", async () => {
    const cryptoKey = await importCollaborationRelayKey(key);
    const frame = await encryptCollaborationRelayPayload(
      cryptoKey,
      "room-a",
      "sync",
      new TextEncoder().encode("secret canvas")
    );

    inspectCollaborationRelayFrame(frame);
    const result = await decryptCollaborationRelayPayload(cryptoKey, "room-a", frame);
    expect(result.channel).toBe("sync");
    expect(new TextDecoder().decode(result.payload)).toBe("secret canvas");
    expect(new TextDecoder().decode(frame)).not.toContain("secret canvas");
  });

  it("binds ciphertext to its room", async () => {
    const cryptoKey = await importCollaborationRelayKey(key);
    const frame = await encryptCollaborationRelayPayload(
      cryptoKey,
      "room-a",
      "awareness",
      Uint8Array.of(1, 2, 3)
    );
    await expect(
      decryptCollaborationRelayPayload(cryptoKey, "room-b", frame)
    ).rejects.toThrow();
    frame[frame.length - 1] ^= 1;
    await expect(
      decryptCollaborationRelayPayload(cryptoKey, "room-a", frame)
    ).rejects.toThrow();
  });
});
