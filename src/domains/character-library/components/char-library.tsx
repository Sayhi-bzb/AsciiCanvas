"use client";

import {
  ChevronRight,
  Sparkles,
  Languages,
  SearchX,
  Loader2,
  RefreshCcw,
  Folder,
  Terminal,
  FolderOpen,
  SquareDashed,
} from "lucide-react";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { useLibraryStore } from "../stores/useLibraryStore";
import { cn } from "@/shared/lib/utils";
import { feedback } from "@/shared/services/effects";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/shared/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { useShallow } from "zustand/react/shallow";

const getCodePointLabel = (char: string) =>
  Array.from(char)
    .map((part) => {
      const codePoint = part.codePointAt(0);
      return codePoint === undefined
        ? ""
        : `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
    })
    .filter(Boolean)
    .join(" ");

const CharButton = ({
  char,
  label,
  isSelected,
  onClick,
}: {
  char: string;
  label: string;
  isSelected: boolean;
  onClick: (c: string) => void;
}) => {
  const codePointLabel = getCodePointLabel(char);
  const tooltipLabel = codePointLabel ? `${label} · ${codePointLabel}` : label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={tooltipLabel}
          title={tooltipLabel}
          onClick={() => onClick(char)}
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-sm p-0 font-mono text-sm leading-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            isSelected
              ? "bg-primary text-primary-foreground"
              : "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          {char}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-56">
        {tooltipLabel}
      </TooltipContent>
    </Tooltip>
  );
};

export function CharLibrary() {
  const { brushChar, setBrushChar, setTool } = useCanvasStore(
    useShallow((state) => ({
      brushChar: state.brushChar,
      setBrushChar: state.setBrushChar,
      setTool: state.setTool,
    }))
  );
  const { data, isLoading, error, searchQuery, searchResults, fetchLibrary } =
    useLibraryStore();

  const getCharacterLabel = (char: string) =>
    data?.characterLabels[char] ?? getCodePointLabel(char) ?? char;

  const handleSelect = (char: string) => {
    setBrushChar(char);
    setTool("brush");
    feedback.success(`Picked: ${char}`, { duration: 600, position: "top-right" });
  };

  if (searchQuery.trim() !== "") {
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="px-4">
          Results ({searchResults.length})
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="flex flex-wrap gap-0.5 p-2">
            {searchResults.map((char, idx) => (
              <CharButton
                key={`search-${idx}`}
                char={char}
                label={getCharacterLabel(char)}
                isSelected={brushChar === char}
                onClick={handleSelect}
              />
            ))}
            {searchResults.length === 0 && (
              <div className="w-full flex flex-col items-center py-10 text-muted-foreground">
                <SearchX className="size-8 mb-2 opacity-20" />
                <p className="text-[10px]">No blueprints found</p>
              </div>
            )}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (error && !data) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="flex flex-col items-center gap-3 px-3 py-10 text-center text-muted-foreground">
            <SearchX className="size-8 opacity-25" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                Library failed to load
              </p>
              <p className="break-words text-[10px] leading-4">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void fetchLibrary()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-foreground hover:bg-accent/80"
            >
              <RefreshCcw className="size-3.5" />
              Retry
            </button>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        <span className="text-[10px] font-medium tracking-widest uppercase">
          Syncing...
        </span>
      </div>
    );
  }

  return (
    <SidebarMenu className="px-0 gap-1 pb-10">
      <Collapsible defaultOpen className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton>
              <Terminal className="size-4 text-cyan-500" />
              <span className="font-bold text-xs uppercase tracking-tight">
                Nerd Icons
              </span>
              <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="mr-0 pr-0">
              {Object.entries(data.nerdfonts).map(([name, items]) => (
                <Collapsible key={name} className="group/sub">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="h-7 text-[10px] opacity-70 hover:opacity-100">
                        <Folder className="size-3 mr-1" /> {name}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="flex flex-wrap gap-0.5 py-1 pl-0 overflow-hidden">
                        {items.map((item, idx) => (
                          <CharButton
                            key={`${name}-${item.name}-${idx}`}
                            char={item.char}
                            label={item.name}
                            isSelected={brushChar === item.char}
                            onClick={handleSelect}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>

      <Collapsible defaultOpen className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton>
              <SquareDashed className="size-4 text-emerald-500" />
              <span className="font-bold text-xs uppercase tracking-tight">
                Box Drawing
              </span>
              <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="mr-0 pr-0">
              {Object.entries(data.boxDrawing).map(([name, items]) => (
                <Collapsible key={name} className="group/sub">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="h-7 text-[10px] opacity-70 hover:opacity-100">
                        <Folder className="size-3 mr-1" /> {name}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="flex flex-wrap gap-0.5 py-1 pl-0 overflow-hidden">
                        {items.map((item, idx) => (
                          <CharButton
                            key={`${name}-${idx}`}
                            char={item.char}
                            label={item.name}
                            isSelected={brushChar === item.char}
                            onClick={handleSelect}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>

      <Collapsible defaultOpen className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton>
              <Sparkles className="size-4 text-yellow-500" />
              <span className="font-bold text-xs uppercase tracking-tight">
                Curated Emoji
              </span>
              <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="mr-0 pr-0">
              {Object.entries(data.emojis).map(([groupName, subgroups]) => (
                <Collapsible key={groupName} className="group/sub">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="h-7 text-[10px] opacity-70 hover:opacity-100">
                        <FolderOpen className="size-3 mr-1" /> {groupName}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="mr-0 pr-0">
                        {Object.entries(subgroups).map(
                          ([subgroupName, items]) => (
                            <Collapsible
                              key={subgroupName}
                              className="group/sub2"
                            >
                              <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                  <SidebarMenuButton className="h-6 text-[9px] opacity-60 hover:opacity-100">
                                    <Folder className="size-2.5 mr-1" />{" "}
                                    {subgroupName}
                                  </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="flex flex-wrap gap-0.5 py-1 pl-0 overflow-hidden">
                                    {items.map((item, idx) => (
                                      <CharButton
                                        key={`${subgroupName}-${idx}`}
                                        char={item.char}
                                        label={item.name}
                                        isSelected={brushChar === item.char}
                                        onClick={handleSelect}
                                      />
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </SidebarMenuItem>
                            </Collapsible>
                          )
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>

      <Collapsible className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton>
              <Languages className="size-4 text-indigo-500" />
              <span className="font-bold text-xs uppercase tracking-tight">
                Unicode Blocks
              </span>
              <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="mr-0 pr-0">
              {Object.entries(data.unicodeBlocks).map(([name, items]) => (
                <Collapsible key={name} className="group/sub">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="h-7 text-[10px] opacity-70 hover:opacity-100">
                        <Folder className="size-3 mr-1" /> {name}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="flex flex-wrap gap-0.5 py-1 pl-0 overflow-hidden">
                        {items.map((item, idx) => (
                          <CharButton
                            key={idx}
                            char={item.char}
                            label={item.name}
                            isSelected={brushChar === item.char}
                            onClick={handleSelect}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    </SidebarMenu>
  );
}
