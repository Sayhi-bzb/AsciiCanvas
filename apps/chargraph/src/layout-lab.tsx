import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { type CharDeskViewerElement } from "@chardesk/viewer";
import {
  Button,
  Input,
  Label,
  PageFrame,
  PageShell,
  Separator,
  StripeDivider,
  Textarea,
} from "@chardesk/ui";
import { getCharGraphText, serializeCharGraphAnsi } from "@chardesk/chargraph";
import { renderBlockLayout } from "@chardesk/chargraph/experimental/block-layout";
import { BLOCK_LAYOUT_DASHBOARD_EXAMPLE } from "./examples";

function LayoutPreview({ source }: { source: string }) {
  const viewerRef = useRef<CharDeskViewerElement>(null);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.source = source;
    viewer.syntax = "ansi";
    viewer.controls = false;
    viewer.interaction = "text";
  }, [source]);

  return (
    <chardesk-viewer
      ref={viewerRef}
      className="block min-h-80 w-full"
      style={
        {
          "--chardesk-background": "var(--background)",
          "--chardesk-border-color": "transparent",
          "--chardesk-radius": 0,
        } as CSSProperties
      }
      aria-label="Block layout Unicode preview"
      controls="false"
      fit="width"
      interaction="text"
      syntax="ansi"
    />
  );
}

const readGap = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

export function LayoutLab() {
  const [source, setSource] = useState(BLOCK_LAYOUT_DASHBOARD_EXAMPLE.source);
  const [columnGap, setColumnGap] = useState(4);
  const [rowGap, setRowGap] = useState(1);
  const rendered = useMemo(
    () => renderBlockLayout(source, { columnGap, rowGap }),
    [columnGap, rowGap, source]
  );
  const protocolSource = useMemo(() => serializeCharGraphAnsi(rendered), [rendered]);
  const outputText = useMemo(() => getCharGraphText(rendered), [rendered]);
  return (
    <PageShell>
      <main className="flex flex-1 flex-col">
        <PageFrame
          as="header"
          bleed
          boundaries="start"
          className="mx-auto flex h-12 w-full max-w-6xl items-center gap-2 px-4 sm:px-6"
        >
          <h1 className="text-sm font-medium">Block Layout Lab</h1>
          <Button asChild tone="subtle" size="sm" className="ml-auto">
            <a href="/chargraph/">CharGraph</a>
          </Button>
        </PageFrame>
        <StripeDivider bleed className="mx-auto w-full max-w-6xl border-x border-separator" />

        <PageFrame
          as="section"
          boundaries="none"
          className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 lg:grid-cols-2"
        >
          <section className="flex min-w-0 flex-col border-b border-separator lg:border-r lg:border-b-0">
            <div className="flex min-h-12 flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
              <p className="text-xs text-muted-foreground">
                <code>|||</code> next field · <code>---</code> next row
              </p>
              <div className="ml-auto flex items-center gap-2">
                <Label htmlFor="column-gap">Column</Label>
                <Input
                  id="column-gap"
                  type="number"
                  min={0}
                  value={columnGap}
                  onChange={(event) => setColumnGap(readGap(event.target.value, 4))}
                  className="w-16"
                />
                <Label htmlFor="row-gap">Row</Label>
                <Input
                  id="row-gap"
                  type="number"
                  min={0}
                  value={rowGap}
                  onChange={(event) => setRowGap(readGap(event.target.value, 1))}
                  className="w-16"
                />
              </div>
            </div>
            <Separator variant="structural" />
            <Textarea
              appearance="editor"
              aria-label="Block layout source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              spellCheck={false}
              className="min-h-[32rem] flex-1 resize-none p-4 sm:p-6"
            />
            <Separator variant="structural" />
            <div
              className="min-h-10 px-4 py-2 text-xs sm:px-6"
              data-slot="layout-status"
              role="status"
            >
              {outputText.length} characters · live preview
            </div>
          </section>

          <section className="min-w-0">
            <div className="flex h-12 items-center px-4 text-xs font-medium text-muted-foreground sm:px-6">
              Unicode preview
            </div>
            <Separator variant="structural" />
            <div className="min-h-[32rem] p-4 sm:p-6">
              <LayoutPreview source={protocolSource} />
            </div>
          </section>
        </PageFrame>
      </main>
    </PageShell>
  );
}
