import type { CanvasSession } from "@/domains/sessions/public";

export interface CanvasDocumentResidency {
  ensureLoaded(session: CanvasSession): Promise<boolean>;
  setPinnedCanvasIds(ids: readonly string[]): void;
  touch(id: string): void;
  delete(id: string): Promise<void>;
}
