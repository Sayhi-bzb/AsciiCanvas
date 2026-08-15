/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/shared/lib/utils"
import { rx } from "@/shared/styles/recipes"
import type { Shape, Size, Tone } from "@/shared/styles/tokens"

type ButtonTone = Tone
type ButtonSize = Size
type ButtonShape = Shape

type ButtonVariantInput = {
  className?: string
  tone?: ButtonTone
  size?: ButtonSize
  shape?: ButtonShape
  outlined?: boolean
  active?: boolean
  pressed?: boolean
  open?: boolean
  destructive?: boolean
  joined?: "start" | "middle" | "end"
}

const resolveButtonStyle = ({
  tone,
  size,
  shape,
  outlined,
  active,
  pressed,
  open,
  destructive,
  joined,
}: Omit<ButtonVariantInput, "className">) => {
  const resolvedTone = tone ?? "primary"
  const resolvedSize = size ?? "md"
  const resolvedShape = shape ?? "auto"
  const resolvedOutlined = outlined ?? false

  return {
    tone: resolvedTone,
    size: resolvedSize,
    shape: resolvedShape,
    outlined: resolvedOutlined,
    active: active ?? false,
    pressed: pressed ?? false,
    open: open ?? false,
    destructive: destructive ?? false,
    joined,
  }
}

const buttonVariants = (options: ButtonVariantInput = {}) => {
  const resolved = resolveButtonStyle(options)
  return cn(
    rx.control({
      tone: resolved.tone,
      size: resolved.size,
      shape: resolved.shape,
      outlined: resolved.outlined,
      active: resolved.active,
      pressed: resolved.pressed,
      open: resolved.open,
      destructive: resolved.destructive,
      joined: resolved.joined,
    }),
    options.className
  )
}

export type ButtonProps = React.ComponentProps<"button"> & {
  asChild?: boolean
  tone?: ButtonTone
  shape?: ButtonShape
  size?: ButtonSize
  outlined?: boolean
  active?: boolean
  pressed?: boolean
  open?: boolean
  destructive?: boolean
  joined?: "start" | "middle" | "end"
}

function Button({
  className,
  tone,
  size = "md",
  shape,
  outlined,
  active,
  pressed,
  open,
  destructive,
  joined,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button"
  const resolved = resolveButtonStyle({
    tone,
    size,
    shape,
    outlined,
    active,
    pressed,
    open,
    destructive,
    joined,
  })

  return (
    <Comp
      data-slot="button"
      data-tone={resolved.tone}
      data-size={resolved.size}
      data-shape={resolved.shape}
      data-active={resolved.active || undefined}
      data-pressed={resolved.pressed || undefined}
      data-open={resolved.open || undefined}
      data-destructive={resolved.destructive || undefined}
      data-joined={resolved.joined}
      aria-pressed={
        props["aria-pressed"] ??
        (pressed !== undefined ? resolved.pressed : undefined)
      }
      aria-expanded={
        props["aria-expanded"] ?? (open !== undefined ? resolved.open : undefined)
      }
      className={buttonVariants({
        tone,
        size,
        shape,
        outlined,
        active,
        pressed,
        open,
        destructive,
        joined,
        className,
      })}
      {...props}
    />
  )
}

export { Button, buttonVariants }
