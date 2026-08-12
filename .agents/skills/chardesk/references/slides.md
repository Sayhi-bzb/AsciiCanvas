# Slides 文件结构

````md
---
chardesk: slides/v1
title: 产品介绍
---

## 首页

```chardesk size=100x27
┌────────────────────┐
│      产品介绍      │
└────────────────────┘
```

## 结尾

```chardesk size=80x24
        [36m谢谢[0m
```
````

- 文件头声明版本与文稿标题。
- 每个 `##` 标题开始一页，紧随其后的 `chardesk` 代码块是页面内容；`size=列数x行数` 声明该页的网格尺寸。
- 页面内容遵循 [`Canvas 文本语法`](./ansi.md)。
- 当前格式为 CharDesk Slides v1；每页必须单独声明尺寸。
