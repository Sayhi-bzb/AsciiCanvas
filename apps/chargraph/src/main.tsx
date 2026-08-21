/* eslint-disable react-refresh/only-export-components */
import "./index.css";

import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  type CharDeskViewerElement,
  defineCharDeskViewer,
} from "@chardesk/viewer";
import { Button, Separator, Surface } from "@chardesk/ui";
import { CHARGRAPH_EXAMPLES, renderExample } from "./examples";

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
  readonly name: string;
  readonly summary: string;
  readonly source: string;
  readonly output: string;
}

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
      aria-label={label}
      controls="false"
      interaction="text"
      syntax="plain"
    />
  );
}

function CodePanel({ label, value }: { label: string; value: string }) {
  return (
    <Surface kind="floating" className="flex min-w-0 flex-col overflow-hidden">
      <p className="px-5 py-4 font-mono text-xs font-semibold tracking-widest text-muted-foreground">
        {label}
      </p>
      <Separator />
      <pre className="min-h-72 overflow-auto p-7 font-mono text-sm leading-relaxed whitespace-pre">
        {value}
      </pre>
    </Surface>
  );
}

function OutputPanel({ label, value }: { label: string; value: string }) {
  return (
    <Surface kind="floating" className="flex min-w-0 flex-col overflow-hidden p-4">
      <p className="pb-4 font-mono text-xs font-semibold tracking-widest text-muted-foreground">
        RENDERED / UNICODE
      </p>
      <UnicodeViewer source={value} label={label} />
    </Surface>
  );
}

function App() {
  const [examples, setExamples] = useState<readonly RenderedExample[]>([]);

  useEffect(() => {
    let active = true;

    void Promise.all(
      CHARGRAPH_EXAMPLES.map(async (example) => ({
        ...example,
        output: await renderExample(example),
      }))
    ).then((rendered) => {
      if (active) setExamples(rendered);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex h-16 w-[calc(100%-2rem)] max-w-7xl items-center gap-3 sm:w-[calc(100%-4rem)]">
        <Button asChild tone="link">
          <a href="/">CharDesk</a>
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-sm text-muted-foreground">CharGraph</span>
        <Button asChild tone="subtle" className="ml-auto">
          <a href="https://github.com/Sayhi-bzb/CharDesk">GitHub</a>
        </Button>
      </header>
      <Separator />

      <main className="mx-auto flex w-[calc(100%-2rem)] max-w-7xl flex-col sm:w-[calc(100%-4rem)]">
        <section className="flex flex-col gap-8 py-20 sm:py-28">
          <p className="font-mono text-xs font-semibold tracking-widest text-muted-foreground">
            SOURCE → UNICODE
          </p>
          <h1 className="max-w-5xl text-5xl leading-none font-semibold tracking-tight sm:text-7xl lg:text-8xl">
            让结构化语言，
            <br />
            成为真正的文本图形。
          </h1>
          <p className="max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
            CharGraph 把 Mermaid 等结构化语言转换为无 ANSI、可复制、可编辑的 Unicode 文本。
            人可以直接看懂，AI 也可以直接读取。
          </p>
          <Surface kind="embedded" className="flex w-fit flex-wrap items-center gap-3 px-4 py-3 font-mono text-xs text-muted-foreground">
            <span>结构化源码</span>
            <span aria-hidden="true">→</span>
            <span>CharGraph 插件</span>
            <span aria-hidden="true">→</span>
            <span>Unicode 文本</span>
          </Surface>
        </section>

        <Separator />

        <section className="flex flex-col gap-16 py-20 sm:py-28" aria-labelledby="examples-title">
          <div className="flex max-w-3xl flex-col gap-5">
            <p className="font-mono text-xs font-semibold tracking-widest text-muted-foreground">
              MERMAID PLUGIN
            </p>
            <h2 id="examples-title" className="text-4xl font-semibold tracking-tight sm:text-6xl">
              同一份结构，两种阅读方式
            </h2>
            <p className="text-base leading-7 text-muted-foreground sm:text-lg">
              左侧保留原始语义，右侧展示由同一份源码实时生成的 Unicode 结果。
            </p>
          </div>

          <div className="flex flex-col">
            {examples.map((example, index) => (
              <article key={example.id} id={example.id} className="flex flex-col gap-8 py-12">
                <Separator />
                <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[4rem_minmax(0,1fr)]">
                  <span className="pt-1 font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-2xl font-semibold tracking-tight">{example.name}</h3>
                    <p className="leading-7 text-muted-foreground">{example.summary}</p>
                  </div>
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                  <CodePanel label="RAW / MERMAID" value={example.source} />
                  <OutputPanel label={`${example.name} Unicode 输出`} value={example.output} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <Separator />
      <footer className="mx-auto flex min-h-24 w-[calc(100%-2rem)] max-w-7xl flex-col justify-center gap-3 text-sm text-muted-foreground sm:w-[calc(100%-4rem)] sm:flex-row sm:items-center sm:justify-between">
        <span>CharGraph is incubated by CharDesk.</span>
        <Button asChild tone="link">
          <a href="/">打开 Unicode Canvas</a>
        </Button>
      </footer>
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
