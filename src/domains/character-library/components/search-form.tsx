"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Label } from "@/shared/ui/label";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from "@/shared/ui/sidebar";
import { useLibraryStore } from "../stores/useLibraryStore";
import { rx } from "@/shared/styles/recipes";
import { cn } from "@/shared/lib/utils";

export function SearchForm({ className, ...props }: React.ComponentProps<"form">) {
  const { searchQuery, setSearchQuery } = useLibraryStore();

  return (
    <form className={className} {...props} onSubmit={(e) => e.preventDefault()}>
      <SidebarGroup className="p-0">
        <SidebarGroupContent className="relative">
          <Label htmlFor="search" className="sr-only">
            Search Blueprint
          </Label>
          <SidebarInput
            id="search"
            placeholder="Search characters (e.g. 'copy', 'arrow')..."
            className={cn(
              rx.field({ density: "default" }),
              "pl-8 bg-muted/50 focus-visible:bg-background transition-colors shadow-none"
            )}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 opacity-50 select-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              ESC
            </button>
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </form>
  );
}

