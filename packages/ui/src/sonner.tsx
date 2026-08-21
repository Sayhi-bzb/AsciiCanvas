import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "./utils.js"
import { useUiMessages } from "./ui-messages.js"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const statusClassNames = {
  success: "[&_[data-title]]:text-success [&_[data-icon]]:text-success",
  warning: "[&_[data-title]]:text-warning [&_[data-icon]]:text-warning",
  error: "[&_[data-title]]:text-error [&_[data-icon]]:text-error",
} as const

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const messages = useUiMessages()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      containerAriaLabel={messages.notificationRegion}
      icons={{
        success: <CircleCheck className="size-4 text-success" />,
        info: <Info className="size-4" />,
        warning: <TriangleAlert className="size-4 text-warning" />,
        error: <OctagonX className="size-4 text-error" />,
        loading: <LoaderCircle className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--separator)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          success: cn(statusClassNames.success, toastOptions?.classNames?.success),
          warning: cn(statusClassNames.warning, toastOptions?.classNames?.warning),
          error: cn(statusClassNames.error, toastOptions?.classNames?.error),
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
