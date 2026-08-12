import type { StructuredComponentInstance, StructuredNode } from "./types";
const isComponentMetadata = (
  component: unknown
): component is NonNullable<StructuredNode["component"]> =>
  !!component &&
  typeof component === "object" &&
  typeof (component as { instanceId?: unknown }).instanceId === "string" &&
  typeof (component as { templateId?: unknown }).templateId === "string" &&
  typeof (component as { role?: unknown }).role === "string";

const cloneStructuredComponent = (
  component: StructuredComponentInstance
): StructuredComponentInstance => ({
  id: component.id,
  templateId: component.templateId,
  label: component.label,
  atomIds: [...component.atomIds],
  roles: Object.fromEntries(
    Object.entries(component.roles).map(([role, atomIds]) => [role, [...atomIds]])
  ),
});

export const deriveStructuredComponentsFromScene = (
  scene: StructuredNode[]
): StructuredComponentInstance[] => {
  const byInstanceId = new Map<string, StructuredComponentInstance>();
  scene.forEach((node) => {
    const component = node.component;
    if (!isComponentMetadata(component)) return;
    const current =
      byInstanceId.get(component.instanceId) ??
      ({
        id: component.instanceId,
        templateId: component.templateId,
        label: component.templateId,
        atomIds: [],
        roles: {},
      } satisfies StructuredComponentInstance);
    current.atomIds.push(node.id);
    current.roles[component.role] = [
      ...(current.roles[component.role] ?? []),
      node.id,
    ];
    byInstanceId.set(component.instanceId, current);
  });
  return [...byInstanceId.values()];
};

export const normalizeStructuredComponents = (
  components: StructuredComponentInstance[] | undefined,
  scene: StructuredNode[]
) => {
  const nodeIds = new Set(scene.map((node) => node.id));
  const source =
    components && components.length > 0
      ? components
      : deriveStructuredComponentsFromScene(scene);
  const normalized = source
    .map((component) => {
      const atomIds = component.atomIds.filter((id) => nodeIds.has(id));
      const roles = Object.fromEntries(
        Object.entries(component.roles)
          .map(([role, ids]) => [
            role,
            ids.filter((id) => nodeIds.has(id)),
          ])
          .filter(([, ids]) => ids.length > 0)
      );
      return {
        id: component.id,
        templateId: component.templateId,
        label: component.label,
        atomIds,
        roles,
      };
    })
    .filter((component) => component.atomIds.length > 0);

  return normalized.map(cloneStructuredComponent);
};
