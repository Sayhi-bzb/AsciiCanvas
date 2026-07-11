"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";
import { CheckIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  buttonVariants,
  type ButtonShape,
  type ButtonSize,
  type ButtonTone,
} from "@/shared/ui/button";

type ActionButtonSize = ButtonSize | "full";

interface ActionButtonProps
  extends HTMLMotionProps<"button"> {
  icon: LucideIcon;
  label?: string;
  subLabel?: string;
  delay?: number;
  onAction: () => boolean | Promise<boolean>;
  tone?: ButtonTone;
  size?: ActionButtonSize;
  shape?: ButtonShape;
}

export function ActionButton({
  icon: Icon,
  label,
  subLabel,
  className,
  size = "md",
  tone,
  shape = "square",
  delay = 2000,
  onAction,
  ...props
}: ActionButtonProps) {
  const [isSuccess, setIsSuccess] = React.useState(false);
  const CurrentIcon = isSuccess ? CheckIcon : Icon;
  const resolvedSize: ButtonSize = size === "full" ? "lg" : size;
  const iconClassName =
    size === "full"
      ? "size-5"
      : resolvedSize === "lg"
      ? "size-5"
      : resolvedSize === "md"
      ? "size-4"
      : "size-3.5";

  const handlePress = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isSuccess) return;
    if (props.onClick) props.onClick(e);
    try {
      const succeeded = await onAction();
      if (!succeeded) return;
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), delay);
    } catch {
      // Caller owns error feedback; do not show false-success state.
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        buttonVariants({
          tone,
          size: resolvedSize,
          shape,
        }),
        size === "full" && "w-full h-20 flex-col gap-2 rounded-xl",
        className
      )}
      {...props}
      onClick={handlePress}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={isSuccess ? "check" : "icon"}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col items-center justify-center"
        >
          <CurrentIcon className={iconClassName} />
          {size === "full" && label && (
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold">{label}</span>
              {subLabel && (
                <span className="text-[11px] leading-4 opacity-60">
                  {subLabel}
                </span>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}
