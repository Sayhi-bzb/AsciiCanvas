# Dialog Surfaces

This page governs Dialog and AlertDialog surfaces.

## Contract

- Use the shared Dialog section components; instances may set width but do not redefine shell, padding, divider, or close-control geometry.
- The modal shell is `background`, borderless, shadowless, overflow-clipped, and `rounded-lg`. The overlay establishes modal elevation.
- Header and footer use restrained accent surfaces. Section boundaries use the shared 2 px accent divider.
- Dialog body groups content through spacing and accent surfaces. Do not nest bordered cards inside a Dialog.
- Dialog close is a 32 x 32 px host icon control with a 16 x 16 px icon and the shared 3 px focus-visible ring.
- AlertDialog uses the same surface geometry. Destructive semantics belong to the confirmation action, not the shell.

## Exceptions

Fields, keyboard keys, color swatches, and other controls whose boundary carries meaning retain their semantic outline.

## Verification

- Cover shell, section, close-control, focus, Escape, overlay close, and focus-return behavior in component tests.
- Verify desktop and mobile layouts in light and dark themes when shared Dialog styles change.
