"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { rx } from "@/shared/styles/recipes"

type InlineRenameInputProps = Omit<
  React.ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "onBlur" | "onFocus" | "onKeyDown"
> & {
  value: string;
  onCommit: (value: string) => void;
  onCancel?: () => void;
};

function InlineRenameInput({
  value,
  onCommit,
  onCancel,
  className,
  ...props
}: InlineRenameInputProps) {
  const [draft, setDraft] = React.useState(value);
  const focusedRef = React.useRef(false);
  const skipNextBlurRef = React.useRef(false);

  React.useEffect(() => {
    if (!focusedRef.current) setDraft(value);
  }, [value]);

  const handleBlur = () => {
    focusedRef.current = false;
    if (skipNextBlurRef.current) {
      skipNextBlurRef.current = false;
      return;
    }
    const nextValue = draft.trim();
    if (!nextValue) {
      setDraft(value);
      onCancel?.();
      return;
    }
    setDraft(nextValue);
    onCommit(nextValue);
  };

  return (
    <input
      {...props}
      data-slot="inline-rename-input"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => {
        focusedRef.current = true;
        event.currentTarget.select();
      }}
      onBlur={handleBlur}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          skipNextBlurRef.current = true;
          setDraft(value);
          event.currentTarget.blur();
          onCancel?.();
        }
      }}
      className={cn(rx.quietInput, "h-6 px-1", className)}
    />
  );
}

export { InlineRenameInput };
