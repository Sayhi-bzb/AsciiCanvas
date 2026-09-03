import { expect, test } from "@playwright/test";

test.describe("WebMCP", () => {
  test.describe.configure({ mode: "serial" });

  test("copies a Blackboard range through read-only host controls", async ({ context, page }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/blackboard?webmcp=polyfill");
    await expect(page).toHaveURL(/workspace=/);
    const surface = page.getByTestId("canvas-editor-surface");

    await expect.poll(async () => {
      await surface.click({ position: { x: 320, y: 240 } });
      await page.keyboard.press("Meta+a");
      await surface.click({ button: "right", position: { x: 320, y: 240 } });
      const snapshot = page.getByRole("menuitem", { name: /Snapshot \(PNG\)/ });
      const ready = await snapshot.isEnabled().catch(() => false);
      await page.keyboard.press("Escape");
      return ready;
    }).toBe(true);

    await surface.click({ position: { x: 320, y: 240 } });
    await page.keyboard.press("Meta+a");
    await page.evaluate(() => navigator.clipboard.writeText("marker"));
    await page.keyboard.press("Meta+c");
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain("Blackboard");

    await surface.click({ button: "right", position: { x: 320, y: 240 } });
    await expect(page.getByRole("menuitem", { name: "Copy as Text" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Copy as ANSI" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Snapshot \(PNG\)/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Paste/ })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
  });

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

  test("discovers and executes CharDesk tools through the development polyfill", async ({ page }) => {
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
      const tools = await context.getTools();
      const readMaterials = tools.find(
        ({ name }) => name === "chardesk_read_materials",
      );
      const listWorkspaces = tools.find(
        ({ name }) => name === "chardesk_blackboard_list_workspaces",
      );
      const listFiles = tools.find(({ name }) => name === "chardesk_blackboard_list_files");
      if (!readMaterials || !listWorkspaces || !listFiles) return false;
      const materialOutput = await context.executeTool(readMaterials, "{}");
      const materialResult = typeof materialOutput === "string"
        ? JSON.parse(materialOutput)
        : materialOutput;
      if (
        materialResult?.format !== "text/markdown" ||
        !materialResult?.content?.includes("# Materials on the desk")
      ) return false;
      const listed = await context.executeTool(listWorkspaces, "{}");
      const parsed = typeof listed === "string" ? JSON.parse(listed) : listed;
      const workspaceId = parsed?.workspaces?.[0]?.id;
      if (typeof workspaceId !== "string") return false;
      const output = await context.executeTool(listFiles, JSON.stringify({ workspaceId }));
      const files = typeof output === "string" ? JSON.parse(output) : output;
      return Array.isArray(files?.files);
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
      const listWorkspaces = tools.find(
        ({ name }) => name === "chardesk_blackboard_list_workspaces",
      );
      const listFiles = tools.find(({ name }) => name === "chardesk_blackboard_list_files");
      if (!listWorkspaces || !listFiles) throw new Error("Blackboard tools were not registered.");
      const listed = await context.executeTool(listWorkspaces, "{}");
      const workspaces = typeof listed === "string" ? JSON.parse(listed) : listed;
      const workspaceId = workspaces.workspaces[0].id;
      const output = await context.executeTool(listFiles, JSON.stringify({ workspaceId }));
      return {
        names: tools.map(({ name }) => name).sort(),
        output: typeof output === "string" ? JSON.parse(output) : output,
      };
    });

    expect(result.names).toEqual([
      "chardesk_blackboard_apply_patch",
      "chardesk_blackboard_check",
      "chardesk_blackboard_create_workspace",
      "chardesk_blackboard_delete_file",
      "chardesk_blackboard_list_files",
      "chardesk_blackboard_list_workspaces",
      "chardesk_blackboard_read_file",
      "chardesk_blackboard_write_file",
      "chardesk_read_materials",
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

      const created = await execute("chardesk_blackboard_create_workspace", {
        title: "Root Agent",
      });
      const workspaceId = created.workspaceId as string;
      await execute("chardesk_blackboard_write_file", {
        workspaceId,
        path: "panels/root.panel",
        content: "Edited from chardesk.com/",
      });
      return {
        created,
        listed: await execute("chardesk_blackboard_list_workspaces", {}),
        read: await execute("chardesk_blackboard_read_file", {
          workspaceId,
          path: "panels/root.panel",
        }),
        checked: await execute("chardesk_blackboard_check", { workspaceId }),
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

  test("elects one origin gateway and transfers ownership after its tab closes", async ({
    context,
    page,
  }) => {
    await page.goto("/?webmcp=polyfill");
    await expect(page.locator("html")).toHaveAttribute("data-webmcp-role", "leader");
    await expect(page.locator("html")).toHaveAttribute("data-webmcp-status", "ready");

    const standby = await context.newPage();
    await standby.goto("/blackboard?webmcp=polyfill");
    await expect(standby.locator("html")).toHaveAttribute("data-webmcp-role", "standby");
    await expect.poll(() => standby.evaluate(async () => {
      const modelContext = (document as Document & {
        modelContext?: { getTools(): Promise<unknown[]> };
      }).modelContext;
      return modelContext ? (await modelContext.getTools()).length : -1;
    })).toBe(0);

    await page.close();
    await expect(standby.locator("html")).toHaveAttribute("data-webmcp-role", "leader");
    await expect(standby.locator("html")).toHaveAttribute("data-webmcp-status", "ready");
    await expect.poll(() => standby.evaluate(async () => {
      const modelContext = (document as Document & {
        modelContext?: { getTools(): Promise<unknown[]> };
      }).modelContext;
      return modelContext ? (await modelContext.getTools()).length : -1;
    })).toBe(9);
  });
});
