# Core Host Icon Controls

This page governs icon behavior in Selection Toolbar, Tool Dock, Sidebar tabs and toggle, App Menu, Breadcrumb.

## Contract

- Resolve core host icons through [`HOST_ICONOLOGY`](../../src/shared/icons/iconology.ts). Add a semantic key there instead of importing the corresponding Lucide icon in a host component.
- Apply [`uiClass.hostControl`](../../src/shared/styles/components.ts) to text-bearing host controls and `uiClass.hostIconControl` to icon-only host controls. Use `uiClass.hostControlActive` for selected, active, or associated-open state.
- Icon-only controls are 32 x 32 px with a 16 x 16 px icon. Text-bearing controls such as Breadcrumb are 32 px high with 16 x 16 px icons.
- Idle background is transparent and idle foreground is muted. Hover uses accent background and accent foreground. Active uses accent background and foreground. Keyboard focus uses the shared 3 px focus-visible ring.
- Core icon controls are borderless, shadowless, padding-free, and `rounded-lg` unless compound geometry joins adjacent controls.
- Host surfaces are raised color blocks, `rounded-lg`, and borderless. Floating Host containers compose `uiClass.floatingHost` with the light `shadow-host`; embedded surfaces such as `uiClass.iconRail` compose `uiClass.hostSurface` and remain shadowless. Breadcrumb and standalone controls remain uncontained.
- A trigger-collapsed Sidebar is not a Floating Host surface: its positioning shell is transparent and shadowless, leaving only the Sidebar toggle visible.
- A subordinate control associates with its principal control. Hovering or opening a Dock arrow or Top Bar close control activates the principal surface without affecting adjacent controls.
- Compound principal and subordinate controls remain individually 32 x 32 px, remove their joined inner radii, and render no divider.
- Every icon-only control has an accessible name. Add a tooltip when the icon meaning is not familiar from platform conventions.
- Composite Popovers define initial focus explicitly. DOM order follows visual and keyboard order; opening a Popover must not focus a Tooltip trigger incidentally.

- Dropdown, Popover, Context Menu, and Select surfaces use the medium `shadow-overlay`. Dialog, AlertDialog, Sheet, and mobile Sidebar surfaces use the restrained strongest `shadow-dialog`.
- Shadows express container elevation only. Icons, embedded rails, fields, swatches, and semantic controls remain shadowless.

## Exceptions

Destructive controls, color swatches, fields, the mobile Sidebar FAB, and menu-row geometry retain their own semantic or primitive styling. These exceptions do not redefine Host container styling.

## Verification

- Extend iconology tests when adding or changing a semantic icon key.
- Cover geometry, idle, hover, active, association, and keyboard focus in the affected component test or [`host-control-states.spec.ts`](../../e2e/host-control-states.spec.ts).
- Verify desktop and mobile layouts in light and dark themes when a shared host style changes.
