# Slides 文件结构

````md
---
asciicanvas: slides/v1
size: 100x27
title: 产品介绍
---

## 首页

```asciicanvas
┌────────────────────┐
│      产品介绍      │
└────────────────────┘
```

## 结尾

```asciicanvas
        [36m谢谢[0m
```
````

- 文件头声明版本、所有页面共用的网格尺寸与文稿标题。
- 每个 `##` 标题开始一页，紧随其后的 `asciicanvas` 代码块是页面内容。
- 页面内容遵循 [`Canvas 文本语法`](./ansi.md)。
