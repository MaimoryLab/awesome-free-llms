# Free LLM Hub

收集免费 LLM 额度、代金券和积分活动的 Next.js 网站。首页分为有效期活动和长期活动，线索提交通过 Cloudflare Turnstile 验证，数据存储在 SQLite。

## 本地开发

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

在 `.env.local` 中配置 Cloudflare Turnstile site key 和 secret key。SQLite 默认创建在 `data/offers.db`，也可以通过 `SQLITE_PATH` 指向其他持久化路径。

打开 [http://localhost:3000](http://localhost:3000)，提交页位于 `/submit`。

## API

- `GET /api/offers?kind=active&page=1&pageSize=12`：当前有效的限时活动。
- `GET /api/offers?kind=long-term&page=1&pageSize=12`：长期活动。
- `GET /api/offers/:id`：活动详情。
- `POST /api/submissions`：验证 Turnstile 并创建活动。

所有列表响应包含 `items` 和 `pagination`，`pageSize` 最大为 50。生产环境需要为 SQLite 配置持久化磁盘。

## EdgeOne Makers 部署

项目的 `build` 脚本使用 `next build --webpack`。这是为了让 `better-sqlite3` 以标准 Node 外部模块方式保留，避免 Next 16 默认 Turbopack 产出带哈希的原生模块名，导致 EdgeOne SSR 运行时无法加载。

部署时确保 EdgeOne 使用仓库中的安装和构建命令，并在 Node 运行时允许安装 `better-sqlite3` 的原生依赖。SQLite 数据库必须挂载到持久化磁盘；如果 EdgeOne 运行实例不提供持久化本地文件，提交数据不会适合作为生产数据存储，应改用外部数据库。
