# Yoga：能否承担 Browser Cell Layout？

[返回线索白板](../README.md)

## 研究问题

Meta Yoga 的官方浏览器 package 能否直接负责 Web TUI Widget Tree 的整数 Cell Flexbox layout？

## 产品形态

Yoga 是跨平台 Flexbox layout engine。官方 `yoga-layout` package 提供 TypeScript 类型以及浏览器可加载的 WebAssembly/ASM.js 构建；OpenTUI 使用 Yoga 计算 terminal cell layout。

## 可利用优势

- 成熟的 flex direction、grow/shrink、basis、min/max、padding、gap、alignment、absolute positioning 和 overflow 规则。
- 与 renderer 解耦，输入和输出都是 geometry，适合 Cell Scene pipeline。
- point scale factor 可以控制整数 rounding；OpenTUI 已验证 `1` 对 terminal cell 的适配。
- 官方浏览器构建避免依赖 OpenTUI 的 Zig/FFI wrapper。
- 直接使用成熟布局引擎可减少自定义 Row/Column 算法及其长期边界维护。

## 不足与风险

- Yoga 内部仍允许 percentage 和 flex 产生 fraction，需要验证最终 rounding 是否完全符合我们的 Cell 不变量。
- Text intrinsic measurement、border glyph 占位和 ScrollArea content size 仍需由 Widget Runtime 提供 measure callback。
- WebAssembly 初始化是异步边界，需要决定 engine root 的加载生命周期。
- Yoga 实现 Flexbox，不负责 Grid text wrapping、focus、events、rendering 或 accessibility。

## 当前判断

状态：`调研中`

Yoga 是目前最有价值的直接上游候选，但在浏览器实验通过前不标记为采用。验证时直接使用 Meta 官方 `yoga-layout`，不使用 OpenTUI 的 native wrapper。

## 待验证

- `pointScaleFactor = 1` 下，奇数剩余空间、多层 percentage 和 grow/shrink 是否得到稳定整数矩形。
- 自定义 text measure callback 能否只使用 `@chardesk/protocol` 的 Cell width。
- Layout tree 更新、dirty propagation、node dispose 和 React lifecycle 是否容易封装。
- 浏览器 bundle、WASM 初始化和测试环境成本是否可接受。

## 权威来源

- [Yoga](https://www.yogalayout.dev/)
- [Yoga repository](https://github.com/facebook/yoga)
- [Yoga JavaScript release notes](https://github.com/facebook/yoga/releases)
- [OpenTUI Cell rounding](https://opentui.com/docs/core-concepts/layout/#cell-rounding)
