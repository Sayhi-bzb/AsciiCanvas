/* eslint-disable react-refresh/only-export-components */
import "./index.css";

import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  type CharDeskViewerElement,
  defineCharDeskViewer,
} from "@chardesk/viewer";
import {
  Button,
  FloatingSurface,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@chardesk/ui";
import { LineNav } from "./components/line-nav";
import {
  CHARGRAPH_EXAMPLES,
  type CharGraphExampleKind,
  type CharGraphExampleLevel,
  renderExample,
} from "./examples";

if (!document.querySelector("link[data-chardesk-fonts]")) {
  const fontStylesheet = document.createElement("link");
  fontStylesheet.rel = "stylesheet";
  fontStylesheet.href = "/fonts/fonts.css";
  fontStylesheet.dataset.chardeskFonts = "";
  document.head.append(fontStylesheet);
}

defineCharDeskViewer();

interface RenderedExample {
  readonly id: string;
  readonly kind: CharGraphExampleKind;
  readonly level: CharGraphExampleLevel;
  readonly detail?: string;
  readonly source: string;
  readonly output: string;
}

const EXAMPLE_CATEGORIES: readonly {
  kind: CharGraphExampleKind;
  label: string;
}[] = [
  { kind: "flowchart", label: "流程图" },
  { kind: "state", label: "状态图" },
  { kind: "sequence", label: "时序图" },
  { kind: "class", label: "类图" },
  { kind: "er", label: "实体关系图" },
  { kind: "xychart", label: "XY 图表" },
];

const DEFAULT_CATEGORY: CharGraphExampleKind = "flowchart";
const CATEGORY_HASH_PREFIX = "#type-";
const renderedExampleCache = new Map<string, Promise<RenderedExample>>();

const isExampleKind = (value: string): value is CharGraphExampleKind =>
  EXAMPLE_CATEGORIES.some((category) => category.kind === value);

const readCategoryFromHash = (): CharGraphExampleKind => {
  if (typeof window === "undefined") return DEFAULT_CATEGORY;
  const value = window.location.hash.startsWith(CATEGORY_HASH_PREFIX)
    ? window.location.hash.slice(CATEGORY_HASH_PREFIX.length)
    : "";
  return isExampleKind(value) ? value : DEFAULT_CATEGORY;
};

const categoryHref = (kind: CharGraphExampleKind) =>
  `${CATEGORY_HASH_PREFIX}${kind}`;

const CATEGORY_NAV_ITEMS = EXAMPLE_CATEGORIES.map((category) => ({
  title: category.label,
  href: categoryHref(category.kind),
}));

const loadExample = (
  example: (typeof CHARGRAPH_EXAMPLES)[number]
): Promise<RenderedExample> => {
  const cached = renderedExampleCache.get(example.id);
  if (cached) return cached;

  const pending = renderExample(example)
    .then((output) => ({ ...example, output }))
    .catch((error: unknown) => {
      renderedExampleCache.delete(example.id);
      throw error;
    });
  renderedExampleCache.set(example.id, pending);
  return pending;
};

function UnicodeViewer({ source, label }: { source: string; label: string }) {
  const viewerRef = useRef<CharDeskViewerElement>(null);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.source = source;
    viewer.syntax = "plain";
    viewer.controls = false;
    viewer.interaction = "text";
  }, [source]);

  return (
    <chardesk-viewer
      ref={viewerRef}
      className="chargraph-viewer"
      aria-label={label}
      controls="false"
      fit="width"
      interaction="text"
      syntax="plain"
    />
  );
}

function PageDivider() {
  return (
    <div
      data-slot="stripe-divider"
      data-bleed="true"
      className="chargraph-stripe-divider mx-auto h-8 max-w-6xl border-x border-separator"
      aria-hidden="true"
    />
  );
}

function ExampleDivider() {
  return (
    <div
      data-slot="stripe-divider"
      className="chargraph-diagonal-stripes h-8 border-y border-separator"
      aria-hidden="true"
    />
  );
}

function ExamplePanel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <p className="px-4 py-3 font-mono text-xs text-muted-foreground sm:px-6">
        {label}
      </p>
      <Separator variant="structural" />
      {children}
    </div>
  );
}

function Example({
  categoryLabel,
  example,
}: {
  categoryLabel: string;
  example: RenderedExample;
}) {
  const levelLabel = example.level === "basic" ? "Basic" : "Advanced";

  return (
    <article id={example.id} aria-label={`${categoryLabel} ${levelLabel}`}>
      {example.detail ? (
        <>
          <header className="px-4 py-4 sm:px-6">
            <h2 className="text-sm font-medium">{example.detail}</h2>
          </header>
          <Separator variant="structural" />
        </>
      ) : null}
      <div data-slot="example-grid" className="grid min-w-0 lg:grid-cols-2">
        <ExamplePanel label="Mermaid">
          <pre className="h-72 overflow-auto p-4 font-mono text-sm leading-relaxed whitespace-pre sm:p-6">
            {example.source}
          </pre>
        </ExamplePanel>
        <div
          data-slot="example-output"
          className="border-separator border-t lg:border-t-0 lg:border-l"
        >
          <ExamplePanel label="Unicode">
            <UnicodeViewer
              source={example.output}
              label={`${categoryLabel} ${levelLabel} Unicode 输出`}
            />
          </ExamplePanel>
        </div>
      </div>
    </article>
  );
}

function CategoryNavigation({ activeKind }: { activeKind: CharGraphExampleKind }) {
  const selectCategory = (kind: string) => {
    if (!isExampleKind(kind)) return;
    window.location.hash = categoryHref(kind);
  };

  return (
    <>
      <div className="p-3 2xl:hidden">
        <Select value={activeKind} onValueChange={selectCategory}>
          <SelectTrigger className="w-full" aria-label="案例分类">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" position="popper">
            <SelectGroup>
              {EXAMPLE_CATEGORIES.map((category) => (
                <SelectItem key={category.kind} value={category.kind}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <Separator variant="structural" className="2xl:hidden" />

      <aside
        data-slot="category-floating-nav"
        className="fixed top-1/2 right-[calc(50%+37rem)] hidden -translate-y-1/2 2xl:block"
      >
        <FloatingSurface variant="panel">
          <LineNav
            aria-label="案例分类"
            className="px-4"
            items={CATEGORY_NAV_ITEMS}
            activeHref={categoryHref(activeKind)}
            scrollActiveIntoView={false}
          />
        </FloatingSurface>
      </aside>
    </>
  );
}

function App() {
  const [activeKind, setActiveKind] = useState(readCategoryFromHash);
  const [renderedCategory, setRenderedCategory] = useState<{
    kind: CharGraphExampleKind;
    examples: readonly RenderedExample[];
  }>(() => ({ kind: activeKind, examples: [] }));

  useEffect(() => {
    const syncCategory = () => setActiveKind(readCategoryFromHash());
    window.addEventListener("hashchange", syncCategory);
    return () => window.removeEventListener("hashchange", syncCategory);
  }, []);

  useEffect(() => {
    let active = true;

    const selected = CHARGRAPH_EXAMPLES.filter(
      (example) => example.kind === activeKind
    );
    void Promise.all(selected.map(loadExample)).then(
      (rendered) => {
        if (active) setRenderedCategory({ kind: activeKind, examples: rendered });
      },
      () => {
        if (active) setRenderedCategory({ kind: activeKind, examples: [] });
      }
    );

    return () => {
      active = false;
    };
  }, [activeKind]);

  const activeLabel =
    EXAMPLE_CATEGORIES.find((category) => category.kind === activeKind)?.label ??
    "流程图";
  const examples =
    renderedCategory.kind === activeKind ? renderedCategory.examples : [];

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-background px-2 text-foreground">
      <main className="min-h-dvh">
        <header
          data-slot="page-frame"
          className="chargraph-screen-line-top chargraph-screen-line-bottom mx-auto flex h-14 max-w-6xl items-center gap-2 border-x border-separator px-4 sm:px-6"
        >
          <a href="/" className="text-sm font-medium">
            CharGraph
          </a>
          <nav aria-label="Primary" className="ml-auto flex items-center gap-1">
            <Button asChild tone="subtle" size="sm">
              <a href="/">CharDesk</a>
            </Button>
            <Button asChild tone="subtle" size="sm">
              <a href="https://github.com/Sayhi-bzb/CharDesk">GitHub</a>
            </Button>
          </nav>
        </header>
        <PageDivider />

        <section
          data-slot="page-frame"
          className="chargraph-screen-line-top chargraph-screen-line-bottom mx-auto max-w-6xl border-x border-separator px-4 py-12 sm:px-6 sm:py-16"
          aria-labelledby="page-title"
        >
          <h1 id="page-title" className="text-3xl font-medium tracking-tight sm:text-4xl">
            CharGraph
          </h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            Mermaid → Unicode
          </p>
        </section>
        <PageDivider />

        <section
          data-slot="page-frame"
          data-frame="content"
          className="chargraph-screen-line-top chargraph-screen-line-bottom mx-auto max-w-6xl border-x border-separator"
        >
          <CategoryNavigation activeKind={activeKind} />

          <div className="min-w-0">
            {examples.map((example, index) => (
              <div key={example.id}>
                <Example categoryLabel={activeLabel} example={example} />
                {index < examples.length - 1 ? <ExampleDivider /> : null}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("CharGraph app root is missing.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
