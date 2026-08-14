import { describe, expect, it } from "vitest";
import { CanvasDraftService, validateStyledCanvas } from "./drafts.js";

describe("CanvasDraftService", () => {
  it("commits style-only ANSI with a stable geometry signature", () => {
    const drafts = new CanvasDraftService({ createId: () => "draft-1" });
    const draft = drafts.create("A界\n B");
    const applied = drafts.apply(
      draft.draftId,
      draft.revision,
      "[31mA界[0m\n [1mB[0m"
    );

    expect(applied).toMatchObject({
      accepted: true,
      draftId: "draft-1",
      revision: 2,
      geometrySignature: draft.geometrySignature,
    });
  });

  it("keeps a draft open after a retryable geometry mismatch", () => {
    const drafts = new CanvasDraftService({ createId: () => "draft-1" });
    drafts.create("box");

    expect(drafts.apply("draft-1", 1, "[31mbax[0m")).toMatchObject({
      accepted: false,
      code: "geometry-mismatch",
      retryable: true,
    });
    expect(drafts.apply("draft-1", 1, "[31mbox[0m")).toMatchObject({
      accepted: true,
    });
  });

  it("rejects ANSI in the plain phase and malformed ANSI in styling", () => {
    const drafts = new CanvasDraftService();
    expect(() => drafts.create("[31mred[0m")).toThrow(/plain phase/);
    expect(validateStyledCanvas("red", "[999mred[0m")).toMatchObject({
      accepted: false,
      code: "invalid-ansi",
    });
  });

  it("rejects stale, expired, and duplicate commits", () => {
    let now = 1_000;
    const drafts = new CanvasDraftService({
      createId: () => "draft-1",
      now: () => now,
      ttlMs: 100,
    });
    drafts.create("A");

    expect(drafts.apply("draft-1", 2, "[31mA[0m")).toMatchObject({
      code: "revision-mismatch",
    });
    const committed = drafts.apply("draft-1", 1, "[31mA[0m");
    expect(committed).toMatchObject({ accepted: true, revision: 2 });
    expect(drafts.apply("draft-1", 2, "[34mA[0m")).toMatchObject({
      code: "already-committed",
    });

    const expiring = new CanvasDraftService({
      createId: () => "draft-2",
      now: () => now,
      ttlMs: 100,
    });
    expiring.create("A");
    now += 101;
    expect(expiring.apply("draft-2", 1, "[31mA[0m")).toMatchObject({
      code: "draft-expired",
    });
  });
});
