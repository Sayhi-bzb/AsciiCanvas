/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/shared/lib/utils"
import { rx } from "@/shared/styles/recipes"
import type { Shape, Size, Tone } from "@/shared/styles/tokens"

export type ButtonTone = Tone
export type ButtonSize = Size
export type ButtonShape = Shape

type ButtonVariantInput = {
  className?: string
  tone?: ButtonTone
  size?: ButtonSize
  shape?: ButtonShape
  outlined?: boolean
}

const resolveButtonStyle = ({
  tone,
  size,
  shape,
  outlined,
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
    }),
    options.className
  )
}

type ButtonProps = React.ComponentProps<"button"> & {
  asChild?: boolean
  tone?: ButtonTone
  shape?: ButtonShape
  size?: ButtonSize
  outlined?: boolean
}

function Button({
  className,
  tone,
  size = "md",
  shape,
  outlined,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button"
  const resolved = resolveButtonStyle({ tone, size, shape, outlined })

  return (
    <Comp
      data-slot="button"
      data-tone={resolved.tone}
      data-size={resolved.size}
      data-shape={resolved.shape}
      className={buttonVariants({ tone, size, shape, outlined, className })}
      {...props}
    />
  )
}

export { Button, buttonVariants }
