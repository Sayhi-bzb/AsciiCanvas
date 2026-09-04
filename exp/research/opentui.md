# OpenTUI：能否成为 Web TUI Engine 的 Base？

[返回线索白板](../README.md)

## 研究问题

OpenTUI 是否可以直接作为浏览器 Web TUI Engine 的运行时基础？

## 产品形态

OpenTUI 是 Zig 原生 TUI Core，提供 TypeScript imperative API、React/Solid reconciler 和 terminal renderer。它的成熟形态包括 Renderable Tree、Yoga layout、Cell Buffer、Input/Textarea、Select、ScrollBox、focus、mouse routing、selection、clipping、z-index 和 viewport culling。

## 可利用优势

- Widget/Renderable retained tree 是完整的 TUI Runtime 蓝图。
- Yoga 使用 point scale factor `1`，在 Flexbox 分配后输出整数 terminal cell，并保持相邻元素无 gap/overlap。
- OptimizedBuffer、current/next frame、changed-cell diff 展示了清晰的 Cell rendering pipeline。
- Hit Grid、事件冒泡、capture、clip 和 z-index 已形成一致行为。
- ScrollBox 已覆盖嵌套内容、scrollbar、sticky scroll、culling 和 `scrollChildIntoView()`。
- React JSX 到 Renderable 的映射可作为我们设计 Widget API 和 lifecycle 的参考。

## 不足与风险

- `@opentui/core` 依赖 Zig native library、Bun/Node FFI 和 terminal runtime，没有浏览器支持。
- `@opentui/react` 的 `createRoot()` 直接接受 `CliRenderer`，没有公开 backend-neutral renderer interface。
- OpenTUI Yoga wrapper 同样调用 native FFI，不能独立用于浏览器。
- Input/Textarea 消费 terminal keyboard/paste，不解决 Web composition、IME、移动端软键盘和原生输入语义。
- Terminal 没有与 Widget Tree 对应的 ARIA Semantic Tree。
- Fork 或新增 Browser Backend 需要拆分 Core、React host、Yoga、input 和 buffer，长期同步成本很高。

## 当前判断

状态：`仅作蓝图`

不直接依赖 `@opentui/core` 或 `@opentui/react`，也不 fork。以 OpenTUI 作为 Widget Runtime、layout、scroll、interaction 和 buffer behavior 的参考；对其底层依赖逐个寻找浏览器原生上游，例如直接验证官方 Yoga。

## 待验证

- 哪些 OpenTUI Widget 行为应成为我们的兼容基准，哪些属于 terminal 限制。
- 是否需要与 OpenTUI 相似的自定义 React reconciler，还是普通 React component/context 足够。
- Cell Buffer、Hit Grid 和 ScrollBox 的最小 Web 版本应包含哪些不变量。

## 权威来源

- [OpenTUI repository](https://github.com/anomalyco/opentui)
- [Runtime and platform support](https://opentui.com/docs/getting-started/runtime-support/)
- [React bindings](https://opentui.com/docs/bindings/react/)
- [Layout](https://opentui.com/docs/core-concepts/layout/)
- [Interaction, focus, and selection](https://opentui.com/docs/core-concepts/interaction/)
- [Buffer API](https://opentui.com/docs/reference/buffer-api/)
- [ScrollBox](https://opentui.com/docs/components/scrollbox/)
