import * as React from "react";

import { cn } from "./utils.js";
import { rx } from "./recipes.js"
import { ScrollArea } from "./scroll-area.js";

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
