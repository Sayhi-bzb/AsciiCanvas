import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

import { cn } from "@/shared/lib/utils";
import { rx } from "@/shared/styles/recipes";
import type { Size } from "@/shared/styles/tokens";

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & {
    variant?: "default" | "outline";
  }
>(({ className, variant = "default", ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    data-variant={variant}
    className={cn(
      rx.surface({ kind: "embedded" }),
      "inline-flex items-center p-[3px]",
      variant === "outline" && "border border-border",
      className
    )}
    {...props}
  />
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & {
    size?: Size;
  }
>(({ className, size = "md", ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    data-size={size}
    className={cn(
      rx.control({ tone: "subtle", shape: "square", size }),
      className
    )}
    {...props}
  />
));
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
