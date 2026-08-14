import { randomUUID } from "node:crypto";
import {
  compareCharDeskGeometry,
  createCharDeskGeometrySnapshot,
  parseCharDeskText,
} from "@chardesk/protocol";
import type {
  CharDeskGeometryComparison,
  CharDeskGeometryMismatch,
  CharDeskTextDiagnostic,
} from "@chardesk/protocol";

type CanvasDraft = {
  draftId: string;
  revision: number;
  canonicalPlainText: string;
  geometrySignature: string;
  expiresAt: string;
};

type CanvasStyleSuccess = {
  accepted: true;
  draftId: string;
  revision: number;
  ansiText: string;
  geometrySignature: string;
};

type CanvasStyleFailure = {
  accepted: false;
  code:
    | "draft-not-found"
    | "draft-expired"
    | "revision-mismatch"
    | "already-committed"
    | "ansi-required"
    | "invalid-ansi"
    | "geometry-mismatch";
  message: string;
  retryable: boolean;
  diagnostics?: CharDeskTextDiagnostic[];
  mismatch?: CharDeskGeometryMismatch;
  expectedGeometrySignature?: string;
  actualGeometrySignature?: string;
};

type StoredDraft = CanvasDraft & {
  expiresAtMs: number;
  status: "open" | "committed";
};

type CanvasDraftServiceOptions = {
  ttlMs?: number;
  maxDrafts?: number;
  now?: () => number;
  createId?: () => string;
};

const DEFAULT_TTL_MS = 15 * 60 * 1_000;
const DEFAULT_MAX_DRAFTS = 1_000;

export const validateStyledCanvas = (
  canonicalPlainText: string,
  ansiText: string
): CanvasStyleFailure | { accepted: true; comparison: CharDeskGeometryComparison } => {
  const parsed = parseCharDeskText(ansiText, { syntax: "ansi" });
  if (parsed.diagnostics.length > 0) {
    return {
      accepted: false,
      code: "invalid-ansi",
      message: "ANSI text contains malformed or unsupported controls.",
      retryable: true,
      diagnostics: parsed.diagnostics,
    };
  }
  if (!parsed.hasAnsi) {
    return {
      accepted: false,
      code: "ansi-required",
      message: "The styling phase must include at least one supported ANSI control.",
      retryable: true,
    };
  }

  const comparison = compareCharDeskGeometry(canonicalPlainText, ansiText);
  if (!comparison.matches) {
    return {
      accepted: false,
      code: "geometry-mismatch",
      message: comparison.mismatch?.message ?? "ANSI styling changed the canvas.",
      retryable: true,
      ...(comparison.mismatch ? { mismatch: comparison.mismatch } : {}),
      expectedGeometrySignature: comparison.expected.signature,
      actualGeometrySignature: comparison.actual.signature,
    };
  }
  return { accepted: true, comparison };
};

export class CanvasDraftService {
  readonly #drafts = new Map<string, StoredDraft>();
  readonly #ttlMs: number;
  readonly #maxDrafts: number;
  readonly #now: () => number;
  readonly #createId: () => string;

  constructor(options: CanvasDraftServiceOptions = {}) {
    this.#ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.#maxDrafts = options.maxDrafts ?? DEFAULT_MAX_DRAFTS;
    this.#now = options.now ?? Date.now;
    this.#createId = options.createId ?? randomUUID;
  }

  create(plainText: string): CanvasDraft {
    const detected = parseCharDeskText(plainText, { syntax: "auto" });
    if (detected.hasAnsi) {
      throw new Error("The plain phase must not include ANSI or OSC controls.");
    }
    if (detected.diagnostics.length > 0) {
      throw new Error("The plain phase contains unsupported control characters.");
    }

    this.#removeExpired();
    if (this.#drafts.size >= this.#maxDrafts) {
      const oldestId = this.#drafts.keys().next().value as string | undefined;
      if (oldestId) this.#drafts.delete(oldestId);
    }

    const now = this.#now();
    const snapshot = createCharDeskGeometrySnapshot(plainText, { syntax: "plain" });
    const draft: StoredDraft = {
      draftId: this.#createId(),
      revision: 1,
      canonicalPlainText: snapshot.plainText,
      geometrySignature: snapshot.signature,
      expiresAt: new Date(now + this.#ttlMs).toISOString(),
      expiresAtMs: now + this.#ttlMs,
      status: "open",
    };
    this.#drafts.set(draft.draftId, draft);
    return this.#publicDraft(draft);
  }

  apply(
    draftId: string,
    revision: number,
    ansiText: string
  ): CanvasStyleSuccess | CanvasStyleFailure {
    const draft = this.#drafts.get(draftId);
    if (!draft) {
      return {
        accepted: false,
        code: "draft-not-found",
        message: "No canvas draft exists for this id.",
        retryable: false,
      };
    }
    if (draft.expiresAtMs <= this.#now()) {
      this.#drafts.delete(draftId);
      return {
        accepted: false,
        code: "draft-expired",
        message: "The canvas draft expired; create a new plain draft.",
        retryable: false,
      };
    }
    if (revision !== draft.revision) {
      return {
        accepted: false,
        code: "revision-mismatch",
        message: `Expected revision ${draft.revision}, received ${revision}.`,
        retryable: false,
      };
    }
    if (draft.status === "committed") {
      return {
        accepted: false,
        code: "already-committed",
        message: "This canvas draft was already committed.",
        retryable: false,
      };
    }

    const validation = validateStyledCanvas(draft.canonicalPlainText, ansiText);
    if (!validation.accepted) return validation;

    draft.status = "committed";
    draft.revision += 1;
    return {
      accepted: true,
      draftId,
      revision: draft.revision,
      ansiText,
      geometrySignature: validation.comparison.actual.signature,
    };
  }

  #removeExpired() {
    const now = this.#now();
    for (const [draftId, draft] of this.#drafts) {
      if (draft.expiresAtMs <= now) this.#drafts.delete(draftId);
    }
  }

  #publicDraft(draft: StoredDraft): CanvasDraft {
    return {
      draftId: draft.draftId,
      revision: draft.revision,
      canonicalPlainText: draft.canonicalPlainText,
      geometrySignature: draft.geometrySignature,
      expiresAt: draft.expiresAt,
    };
  }
}
