# Web TUI 线索白板

这里不是最终产品规格，而是 Web TUI Engine 的研究入口。我们先登记上游产品、基础设施和已有内部能力，再通过调研与实验判断哪些可以直接消费、哪些只适合作为蓝图，以及哪些缺口值得自行创新。

## 工作方法

```text
发现线索 → 调研事实 → 验证关键假设 → 更新架构地图 → 收敛产品形态
```

状态统一为：

- `待调研`：只有线索，尚无可靠判断。
- `调研中`：正在收集事实或等待实验。
- `可直接复用`：已有稳定公共边界，可以作为依赖消费。
- `仅作蓝图`：产品或架构值得参考，但不能直接成为依赖。
- `不采用`：已确认与目标或约束冲突。

## 当前产品假设

这些是当前探索边界，不是不可修改的最终形态：

- 可嵌入普通网页的 React/TypeScript TUI，而不是 shell 或终端模拟器。
- Everything is Cell：应用、布局、文本、滚动和事件只使用整数 column/row。
- Cell 尺寸固定，不拉伸填满容器；剩余像素成为 gutter。
- px 只存在于浏览器渲染边界，用于绘制 Cell 和把 pointer 坐标转换回 GridPoint。
- 视觉 Cell Scene 与 Web Semantic Tree 分离，但来自同一 Widget Tree。

## 线索地图

| 线索 | 类别 | 当前价值 | 状态 | 调研卡片 |
| --- | --- | --- | --- | --- |
| CharDesk | 内部基础 | Unicode/Cell、Canvas rendering、Grid interaction 和 Web input 已有基础 | 可直接复用 | [CharDesk](research/chardesk.md) |
| OpenTUI | 完整 TUI framework | Widget Runtime、布局、Buffer、Scroll 和事件系统蓝图 | 仅作蓝图 | [OpenTUI](research/opentui.md) |
| Pretext | Text layout engine | `prepare → layout`、range API 和语料验证方法 | 仅作蓝图 | [Pretext](research/pretext.md) |
| Yoga | Layout engine | 浏览器可用的 Flexbox 引擎；可能承担整数 Cell Layout | 调研中 | [Yoga](research/yoga.md) |

## 架构蓝图

| 架构层 | 可利用线索 | 当前判断 | 未解决问题 |
| --- | --- | --- | --- |
| React Widget API | OpenTUI | 对齐其 Renderable/组件形态，不依赖其 React package | Browser renderer 的宿主边界 |
| Cell Layout | Yoga、OpenTUI | 优先验证官方 `yoga-layout` | rounding、intrinsic text measure、生命周期 |
| Unicode/Text | `@chardesk/protocol`、Pretext | CharDesk 作为 Cell width 权威；借鉴 Pretext 的缓存与 range | wrap、truncate、ellipsis |
| Input/IME | CharDesk Canvas Editor | 提取已有 managed textarea 经验 | 多 Input、selection、移动端软键盘 |
| Focus/Keymap | CharDesk、OpenTUI | 先比较现有 shortcut dispatcher 与 OpenTUI 行为 | Tab 顺序、事件冒泡、焦点恢复 |
| Scroll/Clip/Hit | OpenTUI、CharDesk Viewer | 复用 GridPoint 基础，对齐 OpenTUI 行为 | 嵌套 viewport、clip stack、z-order |
| Cell Scene/Buffer | `@chardesk/rendering`、OpenTUI | 复用 CharDesk 类型与 run 聚合 | dirty regions、widget ownership |
| Browser Renderer | `@chardesk/rendering` | Canvas 是已有起点，DOM/run renderer 尚待判断 | 性能、selection、gutter |
| Accessibility | CharDesk host UI | 建立独立 Semantic Tree | Widget 到 ARIA 的稳定映射 |

## 核心技术难题

1. Input、cursor、selection 和 IME。
2. 确定性的 Cell Widget Layout。
3. Unicode grapheme、宽字符、换行和截断。
4. Cell Scene 与 Web semantics/accessibility 的对应。
5. 嵌套 scroll、clip、overlay 和 hit testing。

DOM-per-cell 是需要避免的实现陷阱，不是基本要求。逻辑模型可以寻址每个 Cell，renderer 应按 row、styled run 或 interactive widget 聚合输出。

## 下一批线索

| 线索 | 希望回答的问题 | 状态 |
| --- | --- | --- |
| xterm.js | 浏览器 Cell renderer、IME 和 accessibility 有哪些可独立复用能力？ | 待调研 |
| Ink | React reconciler 与组件生命周期有哪些可迁移设计？ | 待调研 |
| Ratatui | Buffer、Widget、Rect 和测试模型如何保持简单？ | 待调研 |
| Textual | Focus、事件、CSS-like layout 和组件语义如何组织？ | 待调研 |
| CodeMirror | 浏览器输入、IME、selection 和虚拟化有哪些可复用边界？ | 待调研 |

## 更新规则

- README 只保存地图、状态、当前判断和调研入口。
- 每张卡片只回答一个上游线索能否以及如何帮助 Web TUI Engine。
- 事实链接权威来源；推断明确标为“当前判断”。
- 新能力优先升级其所属 package，再由 `exp/` 消费；不要在实验区复制并长期维护第二套实现。
- 只有实验验证后，候选才能从 `调研中` 变为 `可直接复用` 或 `不采用`。
