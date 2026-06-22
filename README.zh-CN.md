[English](./README.md) | [简体中文]

# ASCII Canvas

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/Framework-React_18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Collaboration](https://img.shields.io/badge/Sync-Yjs_CRDT-orange?logo=distributed-systems)](https://yjs.dev/)
[![Deploy](https://img.shields.io/badge/Demo-Live_Preview-22c55e?logo=cloudflare-pages)](https://ascii-canvas.pages.dev/)

> **"大模型时代的原生视觉接口：一个支持 CJK、Nerd Fonts 与全色域的无限 ASCII 画布，旨在成为人类与 AI 的共享白板。"**


<div align="center">
  <img src="public/demo.gif" alt="ASCII Canvas 演示" width="100%" style="border-radius: 6px; border: 1px solid #333; margin: 5px;">
</div>
<br />

<p align="center">
  <img src="public/Cover.png" alt="ASCII Canvas Cover" width="100%" style="border-radius: 8px; border: 1px solid #333; box-shadow: 0 8px 30px rgba(0,0,0,0.12);">
</p>

<p align="center">
  <a href="https://ascii-canvas.pages.dev/">
    <img src="https://img.shields.io/badge/✨_在线体验_Demo-点击这里-22c55e?style=for-the-badge&logo=rocket" height="40">
  </a>
</p>

---

## 🛠 核心特性

**ASCII Canvas** 是一个高性能、可协作的 ASCII 艺术创作引擎。不同于输出像素（对 LLM 不透明）的传统白板，本引擎渲染的是结构化的、语义清晰的 Unicode 网格。

目前支持三种会话模式：

- **Freeform**：原始的无限 ASCII 画布，适合自由绘制。
- **Animation**：固定尺寸、基于时间轴的 ASCII 动画模式。
- **Structured**：仍在开发中的语义化结构布局模式。

### 1. 高性能渲染引擎

- **多层画布架构**：采用背景层、草稿层、UI 层分离的三层架构，在复杂操作下依然保持 60FPS 的丝滑体验。
- **模式感知视口**：Freeform 使用无限视口，Animation 使用固定镜头与有边界画布。

### 2. 智能排版系统

- **缩进继承**：智能换行逻辑，自动检测并保持上一行的缩进层级。
- **网格感知 Unicode**：原生支持 **中日韩 (CJK) 字符** 与 **Emoji** 的宽字符占用，同时将 **Nerd Font / PUA 图标** 按单个网格符号放置。
- **模块化缩进**：专业的 Tab 系统，按 2 个标准网格单位移动光标，对齐更精准。
- **字符库**：右侧 Library 按 Unicode、Nerd Font、Emoji 与 Box Drawing 分类展示字符，并提供名称/tooltip 辅助识别。

### 3. 动画工作流

- **固定画布预设**：支持 `80x25`、`64x64`、`128x128` 等常用尺寸，也支持自定义宽高。
- **左侧帧栏**：可通过紧凑帧预览新增、复制、删除、拖拽排序与重命名帧。
- **洋葱皮辅助**：支持邻近帧的 ghost/onion skin 显示，便于逐帧 ASCII 动画绘制。
- **导出能力**：支持导出轻量 JSON 动画数据、GIF、asciinema `.cast`，以及当前帧 ANSI 文本。

### 4. 分布式协作

- **Yjs CRDT 集成**：基于无冲突复制数据类型 (CRDT)，实现低延迟的实时多人协作编辑。
- **鲁棒的持久化**：细粒度的撤销/重做 (Undo/Redo) 管理，并支持本地存储同步。

### 5. 精准编辑与剪贴板

- **锚点框选**：支持 `Shift + Click` 快速创建以锚点为中心的矩形选区。
- **批量填充**：一键用任意字符填充当前的活跃选区。
- **上下文枢纽**：专业的右键菜单，支持复制、ANSI 格式复制、剪切、粘贴和删除操作。
- **ANSI 剪贴板**：可复制/导出 SGR 前景色、背景色与文本属性，也能粘贴标准 ESC ANSI 或 ANSI-like 文本，例如 `[38;2;190;24;93m...`。
- **终端样式解析**：粘贴支持 8 色、亮色 16 色、256 色与 truecolor SGR 形式，也支持 bold、dim、italic、underline、strikethrough 等文本属性。Reset (`0m`) 会清除前景色、背景色和文本属性。

---

## 作品展示



<div align="center">
  <img src="public/Case/Case.webp" width="100%" style="border-radius: 6px; border: 1px solid #333; margin: 5px;" />
</div>

---

## 技术栈

- **前端框架**: React 18, TypeScript
- **状态管理**: Zustand (Slice Pattern)
- **同步引擎**: Yjs / Y-IndexedDB
- **手势交互**: @use-gesture/react
- **动画导出**: JSON 交换格式、浏览器内 GIF 生成、简单 asciinema `.cast` 帧流
- **终端文本**: SGR 前景/背景、文本属性，以及 ANSI/ANSI-like 导入导出
- **UI 组件**: Tailwind CSS, Shadcn UI, Radix UI

---

## 🚀 快速开始

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

## ⌨️ 快捷键指南

| 操作           | 快捷键         | 说明                                 |
| :------------- | :------------- | :----------------------------------- |
| **框选区域**   | `拖拽`         | 传统的矩形区域选择                   |
| **锚点选区**   | `Shift + 点击` | 创建从上一次点击位置到当前位置的选区 |
| **批量填充**   | `输入字符`     | 用按下的字符填满当前选区             |
| **智能换行**   | `Enter`        | 换行并保留上一行的缩进               |
| **铺设空格**   | `Tab`          | 光标向右移动 2 个网格单位            |
| **上下文菜单** | `右键点击`     | 唤起复制、ANSI 复制、剪切、粘贴和删除 |

粘贴支持纯文本、应用内富剪贴板数据，以及 ANSI/ANSI-like 终端样式文本。动画模式额外提供时间轴播放、逐帧切换、循环、ghost 开关与 JSON/GIF/asciinema `.cast` 导出等 UI 控件。

---

## 🗺 路线图 (Roadmap)

- [x] 多层 Canvas 渲染引擎
- [x] 基于 Yjs 的实时协作
- [x] 智能缩进与 Tab 系统
- [x] 右键菜单与剪贴板集成
- [x] 固定尺寸动画模式、时间轴、洋葱皮与导出能力
- [x] 面向动画帧流的简单 asciinema `.cast` 导入/导出
- [x] ANSI/ANSI-like 前景色、背景色与文本属性导入导出
- [ ] **NES (Next Edit Suggestion)**: 基于布局模式的字符预测
- [ ] **AI Chat 集成**: 通过自然语言生成画布组件
- [ ] 完整 ANSI terminal sequence workspace 与 SVG 导出

---

## 📄 许可证

本项目基于 **MIT 许可证** 开源。详情请参阅 [LICENSE](LICENSE) 文件。
