import { describe, expect, it } from "vitest";
import {
  STRUCTURED_TEMPLATES,
  buildStructuredTemplatePreview,
  buildStructuredTemplateNodes,
  getActiveStructuredTemplateDragId,
  isStructuredTemplateId,
  setActiveStructuredTemplateDragId,
  type StructuredTemplateId,
} from "@/domains/canvas/state/helpers/structuredTemplates";

describe("structuredTemplates", () => {
  const build = (templateId: StructuredTemplateId) =>
    buildStructuredTemplateNodes(
      templateId,
      { x: 4, y: 7 },
      { brushColor: "#334155", startOrder: 10 }
    );

  it("registers the basic structured templates", () => {
    expect(STRUCTURED_TEMPLATES.map((template) => template.id)).toEqual([
      "button",
      "label",
      "badge",
      "input",
      "checkbox",
      "radio",
      "divider",
      "card",
      "textarea",
      "select",
      "link",
      "listItem",
      "field",
      "formRow",
    ]);
  });

  it("validates structured template ids", () => {
    expect(isStructuredTemplateId("badge")).toBe(true);
    expect(isStructuredTemplateId("unknown")).toBe(false);
    expect(isStructuredTemplateId(null)).toBe(false);
  });

  it("tracks the active structured template drag id", () => {
    setActiveStructuredTemplateDragId("label");
    expect(getActiveStructuredTemplateDragId()).toBe("label");
    setActiveStructuredTemplateDragId(null);
    expect(getActiveStructuredTemplateDragId()).toBeNull();
  });

  it("builds a button template as a bg layer plus text", () => {
    const nodes = build("button");

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({
      type: "bg",
      order: 10,
      start: { x: 4, y: 7 },
      end: { x: 11, y: 7 },
      style: { color: "#000000", bgColor: "#dbeafe" },
    });
    expect(nodes[1]).toMatchObject({
      type: "text",
      order: 11,
      position: { x: 5, y: 7 },
      text: "BUTTON",
      style: { color: "#000000" },
    });
  });

  it("builds text-only atom templates", () => {
    expect(build("label")[0]).toMatchObject({
      type: "text",
      position: { x: 4, y: 7 },
      text: "Label",
      style: { color: "#000000" },
    });
    expect(build("checkbox")[0]).toMatchObject({
      type: "text",
      text: "[ ] Label",
    });
    expect(build("radio")[0]).toMatchObject({
      type: "text",
      text: "( ) Option",
    });
    expect(build("link")[0]).toMatchObject({
      type: "text",
      text: "Link ->",
    });
    expect(build("listItem")[0]).toMatchObject({
      type: "text",
      text: "- Item",
    });
  });

  it("builds a badge template without following the brush color", () => {
    const nodes = build("badge");

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({
      type: "bg",
      start: { x: 4, y: 7 },
      end: { x: 11, y: 7 },
      style: { color: "#000000", bgColor: "#dcfce7" },
    });
    expect(nodes[1]).toMatchObject({
      type: "text",
      position: { x: 5, y: 7 },
      text: "STATUS",
    });
  });

  it("builds input, divider, and card layout templates", () => {
    expect(build("input")).toMatchObject([
      {
        type: "box",
        start: { x: 4, y: 7 },
        end: { x: 17, y: 9 },
        style: { color: "#000000" },
      },
      {
        type: "text",
        position: { x: 6, y: 8 },
        text: "Enter text",
      },
    ]);
    expect(build("divider")[0]).toMatchObject({
      type: "line",
      start: { x: 4, y: 7 },
      end: { x: 15, y: 7 },
      axis: "horizontal",
      style: { color: "#000000" },
    });
    expect(build("card")).toMatchObject([
      {
        type: "box",
        start: { x: 4, y: 7 },
        end: { x: 19, y: 11 },
        name: "Card",
      },
    ]);
  });

  it("builds form atom layout templates", () => {
    expect(build("textarea")).toMatchObject([
      {
        type: "box",
        start: { x: 4, y: 7 },
        end: { x: 21, y: 11 },
      },
      {
        type: "text",
        position: { x: 6, y: 8 },
        text: "Multiline",
      },
      {
        type: "text",
        position: { x: 6, y: 9 },
        text: "text...",
      },
    ]);

    expect(build("select")).toMatchObject([
      {
        type: "box",
        start: { x: 4, y: 7 },
        end: { x: 17, y: 9 },
      },
      {
        type: "text",
        position: { x: 6, y: 8 },
        text: "Option",
      },
      {
        type: "text",
        position: { x: 15, y: 8 },
        text: "v",
      },
    ]);

    expect(build("field")).toMatchObject([
      {
        type: "text",
        position: { x: 4, y: 7 },
        text: "Label",
      },
      {
        type: "box",
        start: { x: 4, y: 8 },
        end: { x: 19, y: 10 },
      },
      {
        type: "text",
        position: { x: 6, y: 9 },
        text: "Value",
      },
    ]);

    expect(build("formRow")).toMatchObject([
      {
        type: "text",
        position: { x: 4, y: 8 },
        text: "Label",
      },
      {
        type: "box",
        start: { x: 12, y: 7 },
        end: { x: 29, y: 9 },
      },
      {
        type: "text",
        position: { x: 14, y: 8 },
        text: "Value",
      },
    ]);
  });

  it("builds previews from each template node structure", () => {
    const labelPreview = buildStructuredTemplatePreview("label");
    expect(labelPreview).toMatchObject({ width: 5, height: 1 });
    expect(labelPreview.rows[0].map((cell) => cell.char).join("")).toBe("Label");
    expect(labelPreview.rows[0].some((cell) => cell.bgColor)).toBe(false);

    const buttonPreview = buildStructuredTemplatePreview("button");
    expect(buttonPreview).toMatchObject({ width: 8, height: 1 });
    expect(buttonPreview.rows[0].map((cell) => cell.char).join("")).toBe(
      " BUTTON "
    );
    expect(buttonPreview.rows[0].every((cell) => cell.bgColor === "#dbeafe")).toBe(
      true
    );

    const cardPreview = buildStructuredTemplatePreview("card");
    expect(cardPreview).toMatchObject({ width: 16, height: 5 });
    expect(cardPreview.rows[0].map((cell) => cell.char).join("")).toContain(
      "Card"
    );

    const textareaPreview = buildStructuredTemplatePreview("textarea");
    expect(textareaPreview).toMatchObject({ width: 18, height: 5 });
    expect(textareaPreview.rows[1].map((cell) => cell.char).join("")).toContain(
      "Multiline"
    );
    expect(textareaPreview.rows[2].map((cell) => cell.char).join("")).toContain(
      "text..."
    );

    const selectPreview = buildStructuredTemplatePreview("select");
    expect(selectPreview).toMatchObject({ width: 14, height: 3 });
    expect(selectPreview.rows[1].map((cell) => cell.char).join("")).toContain(
      "Option"
    );
    expect(selectPreview.rows[1].map((cell) => cell.char).join("")).toContain(
      "v"
    );

    const fieldPreview = buildStructuredTemplatePreview("field");
    expect(fieldPreview).toMatchObject({ width: 16, height: 4 });
    expect(fieldPreview.rows[0].map((cell) => cell.char).join("")).toContain(
      "Label"
    );
    expect(fieldPreview.rows[2].map((cell) => cell.char).join("")).toContain(
      "Value"
    );
  });

  it("returns an empty scene for unsupported ids at runtime", () => {
    expect(buildStructuredTemplateNodes(
      "unknown" as StructuredTemplateId,
      { x: 4, y: 7 },
      { brushColor: "#334155", startOrder: 10 }
    )).toEqual([]);
  });
});
