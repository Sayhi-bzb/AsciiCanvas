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

`@chardesk/ui/styles` is infrastructure-only and exists for the main app's
compatibility layer. Product code should consume primitives from the package
root.
