import { expect, test, type Page } from "@playwright/test";

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
  await expect(frames).toHaveCount(4);
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
  await expect(dividers).toHaveCount(5);
  await expect.poll(async () =>
    dividers.evaluateAll((elements) =>
      elements.every((element) => {
        const style = getComputedStyle(
          element,
          element.getAttribute("data-bleed") === "true" ? "::before" : null
        );
        return style.backgroundImage.includes("repeating-linear-gradient");
      })
    )
  ).toBe(true);
};

const expectLineNav = async (page: Page, activeLabel: string) => {
  const navigation = page.getByRole("navigation", { name: "案例分类" });
  await expect(navigation).toHaveAttribute("data-slot", "line-nav");

  const activeLink = navigation.getByRole("link", { name: activeLabel });
  await expect(activeLink).toHaveAttribute("aria-current", "page");
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
  const floatingNav = page.locator('[data-slot="category-floating-nav"]');
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
    .getByRole("navigation", { name: "案例分类" })
    .getByRole("link", { name: "Markdown 基础排版" });
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
  const link = page
    .getByRole("navigation", { name: "案例分类" })
    .getByRole("link", { name: label });
  await link.click();
  await expect(page).toHaveURL(new RegExp(`#type-${kind}$`));
  await expect(link).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { level: 2, name: label, exact: true })
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Basic" })).toHaveCount(0);
  await expect(page.locator("main article").nth(1).getByRole("heading", { level: 2 })).toBeVisible();
  await expect(page.locator("main article").nth(2).getByRole("heading", { level: 2 })).toBeVisible();
  await expect(page.locator("main article").nth(1)).toHaveAttribute(
    "aria-label",
    `${label} Intermediate`
  );
  await expect(page.locator("main article").nth(2)).toHaveAttribute(
    "aria-label",
    `${label} Advanced`
  );
  await expect(page.locator("main article")).toHaveCount(3);
};

test("renders directed diagrams through the category navigation", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 1728, height: 900 });
  await page.goto("./");

  await expect(
    page
      .getByRole("navigation", { name: "案例分类" })
      .getByRole("link", { name: "流程图" })
  ).toHaveAttribute("aria-current", "page");
  await expectLineNav(page, "流程图");
  const flow = page.locator("#flowchart chardesk-viewer pre");
  await expect(flow).toContainText("用户输入");
  await expect(flow).toContainText("验证通过？");
  await expect(flow).toContainText(/是─+>│\s*保存数据\s*│/u);
  await expect(flow).toContainText(/>│\s*显示错误\s*│/u);
  await expect(flow).toContainText("否");
  await expect(flow).not.toContainText(/[─┄━]\^ +│/u);
  await expect(flow).not.toContainText("flowchart LR");
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
  const erDiagram = page.locator("#er-advanced chardesk-viewer pre");
  await expect(erDiagram).toContainText("订单项");
  await expect(erDiagram).toContainText("被引用");
  await expect(erDiagram).toContainText(/○[╟╢╥╨]/u);
  await expect(erDiagram).toContainText(/┄|┆/u);
  await expect(erDiagram).not.toContainText("erDiagram");
  await expectUnicodeViewersToFit(page);

  expect(pageErrors).toEqual([]);
});

test("renders styled Markdown categories through the same showcase", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 1728, height: 900 });
  await page.goto("./#type-markdown-basics");

  await expect(page.getByText("Mermaid + Markdown → Unicode")).toBeVisible();
  await expectLineNav(page, "Markdown 基础排版");
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

  await expect(page.getByRole("heading", { level: 1, name: "CharGraph" })).toBeVisible();
  const categorySelect = page.getByRole("combobox", { name: "案例分类" });
  await expect(categorySelect).toBeVisible();
  await expect(categorySelect).toContainText("时序图");
  await expect(page.getByRole("heading", { level: 2, name: "Basic" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "分支与循环" })
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "案例分类" })).toBeHidden();
  await expect(page.locator('[data-slot="line-nav"]')).toBeHidden();
  await expect(page.locator("main article")).toHaveCount(3);
  await expectUnicodeViewersToFit(page);
  await expectStructuralChrome(page);

  await categorySelect.click();
  await page.getByRole("option", { name: "XY 图表" }).click();
  await expect(page).toHaveURL(/#type-xychart$/);
  await expect(categorySelect).toContainText("XY 图表");
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
    await expect(page.locator("main article")).toHaveCount(3);

    const categorySelect = page.getByRole("combobox", { name: "案例分类" });
    const lineNav = page.getByRole("navigation", { name: "案例分类" });
    if (width < 1536) {
      await expect(categorySelect).toBeVisible();
      await expect(lineNav).toBeHidden();
    } else {
      await expect(categorySelect).toBeHidden();
      await expectLineNav(page, "实体关系图");
      await expectFloatingLineNav(page);
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
  const stateLink = page
    .getByRole("navigation", { name: "案例分类" })
    .getByRole("link", { name: "状态图" });
  await expect(stateLink).toHaveAttribute("aria-current", "page");
  await expectLineNav(page, "状态图");

  await openDesktopCategory(page, "时序图", "sequence");
  await page.goBack();
  await expect(page).toHaveURL(/#type-state$/);
  await expect(stateLink).toHaveAttribute("aria-current", "page");

  await page.goto("./#type-unknown");
  await expect(
    page
      .getByRole("navigation", { name: "案例分类" })
      .getByRole("link", { name: "流程图" })
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator("main article")).toHaveCount(3);
});
