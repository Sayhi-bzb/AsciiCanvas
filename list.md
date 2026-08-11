# CharDesk 品牌迁移清单

> 展示名称：`CharDesk`；技术名称与 slug：`chardesk`。
> 迁移原则：先锁定外部资产，再迁移入口与用户数据，最后调整品牌和发布命名空间。旧协议与旧包保留兼容期。

## 0. 品牌与外部资产

- [x] 确认展示名 `CharDesk`；一句话定位为 “Unicode canvas for humans and AI”。
- [ ] 完成商标及同类产品名称检索。
- [x] 注册 `chardesk.com`，并将 `https://chardesk.com/` 设为唯一正式入口。
- [ ] 注册常见拼写和防御性域名；统一重定向到主域名。
- [ ] 确认 GitHub 仓库名 `CharDesk` 或 `chardesk` 可用。
- [ ] 创建或占用 npm scope `@chardesk`，配置所有者、2FA 和 trusted publishing。
- [ ] 检查社交账号、社区名称和联系邮箱是否需要同步注册。
- [ ] 确定 Logo、图标、主色、字体和品牌写法规范。

## 1. 域名、Cloudflare 与用户数据

> 当前状态：域名锁与 WHOIS 隐私已开启；DNSSEC 已启用但仍待注册局确认；注册商自动续费仍为关闭状态，需要在 Dashboard 手动开启。

- [x] 在现有 `ascii-canvas` Pages 项目上添加 `chardesk.com` 和 `www.chardesk.com`。
- [x] 验证主域名、`www`、DNS 与 TLS；SSL 为 Strict，最低 TLS 1.2。
- [ ] 补充核验缓存策略与安全响应头。
- [x] 按已确认决策，将 `ascii-canvas.pages.dev` 立即永久重定向到正式域名。
- [x] 盘点旧域名上的 localStorage 数据：
  - `ascii-canvas-persistence`
  - `ascii-canvas-persistence-v3-backup`
  - `ascii-canvas-onboarding-v1`
  - `ascii-canvas-ui-language`
  - `ascii-canvas-collaboration-identity`
- [x] 盘点以 `ascii-canvas-room-v1:*` / `asciicanvas-v1-*` 命名的 IndexedDB 协作缓存。
- [x] 记录当前决策：不实现旧域名自动数据迁移入口，依靠现有文件导出/导入能力。
- [ ] 在新域名验证导入旧 `.ascanvas` 文件后能恢复画布和会话。
- [ ] 为无法自动迁移的数据提供清晰的手动导出、导入说明。
- [x] 配置 `ascii-canvas.pages.dev` 到主域名的 301 重定向，并保留路径和查询参数。
- [ ] 验证协作链接中的 `#room=` fragment 在重定向后仍然存在且可以加入房间。
- [x] 沿用同一 Pages 项目的 Cloudflare Web Analytics 配置。
- [ ] GitHub 仓库更名后，在 Cloudflare Git 集成中验证仓库连接和 production branch。
- [ ] 完成一次 preview 和 production 部署，并保留可回滚的旧部署。

## 2. 网站、SEO 与品牌资产

- [x] 将页面标题、description、keywords 和可见产品名改为 CharDesk。
- [x] 更新 canonical URL 为 `https://chardesk.com/`。
- [x] 更新 Open Graph 的 URL、标题、描述、站点名和图片。
- [x] 更新 Twitter Card 的 URL、标题、描述和图片。
- [x] 更新 `robots.txt` 中的 sitemap 地址。
- [x] 更新 `sitemap.xml` 的站点 URL 和 `lastmod`。
- [ ] 在 Google Search Console 验证旧入口和新域名，并提交新 sitemap。
- [ ] 监控旧、新域名的索引、404、重定向链和访问量。
- [x] 将 `public/Cover.png` 中的旧域名替换为 `chardesk.com`。
- [x] 检查 `public/demo.gif` 和 Case 图片；demo 无旧品牌，已替换两张 Case 图片中的旧品牌。
- [x] 首批迁移继续使用现有 paint-bucket 图标与 favicon。
- [x] 将 README 图片 alt text 更新为 CharDesk，并保留 Unicode/ANSI 描述关键词。
- [ ] 域名迁移稳定后再集中上线视觉品牌改版，避免同时改变过多 SEO 变量。

## 3. 应用界面与文案

- [x] 将中英文 `appMenu.project` 从 AsciiCanvas 改为 CharDesk。
- [x] 更新数据安全文案中的品牌名称。
- [x] 更新页面 `<title>` 和其他静态品牌文案。
- [x] 保留 “ASCII canvas”“Unicode grid editor” 作为产品类别描述，而不是主品牌。
- [x] 搜索并审核所有面向用户的 `ASCII Canvas`、`AsciiCanvas`、`ascii-canvas` 文案。
- [x] 更新导出格式标签、下载名及相关测试中的旧品牌；协议错误与内部标识保持兼容。
- [ ] 更新 onboarding CSS 类或测试 ID 仅作为可选内部清理，不与品牌发布绑定。

## 4. GitHub 与项目文档

- [ ] 将 GitHub 仓库更名为约定的 CharDesk slug。
- [ ] 更新 GitHub About、Description、Topics、Website 和社交预览图。
- [ ] 不重新创建或占用旧仓库名，以保留 GitHub 自动重定向。
- [ ] 更新本地 `origin` remote，并通知已有贡献者更新 clone URL。
- [x] 更新 `README.md` 和 `README.zh-CN.md`：标题、徽章、产品介绍、链接、截图及 alt text。
- [ ] 更新应用内 `APP_SOURCE_URL`。
- [ ] 更新两个 npm 包的 repository、homepage 和 bugs URL。
- [ ] 更新 `.github/workflows/release.yml` 中硬编码的仓库名称。
- [ ] 检查 Issues、Discussions、模板、外部文档和第三方链接中的旧仓库地址。
- [ ] 验证旧 GitHub URL、clone、fetch 和 push 的重定向；CI 使用新 URL。

## 5. npm 包与构建配置

- [ ] 创建 `@chardesk/protocol`。
- [ ] 创建 `@chardesk/fonts`。
- [ ] 更新根 `package.json` 的私有包名、workspace 命令和依赖名称。
- [ ] 更新两个 package manifest 的名称、描述、关键词、仓库地址和文档链接。
- [ ] 更新 `package-lock.json`。
- [ ] 更新 TypeScript、Vite 和 Vitest 中的 `@ascii-canvas/*` alias。
- [ ] 更新源码、测试、脚本和文档中的包 import。
- [ ] 更新 release workflow 的版本存在性检查、workspace、`npm pack` 和 `npm publish` 命令。
- [ ] 更新 release tarball 文件名和 packed-package smoke test。
- [ ] 先发布并验证 `@chardesk/*` 包，再迁移主应用。
- [ ] 为 `@ascii-canvas/protocol` 和 `@ascii-canvas/fonts` 发布最终兼容版本。
- [ ] 旧包保持可安装，并在 README 与安装警告中指向 `@chardesk/*`。
- [ ] 确认新包稳定后 deprecate 旧包；不要 unpublish。
- [ ] 验证 npm provenance、README 渲染、exports、类型声明和 CSS/字体资源路径。

## 6. 公共 API 与协议兼容

- [ ] 在新包中提供 CharDesk 命名的公共导出。
- [ ] 为现有 `AsciiCanvas*` 类型、`parseAsciiCanvasText` 等 API 制定兼容策略。
- [ ] 旧 API 如需淘汰，先作为 alias 保留并标记 deprecated，记录移除版本。
- [x] 将以下标识视为 v1 协议，不在首次品牌迁移中直接替换：
  - `.ascanvas`
  - `application/vnd.ascii-canvas+json`
  - `ascii-canvas-document`
  - `asciicanvas: slides/v1` / `slides/v2`
  - 使用 `asciicanvas` 语言标识的 Markdown fence
  - `ascii-canvas/default-v1` 字体 profile ID
- [x] 新版应用继续读取所有旧格式和旧版本文件。
- [ ] 如需引入 CharDesk wire-format 标识，设计新的协议版本并提供双读、迁移和回退策略。
- [x] 将导出文件名改为 `chardesk-<timestamp>.*`，并保持 `.ascanvas` 扩展名兼容。
- [ ] 更新协议 spec、包 README 和迁移指南，明确“品牌名”和“格式名”的关系。

## 7. Agent Skill 与 Slides 格式

- [ ] 新增或重命名技能入口为 `$chardesk`。
- [ ] 更新 skill 的 display name、description 和默认 prompt。
- [ ] 保留 `$ascii-canvas` 兼容入口或提供明确迁移说明。
- [ ] 更新 skill references 中面向用户的品牌文字。
- [ ] 保持旧 `asciicanvas` frontmatter 和 fence 可解析。
- [ ] 如新增 `chardesk` fence，确保新旧 fence 产生相同文档模型并补充往返测试。

## 8. 测试与验收

- [x] 运行 lint、domain-boundary check、TypeScript build 和完整单元测试（109 个文件、839 项测试通过）。
- [x] 运行品牌相关 Playwright E2E（App Menu 2 项通过），并更新可见品牌与导入格式断言。
- [ ] 测试新建、保存、刷新、导出和重新导入画布。
- [ ] 测试旧 `.ascanvas`、JSON、ANSI、Markdown Slides 文件导入。
- [ ] 测试旧 localStorage 状态和持久化版本升级。
- [ ] 测试旧域名手动/自动迁移到新域名，确保作品不会静默丢失。
- [ ] 测试协作房间链接、身份、IndexedDB 缓存和断线重连。
- [ ] 对新旧 npm 包分别执行 build、pack、安装和 import smoke test。
- [ ] 部署后检查生产 HTML 中不存在错误的 canonical、OG、Twitter 或旧域名链接。
- [ ] 验证旧 Pages URL、旧 GitHub URL 和旧 npm 包均给出正确的迁移路径。
- [ ] 在桌面端和移动端检查 CharDesk 名称、Logo、封面及中英文排版。

## 9. 发布与兼容期

- [ ] 写品牌更名公告，说明 CharDesk 与 ASCII Canvas 的关系。
- [ ] 发布迁移指南：域名、本地作品、GitHub、npm 和协议兼容性。
- [ ] 为旧域名和旧 npm 包设定明确的支持期限；协议读取兼容期应更长。
- [ ] 观察部署错误、404、客户端导入失败、npm 下载和用户反馈。
- [ ] 在兼容期结束前不要删除旧 Pages 项目、旧域名迁移页或旧包版本。
- [ ] 仅在确认无活跃依赖后清理纯内部旧命名；保留必要的 legacy reader 和 migration tests。
