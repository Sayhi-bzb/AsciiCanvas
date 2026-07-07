import { describe, expect, it } from "vitest";
import {
  STRUCTURED_COMPONENT_TEMPLATES,
  STRUCTURED_PAGE_TEMPLATES,
  STRUCTURED_TEMPLATES,
  buildStructuredTemplate,
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
    expect(STRUCTURED_COMPONENT_TEMPLATES.map((template) => template.id)).toEqual([
      "button",
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
      "status",
      "accordion",
      "avatar",
      "breadcrumb",
      "calendar",
      "barChart",
      "lineChart",
      "table",
      "pagination",
      "slider",
      "progress",
      "scrollArea",
    ]);
    expect(STRUCTURED_PAGE_TEMPLATES.map((template) => template.id)).toEqual([
      "amibios",
      "safari",
      "filetree",
      "timeline",
      "snippet",
      "terminal",
      "phone",
    ]);
    expect(STRUCTURED_TEMPLATES.map((template) => template.id)).toEqual([
      ...STRUCTURED_COMPONENT_TEMPLATES.map((template) => template.id),
      "amibios",
      "safari",
      "filetree",
      "timeline",
      "snippet",
      "terminal",
      "phone",
    ]);
  });

  it("validates structured template ids", () => {
    expect(isStructuredTemplateId("badge")).toBe(true);
    expect(isStructuredTemplateId("amibios")).toBe(true);
    expect(isStructuredTemplateId("unknown")).toBe(false);
    expect(isStructuredTemplateId(null)).toBe(false);
  });

  it("tracks the active structured template drag id", () => {
    setActiveStructuredTemplateDragId("button");
    expect(getActiveStructuredTemplateDragId()).toBe("button");
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

  it("adds component metadata to template nodes", () => {
    const nodes = build("button");
    const instanceId = nodes[0].component?.instanceId;

    expect(instanceId).toBeTruthy();
    expect(nodes).toMatchObject([
      {
        component: {
          instanceId,
          templateId: "button",
          role: "fill",
        },
      },
      {
        component: {
          instanceId,
          templateId: "button",
          role: "label",
        },
      },
    ]);

    const tableNodes = build("table");
    expect(new Set(tableNodes.map((node) => node.component?.instanceId)).size).toBe(
      1
    );
    expect(tableNodes.map((node) => node.component?.role)).toEqual([
      "captionFill",
      "caption",
      "header",
      "rowStripe",
      "row",
      "row",
      "rowStripe",
      "row",
      "footerFill",
      "footer",
    ]);
  });

  it("builds a molecule registry for template atoms", () => {
    const { nodes, components } = buildStructuredTemplate(
      "button",
      { x: 4, y: 7 },
      { brushColor: "#334155", startOrder: 10 }
    );

    expect(components).toHaveLength(1);
    expect(components[0]).toMatchObject({
      templateId: "button",
      label: "Button",
      atomIds: nodes.map((node) => node.id),
      roles: {
        fill: [nodes[0].id],
        label: [nodes[1].id],
      },
    });
  });

  it("adds complete component metadata to every template node", () => {
    STRUCTURED_TEMPLATES.forEach((template) => {
      const nodes = build(template.id);
      const instanceIds = new Set(nodes.map((node) => node.component?.instanceId));

      expect(nodes.length, template.id).toBeGreaterThan(0);
      expect(instanceIds.size, template.id).toBe(1);
      nodes.forEach((node) => {
        expect(node.component, `${template.id}:${node.type}`).toMatchObject({
          instanceId: expect.any(String),
          templateId: template.id,
          role: expect.any(String),
        });
        expect(node.component?.role.length, template.id).toBeGreaterThan(0);
      });
    });
  });

  it("builds the AMIBIOS structured page template from ANSI-like source", () => {
    const { nodes, components } = buildStructuredTemplate(
      "amibios",
      { x: 4, y: 7 },
      { brushColor: "#334155", startOrder: 10 }
    );
    const [screen] = nodes;

    expect(nodes).toHaveLength(1);
    expect(components).toHaveLength(1);
    expect(components[0]).toMatchObject({
      templateId: "amibios",
      label: "AMIBIOS",
      atomIds: [screen.id],
      roles: { screen: [screen.id] },
    });
    expect(screen).toMatchObject({
      type: "text",
      order: 10,
      position: { x: 4, y: 7 },
      style: { color: "#c0c0c0", bgColor: "#000080" },
      component: {
        templateId: "amibios",
        role: "screen",
      },
    });
    if (screen.type !== "text") throw new Error("Expected AMIBIOS text node.");
    expect(screen.text).toContain(
      "AMIBIOS EASY SETUP UTILITY - VERSION 1.24.2026"
    );
    expect(screen.text).toContain("CPU Temperature:   45°C (Normal)");
    expect(screen.styleRanges?.some((range) => range.style.attrs?.bold)).toBe(
      true
    );
    expect(screen.styleRanges?.some((range) => range.style.attrs?.inverse)).toBe(
      true
    );
    expect(
      screen.styleRanges?.some((range) => range.style.bgColor === "#000080")
    ).toBe(true);
  });

  it("builds text-only atom templates", () => {
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

    const filetreeNodes = build("filetree");
    expect(filetreeNodes.slice(0, 6)).toMatchObject([
      {
        type: "line",
        start: { x: 4, y: 8 },
        end: { x: 4, y: 22 },
        axis: "vertical",
        style: { color: "#64748b" },
      },
      {
        type: "line",
        start: { x: 6, y: 10 },
        end: { x: 6, y: 19 },
        axis: "vertical",
        style: { color: "#64748b" },
      },
      {
        type: "line",
        start: { x: 8, y: 11 },
        end: { x: 8, y: 12 },
        axis: "vertical",
        style: { color: "#64748b" },
      },
      {
        type: "line",
        start: { x: 8, y: 14 },
        end: { x: 8, y: 17 },
        axis: "vertical",
        style: { color: "#64748b" },
      },
      {
        type: "line",
        start: { x: 8, y: 19 },
        end: { x: 8, y: 19 },
        axis: "vertical",
        style: { color: "#64748b" },
      },
      {
        type: "line",
        start: { x: 10, y: 15 },
        end: { x: 10, y: 15 },
        axis: "vertical",
        style: { color: "#64748b" },
      },
    ]);
    expect(filetreeNodes.slice(6, 9)).toMatchObject([
      { type: "text", position: { x: 4, y: 7 }, text: " PROJECT-ROOT" },
      { type: "text", position: { x: 6, y: 8 }, text: "󰉋 node_modules" },
      { type: "text", position: { x: 6, y: 9 }, text: " src" },
    ]);

    expect(build("timeline")).toMatchObject([
      {
        type: "line",
        start: { x: 4, y: 8 },
        end: { x: 4, y: 14 },
        axis: "vertical",
        style: { color: "#64748b" },
      },
      { type: "text", position: { x: 4, y: 7 }, text: "● Q1" },
      { type: "text", position: { x: 6, y: 8 }, text: "Jan - Mar" },
      { type: "text", position: { x: 4, y: 10 }, text: "● Q2" },
      { type: "text", position: { x: 6, y: 11 }, text: "Apr - Jun" },
      { type: "text", position: { x: 4, y: 13 }, text: "○ Q3" },
      { type: "text", position: { x: 6, y: 14 }, text: "Jul - Sep" },
    ]);

    expect(build("snippet")).toMatchObject([
      {
        type: "text",
        position: { x: 4, y: 7 },
        text: "npm  pnpm  yarn  bun        ",
      },
      { type: "text", position: { x: 4, y: 8 }, text: "▔▔▔" },
      { type: "text", position: { x: 4, y: 9 }, text: "npm install @xx/xx" },
    ]);

    expect(build("terminal")).toMatchObject([
      {
        type: "splitBox",
        start: { x: 4, y: 7 },
        end: { x: 47, y: 16 },
        root: {
          type: "split",
          id: "split-titlebar",
          axis: "horizontal",
          first: { type: "leaf", id: "leaf-titlebar" },
          second: { type: "leaf", id: "leaf-terminal" },
        },
      },
      {
        type: "text",
        position: { x: 6, y: 8 },
        text: "● ● ●",
        styleRanges: [
          { start: 0, end: 1, style: { color: "#ff6159" } },
          { start: 2, end: 3, style: { color: "#ffbd2e" } },
          { start: 4, end: 5, style: { color: "#28c941" } },
        ],
      },
      { type: "text", position: { x: 6, y: 10 }, text: "$ ls" },
      {
        type: "text",
        position: { x: 6, y: 11 },
        text: "Documents Downloads Pictures",
        style: { color: "#3b82f6" },
      },
      { type: "text", position: { x: 6, y: 12 }, text: "$ cd Documents" },
      { type: "text", position: { x: 6, y: 13 }, text: "$ pwd" },
      {
        type: "text",
        position: { x: 6, y: 14 },
        text: "/home/user/Documents",
        style: { color: "#28c941" },
      },
    ]);

    expect(build("phone").slice(0, 8)).toMatchObject([
      {
        type: "box",
        start: { x: 4, y: 7 },
        end: { x: 29, y: 30 },
      },
      {
        type: "line",
        start: { x: 5, y: 9 },
        end: { x: 28, y: 9 },
        axis: "horizontal",
      },
      {
        type: "line",
        start: { x: 5, y: 28 },
        end: { x: 28, y: 28 },
        axis: "horizontal",
      },
      {
        type: "bg",
        start: { x: 9, y: 14 },
        end: { x: 21, y: 14 },
        style: { color: "#000000", bgColor: "#86efac" },
      },
      {
        type: "text",
        position: { x: 5, y: 8 },
        text: "          ━━━━         ",
      },
      {
        type: "text",
        position: { x: 5, y: 10 },
        text: " 󰢽      5:25 PM   󰖩    ",
      },
      {
        type: "text",
        position: { x: 5, y: 12 },
        text: " Welcome Back  󱠡        ",
      },
      {
        type: "text",
        position: { x: 5, y: 14 },
        text: "    24°C   Sunny       ",
      },
    ]);
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
        type: "splitBox",
        start: { x: 4, y: 7 },
        end: { x: 24, y: 16 },
        root: {
          type: "split",
          id: "split-title",
          axis: "horizontal",
          second: {
            type: "split",
            id: "split-footer",
            axis: "horizontal",
          },
        },
      },
      {
        type: "text",
        position: { x: 5, y: 8 },
        text: "CardTitle",
      },
      {
        type: "text",
        position: { x: 5, y: 10 },
        text: "CardContent",
      },
      {
        type: "text",
        position: { x: 5, y: 15 },
        text: "CardFooter",
      },
    ]);
    expect(build("safari")).toMatchObject([
      {
        type: "splitBox",
        start: { x: 4, y: 7 },
        end: { x: 75, y: 27 },
        root: {
          type: "split",
          id: "split-toolbar",
          axis: "horizontal",
          first: { type: "leaf", id: "leaf-toolbar" },
          second: { type: "leaf", id: "leaf-content" },
        },
      },
      {
        type: "text",
        position: { x: 6, y: 8 },
        text: "● ● ●",
        styleRanges: [
          { start: 0, end: 1, style: { color: "#ff6159" } },
          { start: 2, end: 3, style: { color: "#ffbd2e" } },
          { start: 4, end: 5, style: { color: "#28c941" } },
        ],
      },
      {
        type: "text",
        position: { x: 12, y: 8 },
        text: "  < >   ",
      },
      {
        type: "bg",
        start: { x: 23, y: 8 },
        end: { x: 56, y: 8 },
        style: { color: "#000000", bgColor: "#d1d5db" },
      },
      {
        type: "text",
        position: { x: 23, y: 8 },
        text: "      ascii-canvas.pages.dev     ",
      },
      {
        type: "text",
        position: { x: 65, y: 8 },
        text: "    󰆏",
      },
    ]);
  });

  it("builds form atom layout templates", () => {
    expect(build("textarea")).toMatchObject([
      {
        type: "bg",
        order: 13,
        start: { x: 4, y: 10 },
        end: { x: 29, y: 10 },
        style: { color: "#000000", bgColor: "#eff6ff" },
      },
      {
        type: "text",
        order: 10,
        position: { x: 4, y: 7 },
        text: "TextArea                 █",
        styleRanges: [{ start: 25, end: 26, style: { color: "#3b82f6" } }],
      },
      {
        type: "text",
        order: 11,
        position: { x: 4, y: 8 },
        text: "                         │",
      },
      {
        type: "text",
        order: 12,
        position: { x: 4, y: 9 },
        text: "Press Ctrl+S to save...  │",
        styleRanges: [{ start: 0, end: 23, style: { color: "#6b7280" } }],
      },
      {
        type: "text",
        order: 14,
        position: { x: 4, y: 10 },
        text: "󰦨 UTF-8  󰚰 Ln 2, Col 44   ",
        style: { color: "#2563eb" },
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
    expect(cardPreview).toMatchObject({ width: 21, height: 10 });
    expect(
      cardPreview.rows.map((row) => row.map((cell) => cell.char).join(""))
    ).toEqual([
      "╭───────────────────╮",
      "│CardTitle          │",
      "├───────────────────┤",
      "│CardContent        │",
      "│                   │",
      "│                   │",
      "│                   │",
      "├───────────────────┤",
      "│CardFooter         │",
      "╰───────────────────╯",
    ]);

    const textareaPreview = buildStructuredTemplatePreview("textarea");
    expect(textareaPreview).toMatchObject({ width: 26, height: 4 });
    expect(
      textareaPreview.rows.map((row) => row.map((cell) => cell.char).join(""))
    ).toEqual([
      "TextArea                 █",
      "                         │",
      "Press Ctrl+S to save...  │",
      "󰦨 UTF-8  󰚰 Ln 2, Col 44   ",
    ]);
    expect(textareaPreview.rows[0][25].color).toBe("#3b82f6");
    expect(textareaPreview.rows[2][0].color).toBe("#6b7280");
    expect(textareaPreview.rows[2][25].color).toBe("#000000");
    expect(textareaPreview.rows[3].every((cell) => cell.bgColor === "#eff6ff")).toBe(
      true
    );
    expect(textareaPreview.rows[3][0].color).toBe("#2563eb");

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

    const filetreePreview = buildStructuredTemplatePreview("filetree");
    expect(filetreePreview).toMatchObject({ width: 20, height: 16 });
    expect(
      filetreePreview.rows.map((row) =>
        row.map((cell) => cell.char).join("").trimEnd()
      )
    ).toEqual([
      " PROJECT-ROOT",
      "│ 󰉋 node_modules",
      "│  src",
      "│ │  app",
      "│ │ │  layout.tsx",
      "│ │ │  page.tsx",
      "│ │  components",
      "│ │ │  ui",
      "│ │ │ │  button.tsx",
      "│ │ │  footer.tsx",
      "│ │ │  header.tsx",
      "│ │  lib",
      "│ │ │  utils.ts",
      "│ 󰉋 public",
      "│ 󰘦 package.json",
      "│  README.md",
    ]);
    expect(filetreePreview.rows[1][0].color).toBe("#64748b");
    expect(filetreePreview.rows[8][6].color).toBe("#64748b");

    const timelinePreview = buildStructuredTemplatePreview("timeline");
    expect(timelinePreview).toMatchObject({ width: 11, height: 8 });
    expect(
      timelinePreview.rows.map((row) =>
        row.map((cell) => cell.char).join("").trimEnd()
      )
    ).toEqual([
      "● Q1",
      "│ Jan - Mar",
      "│",
      "● Q2",
      "│ Apr - Jun",
      "│",
      "○ Q3",
      "│ Jul - Sep",
    ]);
    expect(timelinePreview.rows[1][0].color).toBe("#64748b");

    const snippetPreview = buildStructuredTemplatePreview("snippet");
    expect(snippetPreview).toMatchObject({ width: 29, height: 3 });
    expect(
      snippetPreview.rows.map((row) =>
        row.map((cell) => cell.char).join("").trimEnd()
      )
    ).toEqual([
      "npm  pnpm  yarn  bun        ",
      "▔▔▔",
      "npm install @xx/xx",
    ]);

    const terminalPreview = buildStructuredTemplatePreview("terminal");
    expect(terminalPreview).toMatchObject({ width: 44, height: 10 });
    expect(
      terminalPreview.rows.map((row) => row.map((cell) => cell.char).join(""))
    ).toEqual([
      "╭──────────────────────────────────────────╮",
      "│ ● ● ●                                    │",
      "├──────────────────────────────────────────┤",
      "│ $ ls                                     │",
      "│ Documents Downloads Pictures             │",
      "│ $ cd Documents                           │",
      "│ $ pwd                                    │",
      "│ /home/user/Documents                     │",
      "│                                          │",
      "╰──────────────────────────────────────────╯",
    ]);
    expect(terminalPreview.rows[1][2].color).toBe("#ff6159");
    expect(terminalPreview.rows[1][4].color).toBe("#ffbd2e");
    expect(terminalPreview.rows[1][6].color).toBe("#28c941");
    expect(terminalPreview.rows[4][2].color).toBe("#3b82f6");
    expect(terminalPreview.rows[7][2].color).toBe("#28c941");

    const phonePreview = buildStructuredTemplatePreview("phone");
    expect(phonePreview).toMatchObject({ width: 26, height: 24 });
    expect(
      phonePreview.rows.map((row) => row.map((cell) => cell.char).join(""))
    ).toEqual([
      "╭────────────────────────╮",
      "│          ━━━━         │",
      "│────────────────────────│",
      "│ 󰢽      5:25 PM   󰖩    │",
      "│                        │",
      "│ Welcome Back  󱠡        │",
      "│                        │",
      "│    24°C   Sunny       │",
      "│                        │",
      "│                        │",
      "│ °   °             │",
      "│                        │",
      "│                        │",
      "│                   │",
      "│                        │",
      "│                        │",
      "│         󰋾        󰘑  │",
      "│                        │",
      "│                        │",
      "│                        │",
      "│                     │",
      "│────────────────────────│",
      "│          (  )          │",
      "╰────────────────────────╯",
    ]);
    expect(phonePreview.rows[3][22].color).toBe("#eab308");
    expect(phonePreview.rows[5][16].color).toBe("#eab308");
    expect(
      phonePreview.rows[7].slice(5, 18).every((cell) => cell.bgColor === "#86efac")
    ).toBe(true);
    expect(phonePreview.rows[7][11].color).toBe("#eab308");
    expect(phonePreview.rows[10][2].color).toBe("#eab308");
    expect(phonePreview.rows[10][3].color).toBe("#ef4444");
    expect(phonePreview.rows[13][2].color).toBe("#10b981");
    expect(phonePreview.rows[16][12].color).toBe("#ec4899");
    expect(phonePreview.rows[20][4].color).toBe("#22c55e");

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

  it("builds chart and data display components from demo surfaces", () => {
    expect(build("barChart").slice(0, 2)).toMatchObject([
      {
        type: "text",
        position: { x: 4, y: 7 },
        text: "│     █       ",
        style: { color: "#1f2937" },
        styleRanges: [{ start: 6, end: 7, style: { color: "#3b82f6" } }],
      },
      {
        type: "text",
        position: { x: 4, y: 8 },
        text: "├ ▄   █   ▆   ",
      },
    ]);

    const barPreview = buildStructuredTemplatePreview("barChart");
    expect(
      barPreview.rows.map((row) => row.map((cell) => cell.char).join(""))
    ).toEqual([
      "│     █       ",
      "├ ▄   █   ▆   ",
      "│ █ ▇ █ ▃ █ █ ",
      "└─┴─┴─┴─┴─┴─┴─",
    ]);
    expect(barPreview.rows[0][6].color).toBe("#3b82f6");

    const linePreview = buildStructuredTemplatePreview("lineChart");
    expect(linePreview.rows.map((row) => row.map((cell) => cell.char).join(""))).toEqual([
      "├         ╭─ ",
      "│   ╭─╮   │  ",
      "├ ──╯ │ ╭─╯  ",
      "│     ╰─╯    ",
      "└─┴─┴─┴─┴─┴─┴",
    ]);
    expect(linePreview.rows[0][10].color).toBe("#ef4444");

    const tableNodes = build("table");
    expect(tableNodes.slice(0, 2)).toMatchObject([
      {
        type: "bg",
        start: { x: 4, y: 7 },
        end: { x: 36, y: 7 },
        style: { color: "#000000", bgColor: "#1f2937" },
      },
      {
        type: "text",
        position: { x: 4, y: 7 },
        text: " TableCaption                    ",
        style: { color: "#ffffff" },
      },
    ]);

    const tablePreview = buildStructuredTemplatePreview("table");
    expect(tablePreview).toMatchObject({ width: 33, height: 6 });
    expect(
      tablePreview.rows[0].every((cell) => cell.bgColor === "#1f2937")
    ).toBe(true);
    expect(
      tablePreview.rows[2].every((cell) => cell.bgColor === "#d1d5db")
    ).toBe(true);
    expect(tablePreview.rows[0].map((cell) => cell.char).join("")).toContain(
      "TableCaption"
    );

    const progressPreview = buildStructuredTemplatePreview("progress");
    expect(progressPreview.rows[0].map((cell) => cell.char).join("")).toBe(
      "             70%"
    );
    expect(
      progressPreview.rows[0]
        .slice(0, 9)
        .every((cell) => cell.bgColor === "#3b82f6")
    ).toBe(true);
    expect(progressPreview.rows[0][13].color).toBe("#3b82f6");
  });

  it("builds compact interactive surface components", () => {
    const paginationPreview = buildStructuredTemplatePreview("pagination");
    expect(paginationPreview.rows[0].map((cell) => cell.char).join("")).toBe(
      "< Previous  1  2  3    Next >"
    );
    expect(paginationPreview.rows[0][17]).toMatchObject({
      color: "#1d4ed8",
      bgColor: "#dbeafe",
      attrs: { bold: true },
    });

    const sliderPreview = buildStructuredTemplatePreview("slider");
    expect(sliderPreview.rows[0].map((cell) => cell.char).join("")).toBe(
      "Slider ────●────────────●───"
    );
    expect(sliderPreview.rows[0][11].color).toBe("#3b82f6");

    const scrollAreaPreview = buildStructuredTemplatePreview("scrollArea");
    expect(
      scrollAreaPreview.rows.map((row) =>
        row.map((cell) => cell.char).join("")
      )
    ).toEqual(["ScrollArea │", "├─Item     █", "├─Item     │", "└─Item     │"]);
    expect(scrollAreaPreview.rows[1][10].color).toBe("#3b82f6");
  });

  it("returns an empty scene for unsupported ids at runtime", () => {
    expect(buildStructuredTemplateNodes(
      "unknown" as StructuredTemplateId,
      { x: 4, y: 7 },
      { brushColor: "#334155", startOrder: 10 }
    )).toEqual([]);
  });
});
