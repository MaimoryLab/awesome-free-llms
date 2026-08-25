# 免费 LLM 信息站实现规划

## 1. 目标与范围

构建一个前后端分离的免费 LLM 优惠信息站：

- 前端以卡片形式展示优惠信息，默认按“最新发布”倒序排列。
- 提供线索提交页面，收集提供商、额度、邀请码、领取链接、活动时间和模型等信息。
- 使用 Next.js App Router 提供全栈能力：页面负责展示，Route Handlers 负责 JSON API。
- 使用 SQLite 持久化数据。
- 提交接口必须在服务端校验 Cloudflare Turnstile，客户端校验不能作为安全边界。
- 所有返回列表的 API 都使用统一分页格式和上限，避免一次返回全部数据。

本阶段不做用户登录、评论、点赞、邮件通知和复杂后台 CMS。提交记录会保留可扩展的状态字段；MVP 通过校验后直接发布，后续可以增加审核后台。

## 2. 技术方案

### 前端

- Next.js 16 App Router、React 19、TypeScript。
- Tailwind CSS 4，沿用仓库已有配置。
- 首页 `/`：提供两个 Tab；“有效期活动”按创建时间倒序展示在有效期内的活动，“长期活动”展示长期活动。每个 Tab 独立分页。
- 提交页 `/submit`：客户端表单组件，成功后显示提交结果并提供返回列表入口。
- 使用原生 `fetch` 调用同源 API，避免引入数据请求库。
- Turnstile 使用 Cloudflare 官方组件或官方脚本；token 仅在提交时传给服务端，不写入数据库。

### 后端

- `app/api/offers/route.ts`：公开优惠列表 API。
- `app/api/offers/[id]/route.ts`：公开优惠详情 API。
- `app/api/submissions/route.ts`：接收线索提交的 API。
- 数据库访问集中在 `lib/db/`，API 层不直接拼接散落 SQL。
- SQLite 驱动采用 `better-sqlite3`，配合显式建表/迁移脚本；Next 配置将原生驱动标记为服务端外部依赖。
- 输入 schema 使用 `zod`，让页面类型、API 校验和测试共享同一套约束。
- 所有 API 返回 JSON，并设置明确的 HTTP 状态码和错误码。

## 3. 数据模型

### `offers`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | text | UUID/随机 ID，主键 |
| `providerName` | text | 提供商名称 |
| `officialUrl` | text | 官网 URL；服务端拒绝 IP、localhost 和非 HTTP(S) 地址 |
| `benefitsJson` | text | JSON 数组，记录额度类型和数额 |
| `requiresInvite` | integer | SQLite 布尔值；是否需要邀请码 |
| `inviteCode` | text nullable | 需要邀请码时保存；否则为 null |
| `claimUrl` | text nullable | 一键领取链接，可包含邀请码 |
| `startsAt` | text nullable | ISO 8601 时间；长期活动可为空 |
| `endsAt` | text nullable | ISO 8601 时间；长期活动或未知时为空 |
| `isLongTerm` | integer | 是否长期活动 |
| `notes` | text nullable | 备注 |
| `modelsJson` | text nullable | 可用模型名称数组 |
| `status` | text | MVP 为 `published`；预留 `pending`/`rejected` |
| `createdAt` | text | 创建时间，UTC ISO 8601 |
| `updatedAt` | text | 更新时间，UTC ISO 8601 |

`benefitsJson` 的元素结构：

```ts
type Benefit = {
  type: "token" | "voucher" | "points";
  amount: number;
  unit?: string;
};
```

在 `createdAt DESC, id DESC` 上建立索引；如增加活动状态筛选，再建立 `(status, createdAt DESC)` 索引。JSON 字段保留在单表中，减少 MVP 的关联查询和迁移成本。

## 4. API 契约

### `GET /api/offers`

查询参数：

- `page`：从 1 开始，默认 1，非法值回退为 1。
- `pageSize`：默认 12，最大 50。
- `benefitType`：可选，`token`、`voucher` 或 `points`。
- `kind`：默认值 `active`；`active` 只返回 `isLongTerm=false` 且当前时间位于活动有效期内的记录，`long-term` 只返回 `isLongTerm=true` 的记录。
- `status`：仅服务端内部/管理员使用，公开请求固定返回 `published`。

响应：

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 12,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

两个 Tab 都使用 `LIMIT/OFFSET`，并对 `page` 和 `pageSize` 做上限保护。有效期活动按 `createdAt DESC, id DESC` 排序；长期活动同样按创建时间倒序。MVP 数据规模适中，OFFSET 语义简单；数据量明显增长后再迁移到游标分页。

### `GET /api/offers/:id`

返回单条已发布优惠详情；找不到或未发布返回 `404`。这不是列表 API，不需要分页。

### `POST /api/submissions`

请求体包含：

```ts
{
  providerName: string;
  officialUrl: string;
  benefits: Benefit[];
  requiresInvite: boolean;
  inviteCode?: string;
  claimUrl?: string;
  startsAt?: string;
  endsAt?: string;
  isLongTerm: boolean;
  notes?: string;
  models?: string[];
  turnstileToken: string;
}
```

处理顺序：

1. 解析 JSON、检查 Content-Type 和请求体大小。
2. 用共享 zod schema 校验字段长度、枚举、额度数额、时间关系和 URL。
3. 服务端调用 `https://challenges.cloudflare.com/turnstile/v0/siteverify`，传入 secret、token、客户端 IP；验证失败返回 `400`，不写库。
4. 清洗字符串、规范 URL，写入 SQLite，忽略客户端提供的 ID、状态和时间戳。
5. 返回 `201` 和新记录的公开字段，不返回敏感的内部信息。

错误格式统一为：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "提交内容不符合要求",
    "fields": { "officialUrl": "必须是有效的非 IP 官网地址" }
  }
}
```

## 5. 表单与业务校验

- 提供商名称：必填，去除首尾空格，长度 1-120。
- 官网：必须是 `http` 或 `https` URL；拒绝 IP 地址、localhost、内网主机名、用户名密码段和明显的控制字符。
- 额度：至少一项；类型只能是 token、voucher、points；数额必须为有限正数，前端支持添加/删除多项。
- 邀请码：`requiresInvite=true` 时必填；否则强制保存为 null。
- 一键领取链接：可选，但若填写必须为有效 HTTP(S) URL；允许 query 中携带邀请码。
- 活动时间：长期活动时 `isLongTerm=true` 且不要求结束时间；非长期活动必须填写开始和结束时间，结束时间不能早于开始时间。
- 备注：可选，长度上限 2000。
- 模型：可选的字符串数组，每项去空格并限制长度和数量，防止超大请求。
- 前端即时反馈只用于体验，API 仍执行完整校验。

## 6. 页面交互

### 首页 `/`

- 顶部导航、站点简介和“提交线索”入口。
- Tab 一：“有效期活动”，只展示当前时间有效的非长期活动，按创建时间从新到旧排列。
- Tab 二：“长期活动”，只展示 `isLongTerm=true` 的活动，按创建时间从新到旧排列。
- 两个 Tab 的分页状态相互隔离，切回时保留各自页码。
- 卡片显示：提供商、额度徽章、模型列表、活动时间、邀请码提示、备注和领取按钮。
- 官网和领取链接使用新标签页打开，并设置 `rel="noreferrer noopener"`。
- 空状态、加载状态、错误状态和分页末页都要有明确反馈。
- 响应式布局：移动端单列，桌面端 2-3 列；分页按钮在窄屏保持可操作。

### 提交页 `/submit`

- 分组呈现基本信息、额度、领取条件、活动时间和备注。
- “需要邀请码”使用开关控件；开启后显示邀请码字段，关闭时清空值。
- 额度支持动态增加/删除；至少保留一行。
- “长期活动”使用同款开关控件；开启后禁用并清空结束时间。
- Turnstile 未完成时禁用提交按钮；提交中防重复提交。
- 成功后显示提交编号和返回首页按钮；失败时保留用户输入并定位到错误字段。

## 7. 安全、可靠性与部署

- Turnstile secret 只放在服务端环境变量 `TURNSTILE_SECRET_KEY`；站点 key 使用 `NEXT_PUBLIC_TURNSTILE_SITE_KEY`。
- SQLite 路径通过 `SQLITE_PATH` 配置，默认使用项目数据目录；生产环境必须挂载持久化磁盘。
- 生产部署建议使用有持久磁盘的 Node.js/VPS。Vercel 等无状态函数的本地 SQLite 不适合作为持久化生产库；后续可替换为 Turso/libSQL 而不改变 API 契约。
- 设置合理的请求体大小、数据库 busy timeout、必要索引和统一异常日志；日志中不输出 Turnstile token 或邀请码原文。
- 可选的轻量限流（按 IP 哈希和时间窗口）作为后续增强，不阻塞 MVP。

## 8. 测试与质量门槛

- 单元测试：URL 非 IP 校验、邀请码条件校验、时间范围、额度 schema、分页参数归一化。
- API 集成测试：列表排序与分页边界、详情 404、提交成功、Turnstile 失败不写库、非法输入错误格式。
- 前端验收：卡片展示、动态字段、错误回填、移动端布局和分页交互。
- 开发完成后运行 `pnpm lint`、`pnpm build`；若仓库环境允许，再运行测试脚本及 `staticcheck`/`go fix` 等 Go 工具（本项目当前无 Go 代码，因此不引入 Go 工具链）。
- Next 16 相关实现开始前，先阅读仓库中安装版本对应的 `node_modules/next/dist/docs/` 指南，并核对 Route Handlers、缓存和原生依赖配置。

## 9. 分阶段实施与提交拆分

获得方案确认后，先按仓库规则处理 `.codegraph/` 初始化决定，再使用 subagents 并行：

1. 基础依赖、SQLite 初始化、schema/migration、共享类型和校验。
2. 列表/详情/提交 API、Turnstile 服务端验证和 API 测试。
3. 首页卡片列表、分页、响应式视觉和提交表单。
4. 联调、文档、质量检查和最终验收。

每个阶段拆成少量、可独立回滚的 Angular commit，单个 commit 尽量不超过 200 行，例如：

- `feat(db): add sqlite offer schema and migrations`
- `feat(api): add paginated offer endpoints`
- `feat(submit): verify turnstile and store leads`
- `feat(ui): add offer cards and submission form`
- `test(api): cover validation and pagination`

## 10. 需要确认的默认决策

以下决策按 MVP 规划，确认后直接执行：

- 新提交通过 Turnstile 和字段校验后直接以 `published` 发布，不提供后台审核页面。
- 额度允许一条线索包含多种类型；数额使用非负数并由 `unit` 补充展示语义。
- 公开列表只返回已发布数据；首页拆为“有效期活动”和“长期活动”两个 Tab，默认分页大小 12、最大 50。
- SQLite 以本地/持久磁盘 Node 部署为目标，不把无持久盘的 serverless 当作生产方案。
