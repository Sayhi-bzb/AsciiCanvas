# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: performance.spec.ts >> Performance smoke >> structured selection and node drag stay smooth
- Location: e2e\performance.spec.ts:409:3

# Error details

```
Error: structured-node-drag p95 frame interval

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 24
Received:    50.099999999998545
```

# Page snapshot

```yaml
- main [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - button "Expand canvas sessions" [ref=e7]:
        - img [ref=e8]
        - generic [ref=e11]: Performance Seed
      - generic:
        - generic:
          - button:
            - img
            - generic: Performance Seed
          - button [disabled]:
            - img
    - button "Create new canvas" [ref=e12]:
      - img
  - generic [ref=e13]:
    - main [ref=e14]:
      - generic [ref=e15]:
        - button "Open overview panel" [ref=e17]:
          - img
        - textbox
    - region "Notifications alt+T"
    - navigation [ref=e19]:
      - button "Select" [ref=e21]:
        - img [ref=e22]
      - generic [ref=e24]:
        - button "Box" [ref=e25]:
          - img [ref=e26]
        - button [ref=e28]:
          - img [ref=e29]
      - button "Background" [ref=e32]:
        - img [ref=e33]
      - generic [ref=e36]:
        - button "Color" [ref=e37]
        - button [ref=e39]:
          - img [ref=e40]
  - generic [ref=e43]:
    - generic [ref=e44]:
      - searchbox "Search structured library" [ref=e45]
      - button "Toggle Sidebar" [ref=e46]:
        - img
        - generic [ref=e47]: Toggle Sidebar
    - generic [ref=e49]:
      - tablist "Structured library sections" [ref=e51]:
        - tab "Template" [ref=e52]
        - tab "Components" [selected] [ref=e53]: Components
      - generic [ref=e60]:
        - button "Accordion" [ref=e62]:
          - generic [ref=e65]: Accordion
        - button "Alert" [ref=e68]:
          - generic [ref=e71]: Alert
        - button "Avatar" [ref=e74]:
          - generic [ref=e77]: Avatar
        - button "Badge" [ref=e80]:
          - generic [ref=e83]: Badge
        - button "Bar chart" [ref=e86]:
          - generic [ref=e89]: Bar chart
        - button "Breadcrumb" [ref=e92]:
          - generic [ref=e95]: Breadcrumb
        - button "Button" [ref=e98]:
          - generic [ref=e101]: Button
        - button "Calendar" [ref=e104]:
          - generic [ref=e107]: Calendar
        - button "Card" [ref=e110]:
          - generic [ref=e113]: Card
        - button "Checkbox" [ref=e116]:
          - generic [ref=e119]: Checkbox
        - button "Divider" [ref=e122]:
          - generic [ref=e125]: Divider
        - button "Input" [ref=e128]:
          - generic [ref=e131]: Input
        - button "Line chart" [ref=e134]:
          - generic [ref=e137]: Line chart
        - button "Pagination" [ref=e140]:
          - generic [ref=e143]: Pagination
        - button "Progress" [ref=e146]:
          - generic [ref=e149]: Progress
        - button "Radio" [ref=e152]:
          - generic [ref=e155]: Radio
        - button "Scroll area" [ref=e158]:
          - generic [ref=e161]: Scroll area
        - button "Slider" [ref=e164]:
          - generic [ref=e167]: Slider
        - button "Status" [ref=e170]:
          - generic [ref=e173]: Status
        - button "Switch" [ref=e176]:
          - generic [ref=e179]: Switch
        - button "Table" [ref=e182]:
          - generic [ref=e185]: Table
        - button "Tabs" [ref=e188]:
          - generic [ref=e191]: Tabs
        - button "Textarea" [ref=e194]:
          - generic [ref=e197]: Textarea
    - generic [ref=e200]:
      - generic [ref=e201]:
        - button "Choose File" [ref=e202]
        - button [ref=e203]:
          - img
        - button [ref=e204]:
          - img
        - button [ref=e205]:
          - img
        - button [ref=e206]:
          - img
        - button [ref=e207]:
          - img
        - button [ref=e208]:
          - img
      - button [ref=e209]:
        - img
```

# Test source

```ts
  177 | 
  178 | const openSeededCanvas = async (
  179 |   page: Page,
  180 |   mode: "freeform" | "structured" | "animation"
  181 | ) => {
  182 |   const runtimeErrors: string[] = [];
  183 |   page.on("console", (message) => {
  184 |     if (message.type() === "error") runtimeErrors.push(message.text());
  185 |   });
  186 |   page.on("pageerror", (error) => {
  187 |     runtimeErrors.push(error.message);
  188 |   });
  189 |   await seedCanvas(page, mode);
  190 |   await page.goto("/");
  191 |   await page.waitForSelector("canvas", { timeout: 10_000 }).catch((error) => {
  192 |     throw new Error(
  193 |       [
  194 |         error instanceof Error ? error.message : String(error),
  195 |         ...runtimeErrors.map((message) => `runtime: ${message}`),
  196 |       ].join("\n")
  197 |     );
  198 |   });
  199 |   await page.waitForTimeout(250);
  200 | };
  201 | 
  202 | const installSmoothProbe = async (page: Page) => {
  203 |   await page.evaluate(() => {
  204 |     const state = {
  205 |       frames: [] as number[],
  206 |       longTasks: [] as number[],
  207 |       rafId: 0,
  208 |       observer: null as PerformanceObserver | null,
  209 |     };
  210 |     let last = performance.now();
  211 | 
  212 |     state.observer = new PerformanceObserver((list) => {
  213 |       for (const entry of list.getEntries()) {
  214 |         state.longTasks.push(entry.duration);
  215 |       }
  216 |     });
  217 |     try {
  218 |       state.observer.observe({ entryTypes: ["longtask"] });
  219 |     } catch {
  220 |       state.observer = null;
  221 |     }
  222 | 
  223 |     const tick = (now: number) => {
  224 |       state.frames.push(now - last);
  225 |       last = now;
  226 |       state.rafId = requestAnimationFrame(tick);
  227 |     };
  228 |     state.rafId = requestAnimationFrame(tick);
  229 |     window.__asciiPerf = state;
  230 |   });
  231 | };
  232 | 
  233 | const readSmoothProbe = async (page: Page, name: string): Promise<SmoothMetrics> =>
  234 |   page.evaluate((scenarioName) => {
  235 |     const state = window.__asciiPerf;
  236 |     cancelAnimationFrame(state.rafId);
  237 |     state.observer?.disconnect();
  238 |     const frames = state.frames.slice(1);
  239 |     const sorted = [...frames].sort((a, b) => a - b);
  240 |     const percentile = (p: number) =>
  241 |       sorted.length
  242 |         ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
  243 |         : 0;
  244 |     const longTasks = state.longTasks;
  245 | 
  246 |     return {
  247 |       name: scenarioName,
  248 |       frameCount: frames.length,
  249 |       avgFrameMs:
  250 |         frames.reduce((sum, value) => sum + value, 0) /
  251 |         Math.max(frames.length, 1),
  252 |       p95FrameMs: percentile(0.95),
  253 |       maxFrameMs: Math.max(0, ...frames),
  254 |       over32ms: frames.filter((value) => value > 32).length,
  255 |       over50ms: frames.filter((value) => value > 50).length,
  256 |       longTaskCount: longTasks.length,
  257 |       maxLongTaskMs: Math.max(0, ...longTasks),
  258 |     };
  259 |   }, name);
  260 | 
  261 | const runSmoothScenario = async (
  262 |   page: Page,
  263 |   name: string,
  264 |   action: () => Promise<void>,
  265 |   testInfo: TestInfo
  266 | ) => {
  267 |   await installSmoothProbe(page);
  268 |   await action();
  269 |   await page.waitForTimeout(300);
  270 |   const metrics = await readSmoothProbe(page, name);
  271 |   await testInfo.attach(`${name}.json`, {
  272 |     body: JSON.stringify(metrics, null, 2),
  273 |     contentType: "application/json",
  274 |   });
  275 | 
  276 |   expect(metrics.frameCount, `${name} should capture enough frames`).toBeGreaterThan(30);
> 277 |   expect(metrics.p95FrameMs, `${name} p95 frame interval`).toBeLessThanOrEqual(
      |                                                            ^ Error: structured-node-drag p95 frame interval
  278 |     LIMITS.p95FrameMs
  279 |   );
  280 |   expect(metrics.over50ms, `${name} >50ms frames`).toBeLessThanOrEqual(
  281 |     LIMITS.maxOver50msFrames
  282 |   );
  283 |   return metrics;
  284 | };
  285 | 
  286 | const dragFor = async (
  287 |   page: Page,
  288 |   start: { x: number; y: number },
  289 |   delta: { x: number; y: number },
  290 |   options: { button?: "left" | "middle"; durationMs?: number } = {}
  291 | ) => {
  292 |   const button = options.button ?? "left";
  293 |   const durationMs = options.durationMs ?? SCENARIO_MS;
  294 |   const startedAt = Date.now();
  295 |   let step = 0;
  296 | 
  297 |   await page.mouse.move(start.x, start.y);
  298 |   await page.mouse.down({ button });
  299 |   while (Date.now() - startedAt < durationMs) {
  300 |     const t = step / 16;
  301 |     await page.mouse.move(
  302 |       start.x + Math.sin(t) * delta.x,
  303 |       start.y + Math.cos(t * 0.7) * delta.y
  304 |     );
  305 |     step += 1;
  306 |     await page.waitForTimeout(INPUT_FRAME_MS);
  307 |   }
  308 |   await page.mouse.up({ button });
  309 | };
  310 | 
  311 | const wheelFor = async (
  312 |   page: Page,
  313 |   options: { ctrl?: boolean; durationMs?: number } = {}
  314 | ) => {
  315 |   const durationMs = options.durationMs ?? SCENARIO_MS;
  316 |   const startedAt = Date.now();
  317 |   let step = 0;
  318 | 
  319 |   if (options.ctrl) await page.keyboard.down("Control");
  320 |   while (Date.now() - startedAt < durationMs) {
  321 |     await page.mouse.wheel(
  322 |       options.ctrl ? 0 : step % 2 ? 26 : -18,
  323 |       options.ctrl ? (step % 2 ? 80 : -80) : 34
  324 |     );
  325 |     step += 1;
  326 |     await page.waitForTimeout(INPUT_FRAME_MS);
  327 |   }
  328 |   if (options.ctrl) await page.keyboard.up("Control");
  329 | };
  330 | 
  331 | test.describe.serial("Performance smoke", () => {
  332 |   test("startup resource budget", async ({ page }, testInfo) => {
  333 |     await openSeededCanvas(page, "freeform");
  334 | 
  335 |     const summary = await page.evaluate(() => {
  336 |       const resources = performance.getEntriesByType(
  337 |         "resource"
  338 |       ) as PerformanceResourceTiming[];
  339 |       const scripts = resources
  340 |         .filter((entry) => entry.initiatorType === "script")
  341 |         .map((entry) => ({
  342 |           name: entry.name.split("/").pop() ?? entry.name,
  343 |           encodedBodySize: entry.encodedBodySize,
  344 |           transferSize: entry.transferSize,
  345 |         }));
  346 |       const json = resources
  347 |         .filter((entry) => entry.name.includes("/data/"))
  348 |         .map((entry) => ({
  349 |           name: entry.name.split("/").pop() ?? entry.name,
  350 |           encodedBodySize: entry.encodedBodySize,
  351 |           transferSize: entry.transferSize,
  352 |         }));
  353 |       const largestScript = scripts.reduce(
  354 |         (largest, entry) =>
  355 |           entry.encodedBodySize > largest.encodedBodySize ? entry : largest,
  356 |         { name: "", encodedBodySize: 0, transferSize: 0 }
  357 |       );
  358 | 
  359 |       return {
  360 |         domNodes: document.querySelectorAll("*").length,
  361 |         canvasCount: document.querySelectorAll("canvas").length,
  362 |         scriptCount: scripts.length,
  363 |         largestScript,
  364 |         json,
  365 |         localStorageBytes: Object.entries(localStorage).reduce(
  366 |           (sum, [key, value]) => sum + key.length + value.length,
  367 |           0
  368 |         ),
  369 |       };
  370 |     });
  371 | 
  372 |     await testInfo.attach("startup-resources.json", {
  373 |       body: JSON.stringify(summary, null, 2),
  374 |       contentType: "application/json",
  375 |     });
  376 | 
  377 |     expect(summary.canvasCount).toBeGreaterThanOrEqual(3);
```