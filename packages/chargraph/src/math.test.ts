import { describe, expect, it } from "vitest";
import { getCharGraphText } from "./fragments.js";
import { renderMath } from "./math.js";

describe("renderMath", () => {
  it("renders inline formulas as compact Unicode", () => {
    const source = String.raw`x^2 + \frac{1}{2}`;
    const rendered = renderMath(source, { layout: "inline" });

    expect(getCharGraphText(rendered)).toBe("x² + 1/2");
    expect(rendered.diagnostics).toEqual([]);
    expect(rendered.fragments[0]?.origin).toEqual({ from: 0, to: source.length });
  });

  it("renders block fractions and matrices as two-dimensional cells", () => {
    const fraction = renderMath(String.raw`\frac{a+b}{c+d}`, { layout: "block" });
    const matrix = renderMath(
      String.raw`\begin{matrix}a&b\\c&d\end{matrix}`,
      { layout: "block" }
    );

    expect(getCharGraphText(fraction)).toBe(" a + b\n───────\n c + d");
    expect(getCharGraphText(matrix)).toBe("⎡a  b⎤\n⎣c  d⎦");
  });

  it("aligns radicals and operator limits around a block baseline", () => {
    const radical = renderMath(String.raw`\sqrt{x+1}`, { layout: "block" });
    const sum = renderMath(String.raw`\sum_{i=1}^{n} i`, { layout: "block" });

    expect(getCharGraphText(radical)).toBe("  ─────\n √x + 1");
    expect(getCharGraphText(sum)).toBe("  n\n  ∑  i\ni = 1");
  });

  it("preserves invalid TeX with a diagnostic", () => {
    const rendered = renderMath(String.raw`\frac{a`, { layout: "block" });

    expect(getCharGraphText(rendered)).toBe(String.raw`\frac{a`);
    expect(rendered.diagnostics[0]?.code).toBe("math-render-failed");
  });
});
