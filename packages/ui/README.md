# @chardesk/ui

Private CharDesk visual-system package. Product surfaces consume its theme and
primitives instead of owning colors, borders, radii, shadows, or interaction
states.

```css
@import "@chardesk/ui/theme.css";
```

```tsx
import { Button, Separator, Surface } from "@chardesk/ui";
```

`@chardesk/ui/styles` is infrastructure-only and remains as a compatibility
export. Product code consumes primitives from the package root.

Run shadcn commands from the repository root. The root and package
`components.json` files route UI components and utilities into this workspace.
