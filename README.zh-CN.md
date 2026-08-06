[English](./README.md) | [简体中文]

# ASCII Canvas

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/Framework-React_19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Collaboration](https://img.shields.io/badge/Sync-Yjs_CRDT-orange?logo=distributed-systems)](https://yjs.dev/)
[![Deploy](https://img.shields.io/badge/Demo-Live_Preview-22c55e?logo=cloudflare-pages)](https://ascii-canvas.pages.dev/)
[![npm: protocol](https://img.shields.io/npm/v/%40ascii-canvas%2Fprotocol?label=%40ascii-canvas%2Fprotocol)](https://www.npmjs.com/package/@ascii-canvas/protocol)
[![npm: fonts](https://img.shields.io/npm/v/%40ascii-canvas%2Ffonts?label=%40ascii-canvas%2Ffonts)](https://www.npmjs.com/package/@ascii-canvas/fonts)

> **一个面向自由绘制与结构化 ASCII UI 编排的 Unicode 网格编辑器。**

<div align="center">
  <img src="public/demo.gif" alt="ASCII Canvas 演示" width="100%" style="border-radius: 6px; border: 1px solid #333; margin: 5px;">
</div>

<br />

<p align="center">
  <img src="public/Cover.png" alt="ASCII Canvas Cover" width="100%" style="border-radius: 8px; border: 1px solid #333; box-shadow: 0 8px 30px rgba(0,0,0,0.12);">
</p>

<p align="center">
  <a href="https://ascii-canvas.pages.dev/">
    <img src="https://img.shields.io/badge/在线体验_Demo-点击这里-22c55e?style=for-the-badge&logo=rocket" height="40">
  </a>
</p>

---

## 核心特性

**ASCII Canvas** 渲染的是可编辑的 Unicode 网格，而不是对模型不透明的像素图。它既能给人直接阅读，也能保留适合 LLM 理解的文本结构。

目前支持两种会话模式：

- **Freeform**：无限 ASCII 画布，适合草图、图表、终端风格界面和自由绘制。
- **Structured**：语义化结构画布，文本、背景、盒子、分割盒与线条保持为可编辑节点。

### 1. 结构化画布

- **结构化节点**：使用 `text`、`bg`、`box`、`splitBox`、`line` 组合场景，而不是把内容压成一整块纯文本。
- **Components 标签页**：拖拽可复用 UI 分子，例如 button、badge、input、card、table、chart、progress、calendar、scroll area。
- **Templates 标签页**：插入完整场景示例，例如 Safari、File tree、Timeline、Snippet、Terminal。
- **背景层语义**：`bg` 节点可以作为文字和边框下方的真实背景层，也可以在上层遮挡内容。
- **分割布局**：`splitBox` 支持可调整区域，适合面板、卡片、终端窗口和复合 UI 草图。

### 2. 结构化编辑

- **直接操作**：可选择一个或多个结构化节点并整体移动，box、bg、splitBox、line 支持 handle 调整。
- **文本编辑**：双击结构化 text 进入原位编辑，点击其他位置退出编辑。
- **选区格式化**：toolbar 可以作用在选中的文本片段，而不只是整段 text 节点。
- **形状样式**：box、splitBox、line 的字符颜色可以独立控制；`bg` 的背景填充单独控制。
- **表面与结构复制**：Structured 模式内复制保留结构数据，也可以把选中结构表面粘贴到 Freeform。

### 3. 自由绘制

- **多层渲染**：背景层、草稿层、UI 层分离，保证交互响应。
- **网格感知 Unicode**：CJK、Emoji、Nerd Font、PUA 图标和 Box Drawing 字符按网格处理。
- **智能文本流**：换行继承缩进，Tab 按两个网格单位推进。
- **字符库**：右侧栏浏览 Unicode、Nerd Font、Emoji、Box Drawing 字符。
- **精确选区**：拖拽矩形区域、`Shift + Click` 锚点选区，并可用输入字符填充选区。

### 4. 剪贴板、ANSI 与协议

- **右键菜单**：复制、ANSI 复制、剪切、粘贴和删除。
- **ANSI 导入导出**：支持标准 ESC ANSI，也支持 `[38;2;190;24;93m...` 这类 ANSI-like 文本，解释规则见 [AsciiCanvas Text Protocol v1](packages/protocol/spec/v1.md)。
- **可移植渲染**：使用 [`@ascii-canvas/fonts`](packages/fonts/README.md) 获取默认 renderer font profile 与自托管字形资产。
- **终端样式解析**：支持 8 色、亮色 16 色、256 色、truecolor SGR，以及 bold、italic、underline、strikethrough 等属性。
- **应用文档格式**：JSON protocol v1 覆盖 Freeform 与 Structured 会话，用于应用导入导出；它与公开的 Text Protocol npm 包相互独立。

---

## 集成 AsciiCanvas 输出

其他应用如需兼容 AsciiCanvas 的 Unicode 与 ANSI 布局，但不需要嵌入编辑器，可以使用 [`@ascii-canvas/protocol`](https://www.npmjs.com/package/@ascii-canvas/protocol)：

```bash
npm install @ascii-canvas/protocol
```

```ts
import { parseAsciiCanvasText } from "@ascii-canvas/protocol";

const surface = parseAsciiCanvasText(
  "[38;2;255;0;0m+---+[0m\n| 界 |"
);

for (const cell of surface.cells) {
  // 在 cell.x/cell.y 绘制 cell.text；cell.width 为 1 或 2 个网格列。
}
```

解析后的 cells 与渲染技术无关，可以用于 Canvas、HTML、SVG、终端或其他表面。渲染器负责继承颜色、解析 `inverse`、过滤链接以及实际绘制。

如需 AsciiCanvas 默认字形覆盖，可以额外安装 [`@ascii-canvas/fonts`](https://www.npmjs.com/package/@ascii-canvas/fonts)：

```bash
npm install @ascii-canvas/fonts
```

```ts
import "@ascii-canvas/fonts/fonts.css";
import { ASCII_CANVAS_FONT_PROFILE } from "@ascii-canvas/fonts";

await document.fonts.ready;
context.font = `16px ${ASCII_CANVAS_FONT_PROFILE.families.text}`;
```

这两个包不包含 React 编辑器、现成 renderer 或应用 JSON 文档格式。详细规则见 [Text Protocol v1 规范](packages/protocol/spec/v1.md)、[规范 fixtures](packages/protocol/fixtures/v1.json)、[protocol 包说明](packages/protocol/README.md)和[字体包说明](packages/fonts/README.md)。

---

## 作品展示

<div align="center">
  <img src="public/Case/Case.webp" width="100%" style="border-radius: 6px; border: 1px solid #333; margin: 5px;" />
</div>

---

## 技术栈

- **前端框架**：React 19, TypeScript, Vite 7
- **状态管理**：Zustand 5，按 slice 拆分 store
- **样式系统**：Tailwind CSS 4, Radix UI, shadcn/ui 风格基础组件
- **渲染**：多层 Canvas 2D 渲染，带宽字符网格度量
- **字体路由**：[自托管资源与默认 renderer font profile](packages/fonts/README.md)
- **字符目录**：精选字符包与懒加载 Unicode 浏览器
- **同步引擎**：Yjs / Y-IndexedDB
- **手势交互**：@use-gesture/react
- **终端文本**：SGR 前景/背景、文本属性，以及 ANSI/ANSI-like 导入导出

---

## 快速开始

### 安装

```bash
git clone https://github.com/Sayhi-bzb/ascii-canvas.git
cd ascii-canvas
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build
```

---

## 快捷键与工作流

| 操作 | 快捷键 / 手势 | 说明 |
| :-- | :-- | :-- |
| Freeform 选区 | `拖拽` | 选择矩形网格区域 |
| 锚点选区 | `Shift + 点击` | 从锚点到当前位置创建选区 |
| 填充选区 | `输入字符` | 用输入字符填充当前选区 |
| 智能换行 | `Enter` | 换行并继承缩进 |
| 铺设空格 | `Tab` | 光标向右移动 2 个网格单位 |
| 上下文菜单 | `右键点击` | 复制、ANSI 复制、剪切、粘贴、删除 |
| 结构化文本编辑 | `双击` text | 进入结构化文本原位编辑 |
| 结构化插入 | 从侧栏拖拽 | 将 component 或 template 放入结构化画布 |

粘贴支持纯文本、应用内富剪贴板数据，以及 ANSI/ANSI-like 终端样式文本。

---

## 路线图

- [x] 多层 Canvas 渲染引擎
- [x] 基于 Yjs 的实时协作
- [x] 智能缩进与 Tab 系统
- [x] 右键菜单与 ANSI 剪贴板
- [x] 结构化画布：可编辑 text、bg、box、splitBox、line
- [x] 结构化 Components 与 Templates 模板库
- [x] 面向 Freeform、Structured 的 JSON protocol v1
- [ ] **NES (Next Edit Suggestion)**：基于布局模式的字符预测
- [ ] **AI Chat 集成**：通过自然语言生成画布组件
- [ ] 完整 ANSI terminal sequence workspace 与 SVG 导出

---

## 许可证

本项目基于 **MIT 许可证** 开源。详情请参阅 [LICENSE](LICENSE) 文件。
