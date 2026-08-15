import { Button, type ButtonProps } from "@/shared/ui/button"

type IconButtonProps = Omit<ButtonProps, "shape"> & {
  "aria-label": string
}

function IconButton({ tone = "subtle", size = "md", ...props }: IconButtonProps) {
  return <Button tone={tone} size={size} shape="square" {...props} />
}

export { IconButton }
