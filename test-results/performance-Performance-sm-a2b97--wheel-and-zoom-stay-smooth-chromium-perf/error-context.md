# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: performance.spec.ts >> Performance smoke >> freeform pan, wheel, and zoom stay smooth
- Location: e2e\performance.spec.ts:384:3

# Error details

```
Error: freeform-ctrl-wheel-zoom p95 frame interval

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 24
Received:    33.29999999999927
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
      - button "Paint Char Color" [ref=e37]:
        - img [ref=e38]
      - generic [ref=e41]:
        - button "Color" [ref=e42]
        - button [ref=e44]:
          - img [ref=e45]
  - generic [ref=e48]:
    - generic [ref=e49]:
      - generic [ref=e52]:
        - generic [ref=e53]: Search Blueprint
        - textbox "Search Blueprint" [ref=e54]:
          - /placeholder: Search characters (e.g. 'copy', 'arrow')...
        - img
      - button "Toggle Sidebar" [ref=e55]:
        - img
        - generic [ref=e56]: Toggle Sidebar
    - list [ref=e62]:
      - listitem [ref=e64]:
        - button "Nerd Icons" [expanded] [ref=e65]:
          - img [ref=e66]
          - generic [ref=e68]: Nerd Icons
          - img [ref=e69]
        - list [ref=e72]:
          - listitem [ref=e74]:
            - button "Seti-UI-Custom" [ref=e75]:
              - img [ref=e76]
              - text: Seti-UI-Custom
          - listitem [ref=e79]:
            - button "Devicons" [ref=e80]:
              - img [ref=e81]
              - text: Devicons
          - listitem [ref=e84]:
            - button "Font-Awesome" [ref=e85]:
              - img [ref=e86]
              - text: Font-Awesome
          - listitem [ref=e89]:
            - button "Font-Awesome-Ext" [ref=e90]:
              - img [ref=e91]
              - text: Font-Awesome-Ext
          - listitem [ref=e94]:
            - button "Material-Design" [ref=e95]:
              - img [ref=e96]
              - text: Material-Design
          - listitem [ref=e99]:
            - button "Weather-Icons" [ref=e100]:
              - img [ref=e101]
              - text: Weather-Icons
          - listitem [ref=e104]:
            - button "Octicons" [ref=e105]:
              - img [ref=e106]
              - text: Octicons
          - listitem [ref=e109]:
            - button "Powerline-Symbols" [ref=e110]:
              - img [ref=e111]
              - text: Powerline-Symbols
          - listitem [ref=e114]:
            - button "Powerline-Extra" [ref=e115]:
              - img [ref=e116]
              - text: Powerline-Extra
          - listitem [ref=e119]:
            - button "IEC-Power" [ref=e120]:
              - img [ref=e121]
              - text: IEC-Power
          - listitem [ref=e124]:
            - button "Font-Logos" [ref=e125]:
              - img [ref=e126]
              - text: Font-Logos
          - listitem [ref=e129]:
            - button "Pomicons" [ref=e130]:
              - img [ref=e131]
              - text: Pomicons
          - listitem [ref=e134]:
            - button "Codicons" [ref=e135]:
              - img [ref=e136]
              - text: Codicons
          - listitem [ref=e139]:
            - button "Progress-Indicators" [ref=e140]:
              - img [ref=e141]
              - text: Progress-Indicators
          - listitem [ref=e144]:
            - button "Heavy-Angle-Brackets" [ref=e145]:
              - img [ref=e146]
              - text: Heavy-Angle-Brackets
      - listitem [ref=e149]:
        - button "Box Drawing" [expanded] [ref=e150]:
          - img [ref=e151]
          - generic [ref=e156]: Box Drawing
          - img [ref=e157]
        - list [ref=e160]:
          - listitem [ref=e162]:
            - button "Box Drawing" [ref=e163]:
              - img [ref=e164]
              - text: Box Drawing
      - listitem [ref=e167]:
        - button "Curated Emoji" [expanded] [ref=e168]:
          - img [ref=e169]
          - generic [ref=e172]: Curated Emoji
          - img [ref=e173]
        - list [ref=e176]:
          - listitem [ref=e178]:
            - button "Smileys & Emotion" [ref=e179]:
              - img [ref=e180]
              - text: Smileys & Emotion
          - listitem [ref=e183]:
            - button "People & Body" [ref=e184]:
              - img [ref=e185]
              - text: People & Body
          - listitem [ref=e188]:
            - button "Component" [ref=e189]:
              - img [ref=e190]
              - text: Component
          - listitem [ref=e193]:
            - button "Animals & Nature" [ref=e194]:
              - img [ref=e195]
              - text: Animals & Nature
          - listitem [ref=e198]:
            - button "Food & Drink" [ref=e199]:
              - img [ref=e200]
              - text: Food & Drink
          - listitem [ref=e203]:
            - button "Travel & Places" [ref=e204]:
              - img [ref=e205]
              - text: Travel & Places
          - listitem [ref=e208]:
            - button "Activities" [ref=e209]:
              - img [ref=e210]
              - text: Activities
          - listitem [ref=e213]:
            - button "Objects" [ref=e214]:
              - img [ref=e215]
              - text: Objects
          - listitem [ref=e218]:
            - button "Symbols" [ref=e219]:
              - img [ref=e220]
              - text: Symbols
          - listitem [ref=e223]:
            - button "Flags" [ref=e224]:
              - img [ref=e225]
              - text: Flags
      - listitem [ref=e228]:
        - button "Unicode Blocks" [ref=e229]:
          - img [ref=e230]
          - generic [ref=e234]: Unicode Blocks
          - img [ref=e235]
    - generic [ref=e239]:
      - generic [ref=e240]:
        - button "Choose File" [ref=e241]
        - button [ref=e242]:
          - img
        - button [ref=e243]:
          - img
        - button [ref=e244]:
          - img
        - button [ref=e245]:
          - img
        - button [ref=e246]:
          - img
        - button [ref=e247]:
          - img
      - button [ref=e248]:
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
      |                                                            ^ Error: freeform-ctrl-wheel-zoom p95 frame interval
  278 |     LIMITS.p95FrameMs
  279 |   );
  280 |   expect(metrics.over50ms, `${name} >50ms frames`).toBe(0);
  281 |   expect(metrics.longTaskCount, `${name} long tasks`).toBeLessThanOrEqual(
  282 |     LIMITS.maxLongTasks
  283 |   );
  284 |   expect(metrics.maxLongTaskMs, `${name} max long task`).toBeLessThanOrEqual(
  285 |     LIMITS.maxLongTaskMs
  286 |   );
  287 | 
  288 |   return metrics;
  289 | };
  290 | 
  291 | const dragFor = async (
  292 |   page: Page,
  293 |   start: { x: number; y: number },
  294 |   delta: { x: number; y: number },
  295 |   options: { button?: "left" | "middle"; durationMs?: number } = {}
  296 | ) => {
  297 |   const button = options.button ?? "left";
  298 |   const durationMs = options.durationMs ?? SCENARIO_MS;
  299 |   const startedAt = Date.now();
  300 |   let step = 0;
  301 | 
  302 |   await page.mouse.move(start.x, start.y);
  303 |   await page.mouse.down({ button });
  304 |   while (Date.now() - startedAt < durationMs) {
  305 |     const t = step / 16;
  306 |     await page.mouse.move(
  307 |       start.x + Math.sin(t) * delta.x,
  308 |       start.y + Math.cos(t * 0.7) * delta.y
  309 |     );
  310 |     step += 1;
  311 |   }
  312 |   await page.mouse.up({ button });
  313 | };
  314 | 
  315 | const wheelFor = async (
  316 |   page: Page,
  317 |   options: { ctrl?: boolean; durationMs?: number } = {}
  318 | ) => {
  319 |   const durationMs = options.durationMs ?? SCENARIO_MS;
  320 |   const startedAt = Date.now();
  321 |   let step = 0;
  322 | 
  323 |   if (options.ctrl) await page.keyboard.down("Control");
  324 |   while (Date.now() - startedAt < durationMs) {
  325 |     await page.mouse.wheel(
  326 |       options.ctrl ? 0 : step % 2 ? 26 : -18,
  327 |       options.ctrl ? (step % 2 ? 80 : -80) : 34
  328 |     );
  329 |     step += 1;
  330 |   }
  331 |   if (options.ctrl) await page.keyboard.up("Control");
  332 | };
  333 | 
  334 | test.describe.serial("Performance smoke", () => {
  335 |   test("startup resource budget", async ({ page }, testInfo) => {
  336 |     await openSeededCanvas(page, "freeform");
  337 | 
  338 |     const summary = await page.evaluate(() => {
  339 |       const resources = performance.getEntriesByType(
  340 |         "resource"
  341 |       ) as PerformanceResourceTiming[];
  342 |       const scripts = resources
  343 |         .filter((entry) => entry.initiatorType === "script")
  344 |         .map((entry) => ({
  345 |           name: entry.name.split("/").pop() ?? entry.name,
  346 |           encodedBodySize: entry.encodedBodySize,
  347 |           transferSize: entry.transferSize,
  348 |         }));
  349 |       const json = resources
  350 |         .filter((entry) => entry.name.includes("/data/"))
  351 |         .map((entry) => ({
  352 |           name: entry.name.split("/").pop() ?? entry.name,
  353 |           encodedBodySize: entry.encodedBodySize,
  354 |           transferSize: entry.transferSize,
  355 |         }));
  356 |       const largestScript = scripts.reduce(
  357 |         (largest, entry) =>
  358 |           entry.encodedBodySize > largest.encodedBodySize ? entry : largest,
  359 |         { name: "", encodedBodySize: 0, transferSize: 0 }
  360 |       );
  361 | 
  362 |       return {
  363 |         domNodes: document.querySelectorAll("*").length,
  364 |         canvasCount: document.querySelectorAll("canvas").length,
  365 |         scriptCount: scripts.length,
  366 |         largestScript,
  367 |         json,
  368 |         localStorageBytes: Object.entries(localStorage).reduce(
  369 |           (sum, [key, value]) => sum + key.length + value.length,
  370 |           0
  371 |         ),
  372 |       };
  373 |     });
  374 | 
  375 |     await testInfo.attach("startup-resources.json", {
  376 |       body: JSON.stringify(summary, null, 2),
  377 |       contentType: "application/json",
```