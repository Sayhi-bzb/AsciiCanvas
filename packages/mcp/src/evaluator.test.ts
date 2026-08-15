import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publishCanvasFiles } from "./authoring.js";
import { compareCanvasEvalResults, evaluateCanvasRun } from "./evaluator.js";

describe("Canvas ergonomic evaluator", () => {
  it("scores persisted artifacts and trace costs", async () => {
    const root = await mkdtemp(join(tmpdir(), "chardesk-eval-"));
    const work = join(root, ".chardesk", "work", "login");
    await mkdir(work, { recursive: true });
    await Promise.all([
      writeFile(join(work, "plain.txt"), "登录\n提交", "utf8"),
      writeFile(join(work, "styled.ans"), "[1;96m登录[0m\n提交", "utf8"),
      writeFile(
        join(work, "trace.jsonl"),
        [
          JSON.stringify({ type: "tool_call", tool: "apply_patch", input: "styled.ans", input_chars: 80 }),
          JSON.stringify({ type: "validation_result", accepted: true, output_chars: 8, wall_ms: 4 }),
        ].join("\n"),
        "utf8"
      ),
    ]);
    await publishCanvasFiles(
      join(work, "plain.txt"),
      join(work, "styled.ans"),
      join(root, "login.chardesk")
    );

    const score = await evaluateCanvasRun(
      {
        id: "sparse-cjk",
        artifact: "login",
        expected_plain: "登录\n提交",
        required_styles: [{ text: "登录", color: "#00ffff", attrs: ["bold"] }],
      },
      root
    );
    expect(score).toMatchObject({
      published: true,
      protocol_valid: true,
      goal_score: 1,
      first_pass_accepted: true,
      estimated_tokens: 22,
    });
    expect(score.default_style_utilization).toBeGreaterThan(0);
  });

  it("ranks success before efficiency", () => {
    const base = {
      case_id: "x", published: true, protocol_valid: true, goal_score: 1,
      first_pass_accepted: true, validation_attempts: 1, tool_calls: 2, patch_calls: 2,
      estimated_tokens: 100, wall_ms: 1, second_phase_patch_chars: 20,
      explicit_style_coverage: 0.2, default_style_utilization: 0.8,
      sgr_sequence_count: 2, sgr_per_grapheme: 0.1,
    };
    expect(compareCanvasEvalResults(base, { ...base, published: false, estimated_tokens: 1 })).toBe(-1);
  });
});
