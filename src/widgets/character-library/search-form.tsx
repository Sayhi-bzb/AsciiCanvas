"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";
import {
  useLibraryStore,
  type CharacterViewId,
} from "@/domains/character-library/public";
import { cn } from "@/shared/lib/utils";
import { useUiI18n } from "@/shared/i18n";
import { rx } from "@/shared/styles/recipes";

type SearchFormProps = Omit<React.ComponentProps<"form">, "onSubmit"> & {
  view: CharacterViewId;
  unicodeQuery: string;
  unicodeLoading: boolean;
  onUnicodeQueryChange: (query: string) => void;
  onUnicodeSubmit: () => void;
};

export function SearchForm({
  view,
  unicodeQuery,
  unicodeLoading,
  onUnicodeQueryChange,
  onUnicodeSubmit,
  className,
  ...props
}: SearchFormProps) {
  const { t } = useUiI18n();
  const storedQuery = useLibraryStore((state) =>
    view === "unicode" ? "" : state.searchQueries[view]
  );
  const setPackSearchQuery = useLibraryStore(
    (state) => state.setPackSearchQuery
  );
  const [packValue, setPackValue] = React.useState(storedQuery);
  const isUnicode = view === "unicode";
  const value = isUnicode ? unicodeQuery : packValue;

  React.useEffect(() => {
    if (view !== "unicode") setPackValue(storedQuery);
  }, [storedQuery, view]);

  React.useEffect(() => {
    if (view === "unicode") return;
    const timer = window.setTimeout(
      () => setPackSearchQuery(view, packValue),
      100
    );
    return () => window.clearTimeout(timer);
  }, [packValue, setPackSearchQuery, view]);

  const clear = () => {
    if (isUnicode) onUnicodeQueryChange("");
    else {
      setPackValue("");
      setPackSearchQuery(view, "");
    }
  };

  return (
    <form
      className={cn("relative min-w-0", className)}
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        if (isUnicode) onUnicodeSubmit();
      }}
    >
      <label htmlFor="character-view-search" className="sr-only">
        {t("character.search.label")}
      </label>
      <input
        id="character-view-search"
        type="search"
        aria-label={t("character.search.label")}
        placeholder={
          isUnicode
            ? t("character.search.unicodePlaceholder")
            : t("character.search.currentPlaceholder")
        }
        className={cn(
          rx.field({ density: "default" }),
          "h-8 w-full border-0 bg-accent/60 pl-8 pr-10 text-xs shadow-none transition-colors focus-visible:bg-accent"
        )}
        value={value}
        onChange={(event) => {
          if (isUnicode) onUnicodeQueryChange(event.target.value);
          else setPackValue(event.target.value);
        }}
      />
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      {isUnicode ? (
        <button
          type="submit"
          aria-label={t("character.search.allUnicode")}
          disabled={!value.trim() || unicodeLoading}
          className="absolute right-1 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          {unicodeLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Search className="size-3.5" />
          )}
        </button>
      ) : value ? (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground hover:text-foreground"
        >
          Escape
        </button>
      ) : null}
    </form>
  );
}
