# Dialog Surfaces

This page governs Dialog and AlertDialog surfaces.

## Contract

- Use the shared Dialog section components; instances may set width but do not redefine shell, padding, divider, or close-control geometry.
- The modal shell uses the raised Dialog surface, is borderless, overflow-clipped, and `rounded-lg`. The restrained `shadow-dialog` establishes the strongest Host elevation tier without adding a border.
- Header and footer use restrained accent surfaces. Section boundaries use the shared 2 px accent divider.
- Dialog body groups content through spacing and accent surfaces. Do not nest bordered cards inside a Dialog.
- Dialog close is a 32 x 32 px host icon control with a 16 x 16 px icon and the shared 3 px focus-visible ring.
- AlertDialog, Sheet, and the mobile Sidebar modal panel use the same Dialog elevation. Destructive semantics belong to the confirmation action, not the shell.
- Dialog contents, section surfaces, fields, icons, and other embedded controls do not add nested shadows.

## Exceptions

Fields, keyboard keys, color swatches, and other controls whose boundary carries meaning retain their semantic outline.

## Verification

- Cover shell, section, close-control, focus, Escape, overlay close, and focus-return behavior in component tests.
- Verify desktop and mobile layouts in light and dark themes when shared Dialog styles change.
