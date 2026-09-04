export const COLLABORATION_RELAY_PROTOCOL_VERSION = 1 as const;
export const COLLABORATION_RELAY_NONCE_BYTES = 12;
export const COLLABORATION_RELAY_MAX_FRAME_BYTES = 8 * 1024 * 1024;

export const COLLABORATION_RELAY_CLOSE = {
  invalidRoom: 4400,
  forbiddenOrigin: 4403,
  roomFull: 4409,
  rateLimited: 4429,
  unsupportedProtocol: 4450,
  oversizedFrame: 4451,
} as const;

export type CollaborationRelayChannel =
  | "sync"
  | "awareness"
  | "awareness-query"
  | "sync-query";

const CHANNEL_IDS: Record<CollaborationRelayChannel, number> = {
  sync: 0,
  awareness: 1,
  "awareness-query": 2,
  "sync-query": 3,
};

const CHANNEL_NAMES = ["sync", "awareness", "awareness-query", "sync-query"] as const;

const concat = (...parts: Uint8Array[]) => {
  const length = parts.reduce((total, part) => total + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
};

const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const additionalData = (roomId: string) =>
  new TextEncoder().encode(
    `chardesk-relay-v${COLLABORATION_RELAY_PROTOCOL_VERSION}:${roomId}`
  );

export const importCollaborationRelayKey = async (encodedKey: string) => {
  const bytes = fromBase64Url(encodedKey);
  if (bytes.byteLength !== 32) throw new Error("Invalid collaboration room key");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
};

export const encryptCollaborationRelayPayload = async (
  key: CryptoKey,
  roomId: string,
  channel: CollaborationRelayChannel,
  payload: Uint8Array
) => {
  const nonce = crypto.getRandomValues(new Uint8Array(COLLABORATION_RELAY_NONCE_BYTES));
  const plaintext = concat(Uint8Array.of(CHANNEL_IDS[channel]), payload);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: additionalData(roomId) },
      key,
      plaintext
    )
  );
  const frame = concat(
    Uint8Array.of(COLLABORATION_RELAY_PROTOCOL_VERSION),
    nonce,
    ciphertext
  );
  if (frame.byteLength > COLLABORATION_RELAY_MAX_FRAME_BYTES) {
    throw new Error("Collaboration update is too large");
  }
  return frame;
};

export const inspectCollaborationRelayFrame = (frame: Uint8Array) => {
  if (frame.byteLength < 1 + COLLABORATION_RELAY_NONCE_BYTES + 16) {
    throw new Error("Invalid collaboration relay frame");
  }
  if (frame[0] !== COLLABORATION_RELAY_PROTOCOL_VERSION) {
    throw new Error("Unsupported collaboration relay protocol");
  }
  if (frame.byteLength > COLLABORATION_RELAY_MAX_FRAME_BYTES) {
    throw new Error("Collaboration update is too large");
  }
};

export const decryptCollaborationRelayPayload = async (
  key: CryptoKey,
  roomId: string,
  frame: Uint8Array
): Promise<{ channel: CollaborationRelayChannel; payload: Uint8Array }> => {
  inspectCollaborationRelayFrame(frame);
  const nonceEnd = 1 + COLLABORATION_RELAY_NONCE_BYTES;
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: frame.slice(1, nonceEnd),
        additionalData: additionalData(roomId),
      },
      key,
      frame.slice(nonceEnd)
    )
  );
  const channel = CHANNEL_NAMES[plaintext[0] ?? -1];
  if (!channel) throw new Error("Unknown collaboration relay channel");
  return { channel, payload: plaintext.slice(1) };
};
