import * as React from "react";

import { cn } from "@/shared/lib/utils";
import { rx } from "@/shared/styles/recipes"
import { ScrollArea } from "@/shared/ui/scroll-area";

type ContentScrollAreaProps = Omit<
  React.ComponentProps<typeof ScrollArea>,
  "scrollHideDelay" | "type"
>;

function ContentScrollArea({
  className,
  ...props
}: ContentScrollAreaProps) {
  return (
    <ScrollArea
      {...props}
      type="always"
      className={cn(rx.contentScrollArea, className)}
    />
  );
}

export { ContentScrollArea };
