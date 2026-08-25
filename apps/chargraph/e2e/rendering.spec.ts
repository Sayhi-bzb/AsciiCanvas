import { expect, test, type Page } from "@playwright/test";

const FIRST_CASE_TITLES: Record<string, string> = {
  "block-layout": "Product Workspace",
  flowchart: "输入校验",
  state: "文档审核",
  sequence: "请求响应",
  class: "文档模型",
  er: "用户与订单",
  xychart: "月度趋势",
  "markdown-basics": "基础排版",
  "markdown-structure": "任务清单",
  "markdown-code": "代码块",
  "markdown-alert": "提示信息",
  "markdown-math": "行内公式",
};

test("renders the shared block layout dashboard as its own category", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1728, height: 900 });
  await page.goto("./#type-block-layout");

  await expect(page.getByRole("tab", { name: "二维布局" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  const article = page.locator("#block-layout-dashboard");
  await expect(page.locator("main article")).toHaveCount(1);
  await expect(article).toHaveAttribute(
    "aria-label",
    "二维布局 · Product Workspace"
  );
  await expect(
    article.locator('[data-slot="example-panel"]').first()
  ).toHaveAttribute("aria-label", "Layout");
  await expect(article.locator('[data-slot="example-source"]')).toContainText(
    "|||"
  );
  const viewer = article.locator("chardesk-viewer");
  await expect(viewer.locator("pre")).toContainText("CharDesk Workspace");
  await expect(viewer.locator("pre")).toContainText("All systems operational");
  await expect(viewer.locator("a", { hasText: "github.com/Sayhi-bzb/CharDesk" }))
    .toHaveAttribute("href", "https://github.com/Sayhi-bzb/CharDesk");
});

const expectUnicodeViewersToFit = async (page: Page) => {
  const viewers = page.locator("chardesk-viewer");
  await expect(viewers).toHaveCount(3);

  await expect.poll(async () => {
    const overflow = await viewers.evaluateAll((elements) =>
      elements.map((element) => {
        const viewport = element.shadowRoot?.querySelector<HTMLElement>(
          '[part="viewport"]'
        );
        if (!viewport) return Number.POSITIVE_INFINITY;
        return Math.max(
          viewport.scrollWidth - viewport.clientWidth,
          viewport.scrollHeight - viewport.clientHeight
        );
      })
    );
    return Math.max(...overflow);
  }).toBeLessThanOrEqual(1);
};

const expectStructuralChrome = async (page: Page) => {
  const separators = page.locator('[data-slot="separator"]:visible');
  await expect(separators.first()).toBeVisible();
  await expect.poll(async () =>
    separators.evaluateAll((elements) =>
      elements.every((element) => {
        const style = getComputedStyle(element);
        return style.height === "1px" && style.borderRadius === "0px";
      })
    )
  ).toBe(true);

  const frames = page.locator('[data-slot="page-frame"]');
  await expect(frames).toHaveCount(3);
  await expect.poll(async () =>
    frames.evaluateAll((elements) => {
      const edges = elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return `${Math.round(rect.left)}:${Math.round(rect.right)}`;
      });
      return new Set(edges).size;
    })
  ).toBe(1);

  const dividers = page.locator('[data-slot="stripe-divider"]');
  await expect(dividers).toHaveCount(4);
  await expect.poll(async () =>
    dividers.evaluateAll((elements) =>
      elements.every((element) => {
        const pattern = element.querySelector<HTMLElement>(
          '[data-slot="stripe-divider-pattern"]'
        );
        const boundaries = Array.from(
          element.querySelectorAll<HTMLElement>('[data-boundary]')
        );
        if (!pattern || boundaries.length !== 2) return false;

        const coversViewport = (layer: HTMLElement) => {
          const rect = layer.getBoundingClientRect();
          return rect.left <= 0 && rect.right >= window.innerWidth;
        };
        return (
          element.getAttribute("data-bleed") === "true" &&
          element.getBoundingClientRect().height === 32 &&
          getComputedStyle(pattern).backgroundImage.includes(
            "repeating-linear-gradient"
          ) &&
          coversViewport(pattern) &&
          boundaries.every(
            (boundary) =>
              coversViewport(boundary) &&
              getComputedStyle(boundary).height === "1px"
          )
        );
      })
    )
  ).toBe(true);
};

const expectCompactPageHeader = async (page: Page) => {
  const header = page.locator('[data-frame="header"]');
  const categories = page.locator('[data-slot="category-tabs"]');
  const topDivider = page.locator(
    '[data-frame="header"] + [data-slot="stripe-divider"]'
  );

  await expect(page.getByRole("heading", { level: 1, name: "CharGraph" })).toHaveCount(1);
  await expect(page.getByText("Mermaid + Markdown → Unicode")).toHaveCount(0);
  await expect(topDivider).toBeVisible();
  await expect.poll(async () =>
    topDivider.evaluate(
      (element) =>
        element.nextElementSibling?.getAttribute("data-frame") === "content"
    )
  ).toBe(true);
  await expect.poll(async () =>
    header.evaluate((element) => element.getBoundingClientRect().height)
  ).toBe(48);
  await expect.poll(async () =>
    categories.evaluate((element) => element.getBoundingClientRect().height)
  ).toBeLessThanOrEqual(52);
};

const expectLineNav = async (page: Page, activeLabel: string) => {
  const navigation = page.getByRole("navigation", { name: "案例" });
  await expect(navigation).toHaveAttribute("data-slot", "line-nav");

  const activeLink = navigation.getByRole("link", { name: activeLabel });
  await expect(activeLink).toHaveAttribute("aria-current", "location");
  await expect.poll(async () =>
    activeLink.locator('[data-slot="line-nav-marker"]').evaluate((element) =>
      Math.round(element.getBoundingClientRect().width)
    )
  ).toBe(40);

  const fits = await navigation.evaluate(
    (element) => element.scrollWidth <= element.clientWidth
  );
  expect(fits).toBe(true);
};

const expectFloatingLineNav = async (page: Page) => {
  const floatingNav = page.locator('[data-slot="case-floating-nav"]');
  const contentFrame = page.locator('[data-frame="content"]');

  await expect(floatingNav).toBeVisible();
  await expect.poll(async () =>
    floatingNav.evaluate((element) => getComputedStyle(element).position)
  ).toBe("fixed");

  const placement = await floatingNav.evaluate((element) => {
    const frame = document.querySelector<HTMLElement>('[data-frame="content"]');
    if (!frame) throw new Error("Content frame is missing");

    const navRect = element.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    return {
      gap: frameRect.left - navRect.right,
      verticalOffset:
        navRect.top + navRect.height / 2 - window.innerHeight / 2,
    };
  });
  expect(placement.gap).toBeGreaterThanOrEqual(15);
  expect(placement.gap).toBeLessThanOrEqual(17);
  expect(Math.abs(placement.verticalOffset)).toBeLessThanOrEqual(1);

  const hoverLink = page
    .getByRole("navigation", { name: "案例" })
    .getByRole("link")
    .nth(1);
  const hoverMarker = hoverLink.locator('[data-slot="line-nav-marker"]');
  const hoverLabel = hoverLink.locator("span").last();
  const readHoverGeometry = async () => {
    const [surface, labelLeft, content] = await Promise.all([
      floatingNav.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      }),
      hoverLabel.evaluate((element) => element.getBoundingClientRect().left),
      contentFrame.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }),
    ]);
    return {
      surfaceLeft: surface.left,
      surfaceRight: surface.right,
      surfaceWidth: surface.width,
      labelLeft,
      contentLeft: content.left,
      contentRight: content.right,
    };
  };

  await expect.poll(async () =>
    hoverMarker.evaluate((element) =>
      Math.round(element.getBoundingClientRect().width)
    )
  ).toBe(24);
  const geometryBeforeHover = await readHoverGeometry();

  await hoverLink.hover();
  await expect.poll(async () =>
    hoverMarker.evaluate((element) =>
      Math.round(element.getBoundingClientRect().width)
    )
  ).toBe(40);
  const geometryDuringHover = await readHoverGeometry();

  for (const key of Object.keys(geometryBeforeHover) as Array<
    keyof typeof geometryBeforeHover
  >) {
    expect(geometryDuringHover[key]).toBeCloseTo(geometryBeforeHover[key], 0);
  }

  await page.mouse.move(0, 0);
  await expect.poll(async () =>
    hoverMarker.evaluate((element) =>
      Math.round(element.getBoundingClientRect().width)
    )
  ).toBe(24);
  const geometryAfterHover = await readHoverGeometry();
  for (const key of Object.keys(geometryBeforeHover) as Array<
    keyof typeof geometryBeforeHover
  >) {
    expect(geometryAfterHover[key]).toBeCloseTo(geometryBeforeHover[key], 0);
  }

  const topBeforeScroll = await floatingNav.evaluate(
    (element) => element.getBoundingClientRect().top
  );
  await contentFrame.evaluate((element) =>
    element.scrollIntoView({ block: "end" })
  );
  await expect.poll(async () =>
    floatingNav.evaluate((element) => element.getBoundingClientRect().top)
  ).toBeCloseTo(topBeforeScroll, 0);
};

const expectExamplesToFillContentFrame = async (page: Page) => {
  const edges = await page
    .locator('[data-slot="example-grid"]')
    .first()
    .evaluate((element) => {
      const frame = document.querySelector<HTMLElement>('[data-frame="content"]');
      if (!frame) throw new Error("Content frame is missing");

      const gridRect = element.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      return {
        left: gridRect.left - frameRect.left,
        right: frameRect.right - gridRect.right,
      };
    });
  expect(edges.left).toBeGreaterThanOrEqual(0);
  expect(edges.left).toBeLessThanOrEqual(1);
  expect(edges.right).toBeGreaterThanOrEqual(0);
  expect(edges.right).toBeLessThanOrEqual(1);
};

const openDesktopCategory = async (
  page: Page,
  label: string,
  kind: string
) => {
  const tab = page.getByRole("tab", { name: label });
  await tab.click();
  await expect(page).toHaveURL(new RegExp(`#type-${kind}$`));
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { level: 2, name: label, exact: true })
  ).toHaveCount(0);
  await expect(page.locator("main article")).toHaveCount(3);
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: FIRST_CASE_TITLES[kind],
      exact: true,
    })
  ).toBeVisible();
  await expectLineNav(page, FIRST_CASE_TITLES[kind] ?? "");
};

test("renders directed diagrams through the category navigation", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 1728, height: 900 });
  await page.goto("./");

  await expectCompactPageHeader(page);
  await expect(page.getByRole("tab", { name: "流程图" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expectLineNav(page, "输入校验");
  const flow = page.locator("#flowchart chardesk-viewer pre");
  await expect(flow).toContainText("用户输入");
  await expect(flow).toContainText("验证通过？");
  await expect(flow).toContainText(/是─+>│\s*保存数据\s*│/u);
  await expect(flow).toContainText(/>│\s*显示错误\s*│/u);
  await expect(flow).toContainText("否");
  await expect(flow).not.toContainText(/[─┄━]\^ +│/u);
  await expect(flow).not.toContainText("flowchart LR");
  await expect.poll(async () =>
    page.locator("#flowchart chardesk-viewer span.run").evaluateAll((elements) =>
      new Set(elements.map((element) =>
        (element as HTMLElement).style.getPropertyValue("--run-fg")
      ).filter((color) => [
        "#2563eb",
        "#0891b2",
        "#16a34a",
        "#ca8a04",
        "#dc2626",
      ].includes(color))).size
    )
  ).toBeGreaterThanOrEqual(2);
  await expect.poll(async () =>
    page.locator("#flowchart chardesk-viewer span.run").evaluateAll((elements) =>
      elements.some((element) =>
        (element as HTMLElement).style.getPropertyValue("--run-fg") === "#94a3b8"
      )
    )
  ).toBe(false);
  const deployment = page.locator("#flowchart-intermediate chardesk-viewer pre");
  await expect(deployment).toContainText("持续集成");
  await expect(deployment).toContainText("生产环境");
  await expectUnicodeViewersToFit(page);
  await expectStructuralChrome(page);

  await openDesktopCategory(page, "状态图", "state");
  const state = page.locator("#state chardesk-viewer pre");
  await expect(state).toContainText("草稿");
  await expect(state).toContainText("审核");
  await expect(state).not.toContainText("stateDiagram-v2");
  await expect(
    page.locator("#state-intermediate chardesk-viewer pre")
  ).toContainText("退回修改");
  await expectUnicodeViewersToFit(page);

  await openDesktopCategory(page, "时序图", "sequence");
  await expect(
    page.locator("#sequence-intermediate chardesk-viewer pre")
  ).toContainText("重试任务");

  await openDesktopCategory(page, "类图", "class");
  const classModel = page.locator("#class-intermediate chardesk-viewer pre");
  await expect(classModel).toContainText("内容域");
  await expect(classModel).toContainText("0..*");
  const classDiagram = page.locator("#class-advanced chardesk-viewer pre");
  await expect(classDiagram).toContainText("<<interface>>");
  await expect(classDiagram).toContainText("渲染器");
  await expect(classDiagram).toContainText(/[△▽◁▷^v]/u);
  await expect(classDiagram).toContainText(/┆|┄/u);
  await expect(classDiagram).not.toContainText("classDiagram");
  await expectUnicodeViewersToFit(page);

  await openDesktopCategory(page, "实体关系图", "er");
  const socialModel = page.locator("#er-intermediate chardesk-viewer pre");
  await expect(socialModel).toContainText("关注");
  await expect(socialModel).toContainText("推荐");
  const socialText = await socialModel.innerText();
  const socialLines = socialText.trimEnd().split("\n");
  expect(socialLines.length).toBeLessThanOrEqual(10);
  expect(socialLines.find((line) => line.includes("推荐"))).toMatch(/[╭╮─┄]/u);
  const erDiagram = page.locator("#er-advanced chardesk-viewer pre");
  await expect(erDiagram).toContainText("订单项");
  await expect(erDiagram).toContainText("被引用");
  await expect(erDiagram).toContainText(/○[╟╢╥╨]/u);
  await expect(erDiagram).toContainText(/┄|┆/u);
  await expect(erDiagram).not.toContainText("erDiagram");
  await expectUnicodeViewersToFit(page);

  expect(pageErrors).toEqual([]);
});

test("uses LineNav as a scroll-aware case index", async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 900 });
  await page.goto("./#type-flowchart");
  await expect(page.locator("main article")).toHaveCount(3);

  const navigation = page.getByRole("navigation", { name: "案例" });
  await navigation.getByRole("link", { name: "部署流水线" }).click();
  await expect(page).toHaveURL(/#flowchart-intermediate$/);
  await expectLineNav(page, "部署流水线");

  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.locator("#flowchart-advanced").evaluate((element) =>
    element.scrollIntoView({ block: "start" })
  );
  await expectLineNav(page, "形状与连线");
  await expect(page).toHaveURL(/#flowchart-intermediate$/);
});

test("renders styled Markdown categories through the same showcase", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 1728, height: 900 });
  await page.goto("./#type-markdown-basics");

  await expectCompactPageHeader(page);
  await expectLineNav(page, "基础排版");
  await expect(
    page.locator("#markdown-basics").getByText("Markdown", { exact: true })
  ).toBeVisible();
  await expect(page.locator("#markdown-basics > div pre").first()).toContainText(
    "**粗体**"
  );

  const basics = page.locator("#markdown-basics chardesk-viewer");
  await expect(basics.locator("pre")).toContainText("Markdown 概览");
  await expect(basics.locator("pre")).not.toContainText("**粗体**");
  await expect(basics.locator(".run.bold").first()).toBeVisible();
  await expect(basics.locator("a", { hasText: "CharDesk" })).toHaveAttribute(
    "href",
    "https://github.com/Sayhi-bzb/CharDesk"
  );
  await expect(
    page.locator("#markdown-basics-intermediate chardesk-viewer pre")
  ).toContainText("v0.2 发布说明");

  await openDesktopCategory(page, "列表与表格", "markdown-structure");
  const checklist = page.locator(
    "#markdown-structure-intermediate chardesk-viewer pre"
  );
  await expect(checklist).toContainText("回归测试");
  await expect(checklist).toContainText("○");

  await openDesktopCategory(page, "代码与 Diff", "markdown-code");
  const config = page.locator("#markdown-code-intermediate chardesk-viewer");
  await expect(config.locator("pre")).toContainText('"renderer": "markdown"');
  await expect(config.locator(".run").first()).toBeVisible();
  const diff = page.locator("#markdown-code-advanced chardesk-viewer");
  await expect(diff.locator("pre")).toContainText("+  return next(value);");
  await expect
    .poll(() =>
      diff
        .locator(".run", { hasText: "+  return next(value);" })
        .evaluate((element) => getComputedStyle(element).backgroundColor)
    )
    .not.toBe("rgba(0, 0, 0, 0)");

  await openDesktopCategory(page, "GitHub Alert", "markdown-alert");
  await expect(
    page.locator("#markdown-alert-intermediate chardesk-viewer pre")
  ).toContainText("│ IMPORTANT");
  await expect(
    page.locator("#markdown-alert-advanced chardesk-viewer pre")
  ).toContainText("│ CAUTION");

  await openDesktopCategory(page, "数学表达", "markdown-math");
  await expect(
    page.locator("#markdown-math-intermediate chardesk-viewer pre")
  ).toContainText("∑");
  await expect(
    page.locator("#markdown-math-advanced chardesk-viewer pre")
  ).toContainText("a + b");
  await expectUnicodeViewersToFit(page);
  expect(pageErrors).toEqual([]);
});

test("uses the mobile category select without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#type-sequence");

  await expectCompactPageHeader(page);
  const categorySelect = page.getByRole("combobox", { name: "案例分类" });
  const caseSelect = page.getByRole("combobox", { name: "案例", exact: true });
  await expect(categorySelect).toBeVisible();
  await expect(categorySelect).toContainText("时序图");
  await expect(caseSelect).toBeVisible();
  await expect(caseSelect).toContainText("请求响应");
  await expect(
    page.getByRole("heading", { level: 2, name: "分支与循环" })
  ).toBeVisible();
  await expect(page.locator('[data-slot="line-nav"]')).toBeHidden();
  await expect(page.locator("main article")).toHaveCount(3);
  await expectUnicodeViewersToFit(page);
  await expectStructuralChrome(page);

  await caseSelect.click();
  await page.getByRole("option", { name: "分支与循环" }).click();
  await expect(page).toHaveURL(/#sequence-advanced$/);
  await expect(caseSelect).toContainText("分支与循环");

  await categorySelect.click();
  await page.getByRole("option", { name: "XY 图表" }).click();
  await expect(page).toHaveURL(/#type-xychart$/);
  await expect(categorySelect).toContainText("XY 图表");
  await expect(caseSelect).toContainText("月度趋势");
  await expect(
    page.getByRole("heading", { level: 2, name: "横向混合图" })
  ).toBeVisible();
  await expect(
    page.locator("#xychart-intermediate chardesk-viewer pre")
  ).toContainText("预发布环境");
  await expect(page.locator("main article")).toHaveCount(3);
  await expectUnicodeViewersToFit(page);

  const hasPageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(hasPageOverflow).toBe(false);
});

test("keeps the diagram boundary aligned across layout breakpoints", async ({ page }) => {
  for (const width of [768, 1024, 1440, 1536, 1728]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./#type-er");
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await expect(page.locator("main article")).toHaveCount(3);

    const categorySelect = page.getByRole("combobox", { name: "案例分类" });
    const categoryTabs = page.getByRole("tablist", { name: "案例分类" });
    const caseSelect = page.getByRole("combobox", { name: "案例", exact: true });
    const lineNav = page.locator('[data-slot="line-nav"]');
    if (width < 1024) {
      await expect(categorySelect).toBeVisible();
      await expect(categoryTabs).toBeHidden();
      await expect(caseSelect).toBeVisible();
      await expect(lineNav).toBeHidden();
    } else if (width < 1536) {
      await expect(categorySelect).toBeHidden();
      await expect(categoryTabs).toBeVisible();
      await expect(caseSelect).toBeVisible();
      await expect(lineNav).toBeHidden();
    } else {
      await expect(categorySelect).toBeHidden();
      await expect(categoryTabs).toBeVisible();
      await expect(caseSelect).toBeHidden();
      await expectLineNav(page, "用户与订单");
      await expectFloatingLineNav(page);
    }
    if (width >= 1024) {
      const tabGeometry = await categoryTabs.evaluate((element) => {
        const triggers = Array.from(
          element.querySelectorAll<HTMLElement>('[role="tab"]')
        );
        return {
          fits: element.scrollWidth <= element.clientWidth,
          rowCount: new Set(
            triggers.map((trigger) => Math.round(trigger.getBoundingClientRect().top))
          ).size,
        };
      });
      expect(tabGeometry).toEqual({ fits: true, rowCount: 1 });
    }

    await expectExamplesToFillContentFrame(page);

    const boundary = page.locator('[data-slot="example-output"]').first();
    const borders = await boundary.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.borderTopWidth, style.borderLeftWidth];
    });
    expect(borders).toEqual(width < 1024 ? ["1px", "0px"] : ["0px", "1px"]);

    const hasPageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasPageOverflow).toBe(false);
    await expectStructuralChrome(page);
  }
});

test("closes short and long pages with the framed footer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 2000 });
  await page.goto("./#type-flowchart");
  await expect(page.locator("main article")).toHaveCount(3);

  const shortPageGeometry = await page
    .locator('[data-frame="footer"]')
    .evaluate((footer) => {
      const content = document.querySelector<HTMLElement>('[data-frame="content"]');
      const closingDivider = document.querySelector<HTMLElement>(
        'main + [data-slot="stripe-divider"]'
      );
      const examplesBoundary = document.querySelector<HTMLElement>(
        '[data-boundary="examples-end"]'
      );
      const exampleGrids = document.querySelectorAll<HTMLElement>(
        '[data-slot="example-grid"]'
      );
      const lastExampleGrid = exampleGrids.item(exampleGrids.length - 1);
      if (!content || !closingDivider || !examplesBoundary || !lastExampleGrid) {
        throw new Error("Closing page structure is missing");
      }

      const boundaryStyle = getComputedStyle(examplesBoundary);

      return {
        footerBottom: footer.getBoundingClientRect().bottom,
        viewportBottom: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        contentBottom: content.getBoundingClientRect().bottom,
        dividerTop: closingDivider.getBoundingClientRect().top,
        dividerBottom: closingDivider.getBoundingClientRect().bottom,
        footerTop: footer.getBoundingClientRect().top,
        lastExampleBottom: lastExampleGrid.getBoundingClientRect().bottom,
        examplesBoundaryTop: examplesBoundary.getBoundingClientRect().top,
        examplesBoundaryBottom: examplesBoundary.getBoundingClientRect().bottom,
        examplesBoundaryHeight: boundaryStyle.height,
        examplesBoundaryRadius: boundaryStyle.borderRadius,
      };
    });
  expect(shortPageGeometry.footerBottom).toBeCloseTo(
    shortPageGeometry.viewportBottom,
    0
  );
  expect(shortPageGeometry.documentHeight).toBe(2000);
  expect(shortPageGeometry.contentBottom).toBeCloseTo(
    shortPageGeometry.dividerTop,
    0
  );
  expect(shortPageGeometry.dividerBottom).toBeCloseTo(
    shortPageGeometry.footerTop,
    0
  );
  expect(shortPageGeometry.lastExampleBottom).toBeCloseTo(
    shortPageGeometry.examplesBoundaryTop,
    0
  );
  expect(shortPageGeometry.examplesBoundaryHeight).toBe("1px");
  expect(shortPageGeometry.examplesBoundaryRadius).toBe("0px");
  expect(shortPageGeometry.examplesBoundaryBottom).toBeLessThan(
    shortPageGeometry.contentBottom
  );

  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto("./#type-sequence");
  await expect(page.locator("main article")).toHaveCount(3);

  const longPageGeometry = await page
    .locator('[data-frame="footer"]')
    .evaluate((footer) => ({
      footerBottom: footer.getBoundingClientRect().bottom + window.scrollY,
      viewportHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
    }));
  expect(longPageGeometry.documentHeight).toBeGreaterThan(
    longPageGeometry.viewportHeight
  );
  expect(longPageGeometry.footerBottom).toBeCloseTo(
    longPageGeometry.documentHeight,
    0
  );
});

test("supports category deep links and browser history", async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 900 });
  await page.goto("./#type-state");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const stateTab = page.getByRole("tab", { name: "状态图" });
  await expect(stateTab).toHaveAttribute("aria-selected", "true");
  await expectLineNav(page, "文档审核");

  await openDesktopCategory(page, "时序图", "sequence");
  await page.goBack();
  await expect(page).toHaveURL(/#type-state$/);
  await expect(stateTab).toHaveAttribute("aria-selected", "true");

  await page.goto("./#sequence-advanced");
  await expect(page.getByRole("tab", { name: "时序图" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expectLineNav(page, "分支与循环");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.goto("./#type-unknown");
  await expect(page.getByRole("tab", { name: "流程图" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.locator("main article")).toHaveCount(3);
});
