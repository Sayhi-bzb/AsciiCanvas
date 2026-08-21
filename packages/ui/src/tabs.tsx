import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "./utils.js"
import { rx } from "./recipes.js"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = (variant: "default" | "line" = "default") =>
  rx.tabsList({ variant })
type TabsListProps = React.ComponentProps<typeof TabsPrimitive.List> & {
  variant?: "default" | "line"
}

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants(variant), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  size = "default",
  active = false,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & {
  size?: "default" | "icon"
  active?: boolean
}) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      data-size={size}
      data-active={active || undefined}
      className={cn(
        rx.tabsTrigger({ size, active }),
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
