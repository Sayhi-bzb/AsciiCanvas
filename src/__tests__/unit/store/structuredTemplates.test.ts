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
      "switch",
      "alert",
      "tabs",
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
      "status",
      "accordion",
      "avatar",
      "breadcrumb",
      "calendar",
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
      position: { x: 4, y: 7 },
      text: "[BUTTON]",
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
    expect(build("checkbox")).toMatchObject([
      {
        type: "text",
        order: 10,
        position: { x: 4, y: 7 },
        text: "󰱒 checkbox 1",
      },
      {
        type: "text",
        order: 11,
        position: { x: 4, y: 8 },
        text: "󰄱 checkbox 2",
      },
    ]);
    expect(build("radio")).toMatchObject([
      {
        type: "text",
        order: 10,
        position: { x: 4, y: 7 },
        text: "󰄰 radio 1",
      },
      {
        type: "text",
        order: 11,
        position: { x: 4, y: 8 },
        text: "󰄳 radio 2",
      },
      {
        type: "text",
        order: 12,
        position: { x: 4, y: 9 },
        text: "󰄰 radio 3",
      },
    ]);
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
      end: { x: 12, y: 7 },
      style: { color: "#000000", bgColor: "#dcfcf3" },
    });
    expect(nodes[1]).toMatchObject({
      type: "text",
      position: { x: 5, y: 7 },
      text: " badge",
      style: { color: "#0d9488" },
    });
  });

  it("builds demo surface components as structured nodes", () => {
    expect(build("switch")).toMatchObject([
      {
        type: "text",
        position: { x: 4, y: 7 },
        text: "󰨙 Switch",
      },
    ]);

    expect(build("alert")).toMatchObject([
      {
        type: "box",
        start: { x: 4, y: 7 },
        end: { x: 27, y: 10 },
        style: { color: "#0d9488" },
      },
      {
        type: "text",
        position: { x: 6, y: 8 },
        text: "󰄳",
        style: { color: "#0d9488" },
      },
      {
        type: "text",
        position: { x: 9, y: 8 },
        text: "AlertTitle",
      },
      {
        type: "text",
        position: { x: 9, y: 9 },
        text: "AlertDescription",
      },
    ]);

    expect(build("tabs")[0]).toMatchObject({
      type: "text",
      position: { x: 4, y: 7 },
      text: "tab 1 | tab 2 | tab 3",
      styleRanges: [
        {
          start: 7,
          end: 14,
          style: {
            color: "#2563eb",
            bgColor: "#eff6ff",
            attrs: { underline: true },
          },
        },
      ],
    });

    expect(build("avatar")[0]).toMatchObject({
      type: "text",
      text: "󰀉 󰭕 󰭕",
      styleRanges: [
        { start: 0, end: 1, style: { color: "#0d9488" } },
        { start: 2, end: 5, style: { color: "#64748b" } },
      ],
    });

    expect(build("breadcrumb")[0]).toMatchObject({
      type: "text",
      text: "BreadcrumbItem / ... / BreadcrumbItem",
    });
  });

  it("builds calendar with bg containers and selected day styling", () => {
    const nodes = build("calendar");
    expect(nodes).toHaveLength(8);
    expect(nodes.slice(0, 4)).toMatchObject([
      {
        type: "bg",
        start: { x: 4, y: 7 },
        end: { x: 29, y: 8 },
        style: { color: "#000000", bgColor: "#f3f4f6" },
      },
      {
        type: "text",
        position: { x: 4, y: 7 },
        text: "󰃭  July 2026          󰁍  󰁔",
      },
      {
        type: "text",
        position: { x: 4, y: 8 },
        text: "Su  Mo  Tu  We  Th  Fr  Sa",
        style: { color: "#9ca3af" },
      },
      {
        type: "text",
        position: { x: 4, y: 9 },
        text: "28  29  30  01  02  03  04",
        styleRanges: [
          { start: 0, end: 12, style: { color: "#9ca3af" } },
          {
            start: 15,
            end: 19,
            style: { color: "#1d4ed8", bgColor: "#dbeafe" },
          },
        ],
      },
    ]);
  });

  it("builds input, divider, and card layout templates", () => {
    expect(build("input")).toMatchObject([
      {
        type: "bg",
        start: { x: 10, y: 7 },
        end: { x: 29, y: 7 },
        style: { color: "#000000", bgColor: "#dbeafe" },
      },
      {
        type: "text",
        position: { x: 4, y: 7 },
        text: "Name: [ Ascii-Canvas |   ]",
        style: { color: "#000000" },
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

  it("builds status as separate styled text rows", () => {
    expect(build("status")).toMatchObject([
      {
        type: "text",
        order: 10,
        position: { x: 4, y: 7 },
        text: "󰄳 Success",
        style: { color: "#22c55e" },
      },
      {
        type: "text",
        order: 11,
        position: { x: 4, y: 8 },
        text: " Warning",
        style: { color: "#eab308" },
      },
      {
        type: "text",
        order: 12,
        position: { x: 4, y: 9 },
        text: " Error",
        style: { color: "#ef4444" },
      },
      {
        type: "text",
        order: 13,
        position: { x: 4, y: 10 },
        text: " Loading",
        style: { color: "#64748b" },
      },
    ]);
  });

  it("builds accordion with a background container below text", () => {
    expect(build("accordion")).toMatchObject([
      {
        type: "bg",
        order: 10,
        start: { x: 4, y: 8 },
        end: { x: 23, y: 9 },
        style: { color: "#000000", bgColor: "#e2e8f0" },
      },
      {
        type: "text",
        order: 11,
        position: { x: 4, y: 7 },
        text: "Accordion          󰅃",
        style: { color: "#000000", attrs: { bold: true, underline: true } },
      },
      {
        type: "text",
        order: 12,
        position: { x: 4, y: 8 },
        text: "AccordionContent",
      },
      {
        type: "text",
        order: 13,
        position: { x: 4, y: 10 },
        text: "Accordion          󰅀",
        style: { color: "#000000", attrs: { bold: true } },
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
      "[BUTTON]"
    );
    expect(buttonPreview.rows[0].every((cell) => cell.bgColor === "#dbeafe")).toBe(
      true
    );

    const badgePreview = buildStructuredTemplatePreview("badge");
    expect(badgePreview).toMatchObject({ width: 9, height: 1 });
    expect(badgePreview.rows[0].map((cell) => cell.char).join("")).toBe(
      "  badge "
    );
    expect(badgePreview.rows[0].every((cell) => cell.bgColor === "#dcfcf3")).toBe(
      true
    );
    expect(badgePreview.rows[0][1].color).toBe("#0d9488");

    const tabsPreview = buildStructuredTemplatePreview("tabs");
    expect(tabsPreview.rows[0].map((cell) => cell.char).join("")).toBe(
      "tab 1 | tab 2 | tab 3"
    );
    expect(tabsPreview.rows[0][7]).toMatchObject({
      color: "#2563eb",
      bgColor: "#eff6ff",
      attrs: { underline: true },
    });

    const alertPreview = buildStructuredTemplatePreview("alert");
    expect(alertPreview).toMatchObject({ width: 24, height: 4 });
    expect(alertPreview.rows[1].map((cell) => cell.char).join("")).toContain(
      "AlertTitle"
    );
    expect(alertPreview.rows[1][0].color).toBe("#0d9488");

    const inputPreview = buildStructuredTemplatePreview("input");
    expect(inputPreview).toMatchObject({ width: 26, height: 1 });
    expect(inputPreview.rows[0].map((cell) => cell.char).join("")).toBe(
      "Name: [ Ascii-Canvas |   ]"
    );
    expect(inputPreview.rows[0].slice(0, 6).some((cell) => cell.bgColor)).toBe(
      false
    );
    expect(
      inputPreview.rows[0].slice(6, 26).every((cell) => cell.bgColor === "#dbeafe")
    ).toBe(true);

    const checkboxPreview = buildStructuredTemplatePreview("checkbox");
    expect(checkboxPreview).toMatchObject({ width: 12, height: 2 });
    expect(checkboxPreview.rows[0].map((cell) => cell.char).join("")).toBe(
      "󰱒 checkbox 1"
    );
    expect(checkboxPreview.rows[1].map((cell) => cell.char).join("")).toBe(
      "󰄱 checkbox 2"
    );

    const radioPreview = buildStructuredTemplatePreview("radio");
    expect(radioPreview).toMatchObject({ width: 9, height: 3 });
    expect(radioPreview.rows[0].map((cell) => cell.char).join("")).toBe(
      "󰄰 radio 1"
    );
    expect(radioPreview.rows[1].map((cell) => cell.char).join("")).toBe(
      "󰄳 radio 2"
    );
    expect(radioPreview.rows[2].map((cell) => cell.char).join("")).toBe(
      "󰄰 radio 3"
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

    const statusPreview = buildStructuredTemplatePreview("status");
    expect(statusPreview).toMatchObject({ width: 9, height: 4 });
    expect(statusPreview.rows[0].map((cell) => cell.char).join("")).toBe(
      "󰄳 Success"
    );
    expect(statusPreview.rows[1][0].color).toBe("#eab308");
    expect(statusPreview.rows[2][0].color).toBe("#ef4444");
    expect(statusPreview.rows[3][0].color).toBe("#64748b");

    const accordionPreview = buildStructuredTemplatePreview("accordion");
    expect(accordionPreview).toMatchObject({ width: 20, height: 4 });
    expect(accordionPreview.rows[0].map((cell) => cell.char).join("")).toBe(
      "Accordion          󰅃"
    );
    expect(accordionPreview.rows[0][0].attrs).toEqual({
      bold: true,
      underline: true,
    });
    expect(
      accordionPreview.rows[1].every((cell) => cell.bgColor === "#e2e8f0")
    ).toBe(true);
    expect(
      accordionPreview.rows[2].every((cell) => cell.bgColor === "#e2e8f0")
    ).toBe(true);
    expect(accordionPreview.rows[1].map((cell) => cell.char).join("")).toContain(
      "AccordionContent"
    );
    expect(accordionPreview.rows[3][0].attrs).toEqual({ bold: true });

    const avatarPreview = buildStructuredTemplatePreview("avatar");
    expect(avatarPreview.rows[0].map((cell) => cell.char).join("")).toBe(
      "󰀉 󰭕 󰭕"
    );
    expect(avatarPreview.rows[0][0].color).toBe("#0d9488");
    expect(avatarPreview.rows[0][2].color).toBe("#64748b");

    const breadcrumbPreview = buildStructuredTemplatePreview("breadcrumb");
    expect(breadcrumbPreview.rows[0].map((cell) => cell.char).join("")).toBe(
      "BreadcrumbItem / ... / BreadcrumbItem"
    );

    const calendarPreview = buildStructuredTemplatePreview("calendar");
    expect(calendarPreview).toMatchObject({ width: 26, height: 7 });
    expect(calendarPreview.rows.map((row) => row.map((cell) => cell.char).join(""))).toEqual([
      "󰃭  July 2026          󰁍  󰁔",
      "Su  Mo  Tu  We  Th  Fr  Sa",
      "28  29  30  01  02  03  04",
      "05  06  07  08  09  10  11",
      "12  13  14  15  16  17  18",
      "19  20  21  22  23  24  25",
      "26  27  28  29  30  31  01",
    ]);
    expect(calendarPreview.rows[0].every((cell) => cell.bgColor === "#f3f4f6")).toBe(true);
    expect(calendarPreview.rows[1].every((cell) => cell.bgColor === "#f3f4f6")).toBe(true);
    expect(calendarPreview.rows[1][0]).toMatchObject({
      color: "#9ca3af",
      bgColor: "#f3f4f6",
    });
    expect(calendarPreview.rows[2][15]).toMatchObject({
      color: "#1d4ed8",
      bgColor: "#dbeafe",
    });
    expect(calendarPreview.rows[6][23]).toMatchObject({
      color: "#9ca3af",
    });
  });

  it("returns an empty scene for unsupported ids at runtime", () => {
    expect(buildStructuredTemplateNodes(
      "unknown" as StructuredTemplateId,
      { x: 4, y: 7 },
      { brushColor: "#334155", startOrder: 10 }
    )).toEqual([]);
  });
});
