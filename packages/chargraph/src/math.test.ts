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

  it("styles identifiers, operators, and structure from MathML semantics", () => {
    const rendered = renderMath(String.raw`x^2 + \frac{1}{y}`, {
      layout: "inline",
      styles: {
        content: { color: "#111111" },
        operator: { color: "#222222" },
        structure: { color: "#333333" },
      },
    });
    const fragmentFor = (text: string) => rendered.fragments.find(
      (fragment) => fragment.text.includes(text)
    );

    expect(getCharGraphText(rendered)).toBe("x² + 1/y");
    expect(fragmentFor("x")).toMatchObject({
      color: "#111111",
      attrs: { italic: true },
    });
    expect(fragmentFor("²")).toMatchObject({ color: "#111111" });
    expect(fragmentFor("²")?.attrs?.italic).toBeUndefined();
    expect(fragmentFor("+")?.color).toBe("#222222");
    expect(fragmentFor("/")?.color).toBe("#333333");
  });

  it("keeps math text and explicit normal identifiers upright", () => {
    const rendered = renderMath(String.raw`\text{rate}+\mathrm{x}+y`, {
      layout: "inline",
    });
    const fragmentFor = (text: string) => rendered.fragments.find(
      (fragment) => fragment.text.includes(text)
    );

    expect(fragmentFor("rate")?.attrs?.italic).toBeUndefined();
    expect(fragmentFor("x")?.attrs?.italic).toBeUndefined();
    expect(fragmentFor("y")?.attrs?.italic).toBe(true);
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

  it("removes nonvisual MathML operators before creating cells", () => {
    for (const source of [String.raw`V_{\max}`, String.raw`\lim_{x \to 0} x`]) {
      const inline = getCharGraphText(renderMath(source, { layout: "inline" }));
      const block = getCharGraphText(renderMath(source, { layout: "block" }));
      expect(inline).not.toMatch(/[\u2061-\u2064]/u);
      expect(block).not.toMatch(/[\u2061-\u2064]/u);
    }
  });

  it("preserves invalid TeX with a diagnostic", () => {
    const rendered = renderMath(String.raw`\frac{a`, {
      layout: "block",
      styles: { error: { color: "#ff0000" } },
    });

    expect(getCharGraphText(rendered)).toBe(String.raw`\frac{a`);
    expect(rendered.fragments[0]?.color).toBe("#ff0000");
    expect(rendered.diagnostics[0]?.code).toBe("math-render-failed");
  });
});
