import {
  COLLABORATION_DOCUMENT_VERSION,
  type CollaborationCanvasMode,
  type CollaborationDescriptor,
  type CollaborationDescriptorV6,
  type CollaborationLinkParseResult,
} from "./model";

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
  mode: CollaborationCanvasMode,
  endpoint?: string
): CollaborationDescriptorV6 => {
  const roomId = randomToken(16);
  const key = randomToken(32);
  if (endpoint) {
    const normalizedEndpoint = validateCollaborationEndpoint(endpoint);
    if (!normalizedEndpoint) throw new Error("Invalid collaboration endpoint");
    return {
      version: 6,
      documentVersion: COLLABORATION_DOCUMENT_VERSION,
      mode,
      provider: "websocket",
      roomId,
      key,
      endpoint: normalizedEndpoint,
    };
  }
  return {
    version: 6,
    documentVersion: COLLABORATION_DOCUMENT_VERSION,
    mode,
    provider: "p2p",
    roomId,
    key,
  };
};

export const isCollaborationDescriptor = (
  value: unknown
): value is CollaborationDescriptor => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== 6 ||
    candidate.documentVersion !== COLLABORATION_DOCUMENT_VERSION ||
    (candidate.mode !== "freeform" && candidate.mode !== "structured") ||
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

export const getCollaborationDocumentId = (
  descriptor: Pick<CollaborationDescriptor, "roomId">
) => `collaboration:${descriptor.roomId}`;

const encodeDescriptor = (descriptor: CollaborationDescriptor) => {
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
  descriptor: CollaborationDescriptor,
  baseUrl = window.location.href
) => {
  const url = new URL(baseUrl);
  url.searchParams.delete(ROOM_PARAM);
  url.hash = new URLSearchParams({ [ROOM_PARAM]: encodeDescriptor(descriptor) }).toString();
  return url.toString();
};

export const parseCollaborationUrl = (
  urlValue = window.location.href
): CollaborationLinkParseResult => {
  try {
    const url = new URL(urlValue);
    const encoded = new URLSearchParams(url.hash.slice(1)).get(ROOM_PARAM);
    if (!encoded) return { status: "none" };
    const descriptor = decodeDescriptor(encoded);
    if (isCollaborationDescriptor(descriptor)) {
      return { status: "valid", descriptor };
    }
    if (descriptor && typeof descriptor === "object" && "version" in descriptor) {
      const version = (descriptor as { version?: unknown }).version;
      return {
        status: "unsupported",
        version: typeof version === "number" ? version : null,
      };
    }
    return { status: "invalid" };
  } catch {
    return { status: "invalid" };
  }
};

export const sameCollaborationRoom = (
  left: CollaborationDescriptor | undefined,
  right: CollaborationDescriptor | null
) =>
  !!left &&
  !!right &&
  left.version === right.version &&
  left.provider === right.provider &&
  left.roomId === right.roomId &&
  left.key === right.key &&
  left.mode === right.mode &&
  left.documentVersion === right.documentVersion &&
  (left.provider !== "websocket" ||
    (right.provider === "websocket" && left.endpoint === right.endpoint));
