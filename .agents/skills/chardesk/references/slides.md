# Slides 文件结构

````md
---
chardesk: document/v1
mode: slide
title: 产品介绍
---

## 首页

```chardesk
┌────────────────────┐
│      产品介绍      │
└────────────────────┘
```

## 结尾

```chardesk size=80x24
        [36m谢谢[0m
```
````

- 文件头使用 `chardesk: document/v1`、`mode: slide` 和可选标题。
- 每个 `##` 标题开始一页，紧随其后的代码块是页面内容。
- `chardesk` 表示已编译 Canvas 文本；`chargraph` 编译 Markdown、Mermaid、数据、数学和 Block Layout。字面文本用 `text`，终端 ANSI 用 `ansi`。
- 省略 `size` 时使用默认画幅 `100x27`；自定义页面可用 `size=列数x行数` 覆盖。
- `chardesk` 页面遵循 [`Canvas 文本语法`](./ansi.md)；`chargraph` 页面遵循 [`CharGraph`](./chargraph.md)。
- `.chardesk` 是正式文件入口；旧 `.slides.md` 与每页显式声明尺寸的文件仅作为兼容输入。
