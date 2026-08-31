import { expect, test } from "@playwright/test";

test.describe("WebMCP", () => {
  test("mounts only Blackboard host surfaces on desktop and phone", async ({ page }) => {
    const assertBlackboardChrome = async () => {
      await expect.poll(() => page.locator("html").getAttribute("data-webmcp-status"))
        .toBe("ready");
      await expect(page.getByRole("button", { name: "Toggle inspector" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Toggle sidebar" })).toHaveCount(0);
      await expect(page.locator('[data-slot="sidebar-container"]')).toHaveCount(0);
      await expect(page.locator('[data-toolbar-item="shape-group"]')).toHaveCount(0);
      await expect(page.locator('[data-toolbar-item="bg"]')).toHaveCount(0);
      await expect(page.locator('[data-toolbar-item="fill"]')).toHaveCount(0);
      await expect(page.locator('[data-toolbar-item="pan"]')).toHaveCount(1);
      await expect(page.locator('[data-toolbar-item="select"]')).toHaveCount(1);
    };

    await page.goto("/blackboard?webmcp=polyfill");
    await assertBlackboardChrome();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await assertBlackboardChrome();
  });

  test("discovers and executes Blackboard tools through the development polyfill", async ({ page }) => {
    await page.goto("/blackboard?webmcp=polyfill");

    await expect.poll(() => page.locator("html").getAttribute("data-webmcp-status"))
      .toBe("ready");
    await expect(page.locator("html")).toHaveAttribute("data-webmcp-provider", "polyfill");
    await expect.poll(async () => page.evaluate(async () => {
      const context = (document as Document & {
        modelContext?: {
          getTools(): Promise<Array<{ name: string }>>;
          executeTool?: (tool: { name: string }, input: string) => Promise<unknown>;
        };
      }).modelContext;
      if (!context?.executeTool) return false;
      const listFiles = (await context.getTools()).find(({ name }) => name === "list_files");
      if (!listFiles) return false;
      const output = await context.executeTool(listFiles, "{}");
      const parsed = typeof output === "string" ? JSON.parse(output) : output;
      return typeof parsed === "object" && parsed !== null && !("ok" in parsed && parsed.ok === false);
    })).toBe(true);

    const result = await page.evaluate(async () => {
      const context = (document as Document & {
        modelContext?: {
          getTools(): Promise<Array<{ name: string }>>;
          executeTool?: (tool: { name: string }, input: string) => Promise<unknown>;
        };
      }).modelContext;
      if (!context?.executeTool) throw new Error("WebMCP executeTool is unavailable.");
      const tools = await context.getTools();
      const listFiles = tools.find(({ name }) => name === "list_files");
      if (!listFiles) throw new Error("list_files was not registered.");
      const output = await context.executeTool(listFiles, "{}");
      return {
        names: tools.map(({ name }) => name).sort(),
        output: typeof output === "string" ? JSON.parse(output) : output,
      };
    });

    expect(result.names).toEqual([
      "apply_patch",
      "check",
      "create_workspace",
      "delete_file",
      "list_files",
      "list_workspaces",
      "read_file",
      "write_file",
    ]);
    expect(result.output).toMatchObject({
      workspaceId: expect.any(String),
      revision: 1,
      files: ["blackboard.yaml", "panels/welcome.panel"],
    });
  });

  test("creates and edits a Blackboard workspace from the site root", async ({ page }) => {
    await page.goto("/?webmcp=polyfill");

    await expect.poll(() => page.locator("html").getAttribute("data-webmcp-status"))
      .toBe("ready");

    const result = await page.evaluate(async () => {
      const context = (document as Document & {
        modelContext?: {
          getTools(): Promise<Array<{ name: string }>>;
          executeTool?: (tool: { name: string }, input: string) => Promise<unknown>;
        };
      }).modelContext;
      if (!context?.executeTool) throw new Error("WebMCP executeTool is unavailable.");
      const tools = new Map((await context.getTools()).map((tool) => [tool.name, tool]));
      const execute = async (name: string, input: Record<string, unknown>) => {
        const tool = tools.get(name);
        if (!tool) throw new Error(`${name} was not registered.`);
        const output = await context.executeTool!(tool, JSON.stringify(input));
        return typeof output === "string" ? JSON.parse(output) : output;
      };

      const created = await execute("create_workspace", { title: "Root Agent" });
      const workspaceId = created.workspaceId as string;
      await execute("write_file", {
        workspaceId,
        path: "panels/root.panel",
        content: "Edited from chardesk.com/",
      });
      return {
        created,
        listed: await execute("list_workspaces", {}),
        read: await execute("read_file", { workspaceId, path: "panels/root.panel" }),
        checked: await execute("check", { workspaceId }),
      };
    });

    expect(result.created).toMatchObject({ title: "Root Agent", revision: 1 });
    expect(result.listed.workspaces).toContainEqual(
      expect.objectContaining({ id: result.created.workspaceId, title: "Root Agent" }),
    );
    expect(result.read).toMatchObject({
      workspaceId: result.created.workspaceId,
      content: "Edited from chardesk.com/",
    });
    expect(result.checked).toMatchObject({ ok: true, workspaceId: result.created.workspaceId });
  });
});
