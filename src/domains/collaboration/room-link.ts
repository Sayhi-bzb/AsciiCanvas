import type { CollaborationDescriptorV1 } from "./model";

const ROOM_PARAM = "room";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

const randomToken = (byteLength: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

export const validateCollaborationEndpoint = (value: string) => {
  try {
    const endpoint = new URL(value);
    const isLocal = endpoint.hostname === "localhost" || endpoint.hostname === "127.0.0.1" || endpoint.hostname === "[::1]";
    if (endpoint.protocol !== "wss:" && !(endpoint.protocol === "ws:" && isLocal)) {
      return null;
    }
    endpoint.hash = "";
    endpoint.search = "";
    return endpoint.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
};

export const createCollaborationDescriptor = (
  endpoint?: string
): CollaborationDescriptorV1 => {
  const roomId = randomToken(16);
  const key = randomToken(32);
  if (endpoint) {
    const normalizedEndpoint = validateCollaborationEndpoint(endpoint);
    if (!normalizedEndpoint) throw new Error("Invalid collaboration endpoint");
    return { version: 1, provider: "websocket", roomId, key, endpoint: normalizedEndpoint };
  }
  return { version: 1, provider: "p2p", roomId, key };
};

export const isCollaborationDescriptor = (
  value: unknown
): value is CollaborationDescriptorV1 => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== 1 ||
    (candidate.provider !== "p2p" && candidate.provider !== "websocket") ||
    typeof candidate.roomId !== "string" ||
    candidate.roomId.length < 16 ||
    !TOKEN_PATTERN.test(candidate.roomId) ||
    typeof candidate.key !== "string" ||
    candidate.key.length < 40 ||
    !TOKEN_PATTERN.test(candidate.key)
  ) return false;
  return candidate.provider === "p2p"
    ? candidate.endpoint === undefined
    : typeof candidate.endpoint === "string" &&
        validateCollaborationEndpoint(candidate.endpoint) === candidate.endpoint;
};

const encodeDescriptor = (descriptor: CollaborationDescriptorV1) => {
  const bytes = new TextEncoder().encode(JSON.stringify(descriptor));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const decodeDescriptor = (encoded: string): unknown => {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

export const buildCollaborationUrl = (
  descriptor: CollaborationDescriptorV1,
  baseUrl = window.location.href
) => {
  const url = new URL(baseUrl);
  url.searchParams.delete(ROOM_PARAM);
  url.hash = new URLSearchParams({ [ROOM_PARAM]: encodeDescriptor(descriptor) }).toString();
  return url.toString();
};

export const parseCollaborationUrl = (urlValue = window.location.href) => {
  try {
    const url = new URL(urlValue);
    const encoded = new URLSearchParams(url.hash.slice(1)).get(ROOM_PARAM);
    if (!encoded) return null;
    const descriptor = decodeDescriptor(encoded);
    return isCollaborationDescriptor(descriptor) ? descriptor : null;
  } catch {
    return null;
  }
};

export const sameCollaborationRoom = (
  left: CollaborationDescriptorV1 | undefined,
  right: CollaborationDescriptorV1 | null
) => !!left && !!right && left.provider === right.provider && left.roomId === right.roomId && left.key === right.key;

