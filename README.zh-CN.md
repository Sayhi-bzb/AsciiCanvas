[English](./README.md) | [简体中文]

# CharDesk

> **面向人与 AI 的 Unicode 画布。**

CharDesk（原 ASCII Canvas）是一块用于绘制图表、界面与想法的可编辑 Unicode 网格。作品对人仍是视觉内容，对语言模型则是可以直接理解的文本。

<p align="center">
  <a href="https://chardesk.com/">
    <img src="https://img.shields.io/badge/打开_CharDesk-22c55e?style=for-the-badge" alt="打开 CharDesk">
  </a>
</p>

<div align="center">
  <img src="public/demo.gif" alt="在 CharDesk 上绘图" width="100%">
</div>

## 人与 AI 共享的视觉语言

人可以一眼理解布局，语言模型则天然处理 token 序列。截图虽然连接了两者，却也带来像素噪声、视觉上下文开销，以及多轮交流中难以精准修改的问题。

CharDesk 直接以文本承载视觉信息。你看到的仍是一张图，但它也可以被复制、搜索、版本管理，并以原生文本交给 AI，而不必先变成一张不透明的图片。

```text
┌──────────┐       ┌──────────┐
│ 人的意图 │──────>│ 共享画布 │
└──────────┘       └────┬─────┘
                        │
                   ┌────▼─────┐
                   │ AI 可读  │
                   │ 文本     │
                   └──────────┘
```

## 让想法直接变得可见

你可以用 CharDesk 创作：

- 流程图、架构图和系统关系图；
- 界面线框图与终端风格原型；
- 需要表达空间关系的笔记；
- Unicode 图形、图标、表格与轻量数据视图；
- 能在对话、文档、Issue 和源文件之间流动的视觉上下文。

你不需要擅长绘画。可以从形状和模板开始，在画布上直观排列，再把结果作为文本带到任何地方。

## 一块画布，三种创作方式

### 自由画布

在无限字符网格上直接绘制。把文字与符号放到任意位置，用 Unicode 字符作画，选择区域并持续调整想法。

### 结构化画布

使用可编辑的文字、方框、背景、分隔区域、线条和箭头组合内容。每一部分都可以独立移动和缩放，也可以从可复用的界面组件与完整模板开始。

### 幻灯片

将每一页作为可编辑文本编排，或让 Agent 生成 `.slides.md` 文件，再回到画布继续调整。参见 [Slides 文件结构](.agents/skills/chardesk/references/slides.md)。

## 为人与 AI 的往返协作而生

CharDesk 让视觉作品自然进入以文本为主的对话：

1. 在画布上直观地组织或完善想法；
2. 复制为纯文本或带 ANSI 样式的文本；
3. 把紧凑表示交给 AI 分析或修改；
4. 将文本粘贴回画布，继续视觉编辑。

应用不要求绑定某一家 AI 服务。作品本身就是交互介质：一份双方都可以检查的可移植文本。

## 文本可以承载更多

CharDesk 在一致的网格中组合 Unicode 符号、中日韩字符、Emoji、Box Drawing、Nerd Font 字形与颜色。它让文字呈现结构和视觉重点，同时保持可选择、可复制、可编辑。

<p align="center">
  <img src="public/Cover.png" alt="CharDesk 中的 Unicode 与 ANSI 作品" width="100%">
</p>

## 看看它可以成为怎样的作品

<div align="center">
  <img src="public/Case/Case.webp" alt="使用 CharDesk 创作的示例" width="100%">
</div>

<p align="center">
  <a href="https://chardesk.com/"><strong>打开 CharDesk，开始创作 →</strong></a>
</p>

## 面向开发者

CharDesk 的输出也可以在编辑器之外使用。文本交换格式见 [`@chardesk/protocol`](packages/protocol/README.md)，框架无关的网页渲染见 [`@chardesk/viewer`](packages/viewer/README.md)，兼容字形资源见 [`@chardesk/fonts`](packages/fonts/README.md)。安装方式与 API 由各自的包文档负责。

## 致谢

感谢 [LINUX DO](https://linux.do/) 社区。

## 许可证

CharDesk 基于 [MIT License](LICENSE) 开源。
