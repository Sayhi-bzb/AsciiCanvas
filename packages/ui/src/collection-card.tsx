import * as React from "react";

import { cn } from "./utils.js";
import { rx } from "./recipes.js";

type CollectionCardProps = React.ComponentProps<"div"> & {
  selected?: boolean;
};

function CollectionCard({
  selected = false,
  className,
  ...props
}: CollectionCardProps) {
  return (
    <div
      data-slot="collection-card"
      data-selected={selected || undefined}
      className={cn(rx.collectionCard({ selected }), className)}
      {...props}
    />
  );
}

export { CollectionCard };
