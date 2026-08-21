import "./style.css";
import { CHARGRAPH_EXAMPLES, renderExample } from "./examples";

const fontStylesheet = document.createElement("link");
fontStylesheet.rel = "stylesheet";
fontStylesheet.href = "/fonts/fonts.css";
document.head.append(fontStylesheet);

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) throw new Error("CharGraph app root is missing.");

const createCodePanel = (label: string, value: string, output = false) => {
  const panel = document.createElement("div");
  panel.className = `code-panel${output ? " code-panel--output" : ""}`;

  const heading = document.createElement("p");
  heading.className = "code-panel__label";
  heading.textContent = label;

  const pre = document.createElement("pre");
  pre.textContent = value;

  panel.append(heading, pre);
  return panel;
};

const renderPage = async () => {
  const renderedExamples = await Promise.all(
    CHARGRAPH_EXAMPLES.map(async (example) => ({
      ...example,
      output: await renderExample(example),
    }))
  );

  app.innerHTML = `
    <header class="site-header">
      <a class="brand" href="/">CharDesk</a>
      <span class="brand-divider" aria-hidden="true"></span>
      <span class="product-name">CharGraph</span>
      <a class="header-link" href="https://github.com/Sayhi-bzb/CharDesk">GitHub</a>
    </header>
    <main>
      <section class="hero">
        <p class="eyebrow">SOURCE → UNICODE</p>
        <h1>让结构化语言，<br />成为真正的文本图形。</h1>
        <p class="hero-copy">
          CharGraph 把 Mermaid 等结构化语言转换为无 ANSI、可复制、可编辑的 Unicode 文本。
          人可以直接看懂，AI 也可以直接读取。
        </p>
        <div class="hero-contract" aria-label="CharGraph rendering contract">
          <span>结构化源码</span><span aria-hidden="true">→</span><span>CharGraph 插件</span><span aria-hidden="true">→</span><span>Unicode 文本</span>
        </div>
      </section>
      <section class="examples" aria-labelledby="examples-title">
        <div class="section-heading">
          <p class="eyebrow">MERMAID PLUGIN</p>
          <h2 id="examples-title">同一份结构，两种阅读方式</h2>
          <p>左侧保留原始语义，右侧展示由同一份源码实时生成的 Unicode 结果。</p>
        </div>
        <div class="example-list"></div>
      </section>
    </main>
    <footer>
      <span>CharGraph is incubated by CharDesk.</span>
      <a href="/">打开 Unicode Canvas</a>
    </footer>
  `;

  const list = app.querySelector<HTMLDivElement>(".example-list");
  if (!list) throw new Error("CharGraph example list is missing.");

  renderedExamples.forEach((example, index) => {
    const article = document.createElement("article");
    article.className = "example";
    article.id = example.id;

    const header = document.createElement("div");
    header.className = "example__header";
    header.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span><div><h3></h3><p></p></div>`;
    const title = header.querySelector("h3");
    const summary = header.querySelector("p");
    if (title) title.textContent = example.name;
    if (summary) summary.textContent = example.summary;

    const comparison = document.createElement("div");
    comparison.className = "comparison";
    comparison.append(
      createCodePanel("RAW / MERMAID", example.source),
      createCodePanel("RENDERED / UNICODE", example.output, true)
    );

    article.append(header, comparison);
    list.append(article);
  });
};

void renderPage();
