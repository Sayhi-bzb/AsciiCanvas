# AsciiCanvas 架构蓝图

本文定义 AsciiCanvas 的目标文件架构与施工顺序。协议格式以 [docs/protocol-v1.md](docs/protocol-v1.md) 为准，性能基线以 [docs/perf-baseline.md](docs/perf-baseline.md) 为准。

## 目标

采用 `app -> widgets -> domains -> shared` 四层结构，消除旧目录兼容入口、跨域深层导入和双向依赖，使每项业务能力只有一个明确归属与一个公开入口。

## 目标目录

```text
src/
  app/          # 启动、布局、全局装配
  widgets/      # 页面级复合界面
  domains/      # 稳定业务模型与能力
  shared/       # 无业务归属的基础设施
  test/         # 跨模块测试设施
```

```text
src/
  app/{providers,hooks}
  widgets/
    canvas-editor/{interaction,rendering}
    toolbar/
    sidebars/
    session-tabs/
    animation-timeline/
  domains/
    document/{model,protocol,import,public.ts}
    canvas/{model,geometry,viewport,public.ts}
    selection/{model,operations,public.ts}
    structured-content/{model,editing,components,templates,public.ts}
    animation/{model,generators,public.ts}
    editor-actions/{catalog,handlers,shortcuts,public.ts}
    export/{core,formats,delivery,public.ts}
    character-library/{model,public.ts}
    sessions/{model,public.ts}
  shared/{ui,browser,i18n,metrics,styles,types,utils}
  test/{fixtures,helpers}
```

根目录只保留配置、入口文档和依赖清单。`docs/` 保存权威文档，`e2e/` 保存浏览器流程测试，`examples/` 保存案例源文件，`scripts/` 保存数据、质量和性能脚本，`public/` 只保存运行时静态资源。

## 归属规则

- `app` 负责应用启动、Provider 和全局布局，不包含业务算法。
- `widgets` 组合多个 domain，只保存界面状态与交互编排。
- `domains` 保存可独立测试的业务模型，不导入 `widgets` 或 `app`。
- `shared` 不导入任何 domain，且不得包含业务语义。
- Zustand 状态按业务归入对应 domain；应用层只组合状态，不设置统一 `store/` 目录。
- React 组件仅在跨业务复用且无业务语义时进入 `shared/ui`。
- `canvas-editor` 只负责视口、输入路由和绘制，不拥有导入、导出、会话或动画业务。
- `structured-content` 独立拥有结构化节点、模板和编辑规则。
- 跨 domain 流程由 `editor-actions` 或 widget 编排，不允许 domain 双向依赖。

## 公开接口

每个 domain 只通过 `public.ts` 暴露稳定业务类型、跨模块命令与查询、允许外部渲染的领域组件，以及必要的状态 selector 和操作接口。

不得公开 Zustand slice 实现、内部 handler、adapter、模板工厂、内部辅助函数或其他 domain 的二次 re-export。跨 domain 代码不得深层导入。旧 `components/`、`store/`、`features/`、`utils/`、`services/`、`lib/`、`styles/` 和 `types/` 兼容入口不属于目标架构。

## 文件规范

- 文件名统一使用 `kebab-case`；React 组件导出名使用 `PascalCase`。
- 避免 `utils.ts`、`helpers.ts`、`interfaces.ts` 等泛化文件名，按具体职责命名。
- 单元测试与实现同目录；跨模块集成测试放入 `src/test/integration/`，浏览器流程测试保留在 `e2e/`。
- `coverage/`、`dist/`、`test-results/`、`playwright-*-report/` 和 `proofshot-artifacts/` 均为生成产物，不进入版本控制。
- `public/` 只保存运行时静态资源；案例源文件进入 `examples/`，展示资源进入 `public/examples/`。
- `scripts/` 按 `data/`、`quality/`、`performance/` 分类。

## 施工节奏

每个阶段独立提交。进入下一阶段前必须通过构建、静态检查、相关测试和 GitNexus 变更检查。

### 阶段 0：建立基线

- 记录 build、lint、单元测试、E2E、Knip 和性能测试现状。
- 保存当前 GitNexus 模块、流程和跨域依赖结果。
- 记录与文件整理无关的既有失败，不在迁移提交中顺带修复。

### 阶段 1：清理仓库产物

- 停止跟踪覆盖率、测试报告、性能报告和 Proofshot 产物。
- 补齐 `.gitignore`，统一生成产物目录。
- 将案例源文件和运行时展示资源分开归档。

### 阶段 2：收口 shared

- 将无业务语义的 UI、浏览器适配、样式、类型和工具统一到 `shared`。
- 将生产代码和测试改为直接导入权威路径。
- 删除旧基础目录中的 re-export 兼容壳。

### 阶段 3：建立 domain 边界

- 为每个 domain 建立 `public.ts`。
- 将跨域深层导入替换为公开接口。
- 增加依赖方向检查，先禁止新增违规，再清理存量违规。

### 阶段 4：拆分 canvas 职责

- 将结构化节点、模板和编辑规则迁入 `structured-content`。
- 将选择模型与操作迁入 `selection`。
- 将动画模型和生成器迁入 `animation`。
- 将协议、导入、导出和会话能力移出 canvas。
- 使 canvas domain 只保留画布模型、几何和视口能力。

### 阶段 5：建立 widgets 与 app

- 将画布编辑器、工具栏、侧栏、会话标签和时间线迁入 `widgets`。
- 将跨域交互编排放在 widget 或 `editor-actions`。
- 将入口、Provider 和全局布局迁入 `app`，确保 `app` 只负责装配。

### 阶段 6：整理测试与脚本

- 将单元测试迁到对应实现目录。
- 将共享 fixture、测试 helper 和集成测试归入 `src/test`。
- 按数据、质量和性能职责整理脚本，并删除无调用脚本。

### 阶段 7：固化架构门禁

- 使用 ESLint 限制层级反向依赖、跨 domain 深层导入和 domain 循环。
- 配置 Knip 的应用、测试、E2E 和脚本入口。
- 在 CI 中执行 build、lint、unit、E2E、Knip 和架构检查。
- 使用 GitNexus 确认依赖图满足 `app -> widgets -> domains -> shared`。

## 验收

每阶段必须满足：不改变产品功能、协议格式和持久化数据；不引入新的兼容入口；迁移文件只有一个权威位置；依赖符合层级方向；build、lint、受影响测试和 GitNexus 检查通过。

最终必须满足：生产代码不存在旧目录兼容入口；除 `public.ts` 外不存在跨 domain 深层导入；依赖图无反向边和 domain 循环；各业务能力均有单一归属；Git 不跟踪生成产物；全部质量检查通过。

本文是目标架构与施工顺序的唯一权威来源。
