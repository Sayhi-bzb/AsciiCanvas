# Slides 文件结构

````md
---
asciicanvas: slides/v2
title: 产品介绍
---

## 首页

```asciicanvas size=100x27
┌────────────────────┐
│      产品介绍      │
└────────────────────┘
```

## 结尾

```asciicanvas size=80x24
        [36m谢谢[0m
```
````

- 文件头声明版本与文稿标题。
- 每个 `##` 标题开始一页，紧随其后的 `asciicanvas` 代码块是页面内容；`size=列数x行数` 声明该页的网格尺寸。
- 页面内容遵循 [`Canvas 文本语法`](./ansi.md)。
- `slides/v1` 仍可导入；其文件头中的 `size` 应用于所有页面。新文件使用 `slides/v2`。
