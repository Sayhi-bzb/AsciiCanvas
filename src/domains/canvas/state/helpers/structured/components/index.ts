import { BASIC_COMPONENTS } from "./basic";
import { DATA_COMPONENTS } from "./data";
import { FEEDBACK_COMPONENTS } from "./feedback";
import { FORM_COMPONENTS } from "./form";
import { LAYOUT_COMPONENTS } from "./layout";
import { PAGE_TEMPLATE_COMPONENTS } from "./templates";

export { createStructuredComponentFactory } from "./factory";
export {
  STRUCTURED_TEMPLATE_FALLBACK_COLORS,
  STRUCTURED_TEMPLATE_TEXT_COLOR,
} from "./factory";
export type {
  StructuredComponentDefinition,
  StructuredTemplateBuildOptions,
  StructuredTemplateId,
} from "./types";

const ALL_COMPONENTS = [
  ...BASIC_COMPONENTS,
  ...FEEDBACK_COMPONENTS,
  ...LAYOUT_COMPONENTS,
  ...FORM_COMPONENTS,
  ...DATA_COMPONENTS,
];

const COMPONENT_BY_ID = new Map(
  ALL_COMPONENTS.map((component) => [component.id, component])
);

const COMPONENT_ORDER = [
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
] as const;

export const STRUCTURED_COMPONENTS = COMPONENT_ORDER.map((id) => {
  const component = COMPONENT_BY_ID.get(id);
  if (!component) {
    throw new Error(`Missing structured component: ${id}`);
  }
  return component;
});

export const STRUCTURED_PAGE_TEMPLATE_COMPONENTS = PAGE_TEMPLATE_COMPONENTS;
