# WWFS 管理驾驶舱 (WWFS-Management)

Wallace Wang Financial Services 的**管理层经营数据驾驶舱**。把销售、市场、运营各部门的关键指标
(销售转化率、流量、私信数量、开口成本……)汇总到一个页面,按月对比环比变化,辅助管理决策
(是否做销售培训、是否要市场部汇报等)。

- 技术栈:Next.js 14 (App Router) + Prisma + SQLite + Tailwind,Docker 部署。
- 与 CRM/Marketing 同一台 DigitalOcean droplet,端口 **3004**,域名计划 `management.wallacewang.ca`。
- **登录沿用 CRM**(单点登录 SSO):与 CRM 共用 `JWT_SECRET`,cookie 域 `.wallacewang.ca`。
- **访问控制**:`ALLOWED_ROLES`(默认仅 `admin`)。HR / 部门负责人角色待 CRM 下发后加入即可。

## 每日仪表盘(首页 `/`)

打开就看「员工和 AI agent 最近 7 天交了什么、有没有按时做」。第一块「今天要处理」只列异常(红/黄),
下面按部门给明细,再往下是 AI agent 花名册和 CRM / Marketing 最近上线的改动。原来的月度经营总览挪到 `/kpi`。

- 数据**不落本地库**,每次打开现拉(只读):CRM `GET /api/admin/team-activity`(`CRM_API_KEY`)、
  Marketing `GET /api/agent/ops-summary`(`MARKETING_API_KEY`)、GitHub 最近合并的 PR(`GITHUB_TOKEN`)。
  哪个没配,那一块显示「未连接」,其余照常。
- 名单在 `/team` 管:员工(按名字匹配 CRM / Marketing 账号、每周拍摄目标)和 AI agent(职责、排程、多久该跑一次)。
- **Agent 打卡**:`POST /api/agents/run`(Bearer `INGEST_TOKEN`),`{"agent":"mac","task":"…","status":"ok|error|running","summary":"…","outputCount":5}`。
  没登记过的 agent 第一次打卡自动登记。填了「Marketing 钥匙名」的 agent,用 Marketing API 的最后时间也算活动。
  超过「多少小时跑一次 + 宽限」没动静 → 标红「超时」。

## 通话分析(`/calls`)

电话录音 → 逐字稿 → AI 点评,再跟 CRM 里客户后来来没来对上,看转化率为什么不够。首页摘每人一行出席率和结论。

- `/calls`:四个数字(第一次会议出席率、约到没来、通话平均分、分析了几通)→ 哪一环节高得 / 低得不正常 → 每人一张卡
  (漏斗、来了 vs 放鸽子两组对比、Claude 写的放鸽子原因)。
- `/calls/<CRM 用户 id>`:一个人的报告全文 + 每一通电话(按结果筛:放鸽子 / 来了 / 没约到…),点进去看点评和逐字稿。
- 数据现拉 CRM `GET /api/admin/call-insights`、`/api/admin/call-insights/calls/:id`(同一个 `CRM_API_KEY`)。
  CRM 每天凌晨 2 点(多伦多)自动跑:补转文字、导入 Zoom 会议文字稿、每人一份报告。
- 约给别人(比如 Wallace)开的会不算进销售的出席率,单独一行显示。
- 「在 CRM 打开客户」链接用 `CRM_PUBLIC_URL`,没配就用 `CRM_API_BASE`。

## 数据模型

- `Department` — 部门(销售部 / 市场部 / 运营部)。
- `Metric` — KPI 定义(key、名称、单位、`betterWhen` 涨跌哪边算好、格式)。
- `MetricValue` — 某月某指标的数值,唯一键 `(metricId, period)`,`period` 为 `"YYYY-MM"`。
  环比 = 本月行的值 − 上月行的值。

指标目录在 `prisma/seed.ts` 的 `CATALOGUE` 里,改这里即可增删指标(按 key 幂等 upsert,可反复跑)。

## 数据从哪来(三层采集)

1. **全自动(CRM 类)** — 销售转化率、线索、成交。来源 CRM,phase 2 通过 CRM 只读 API 拉取。
2. **半自动(平台数据)** — 流量、私信、粉丝。月底 Claude 定时任务抓各平台后台 →
   `POST /api/ingest`(Bearer `INGEST_TOKEN`)写入。
3. **人工(钱)** — 成本、业绩。在 `/data` 页手动录入(自动保存)。

### `POST /api/ingest` 示例

```bash
curl -X POST https://management.wallacewang.ca/api/ingest \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"period":"2026-06","values":[{"key":"traffic","value":128000},{"key":"dm_count","value":342,"note":"小红书210/抖音132"}]}'
```

未知 metric key 会被跳过并在返回的 `skipped` 里报告,不会静默丢数据。

## 本地开发

```bash
cp .env.example .env   # 本地 dev 不要设 COOKIE_DOMAIN,会 seed 一个本地 admin
npm install
npm run setup          # prisma generate + db push + seed
npm run dev            # http://localhost:3000
```

## 部署(对齐 Marketing 流程)

1. 本地改完 → `git commit && git push origin main`。
2. `git archive --format=tar.gz -o $env:TEMP\wwfs-management.tar.gz HEAD`
3. `scp $env:TEMP\wwfs-management.tar.gz root@159.203.13.193:/root/wwfs-management.tar.gz`
4. `ssh root@159.203.13.193 "cd /root/WWFS-Management && tar -xzf /root/wwfs-management.tar.gz && docker compose build && docker compose up -d"`
5. 健康检查:`curl -sI http://127.0.0.1:3004/login` → 200

### 部署前置(一次性)

- DNS:`management.wallacewang.ca` A 记录指向 droplet IP(需域名注册商处操作)。
- Nginx:新增 vhost 反代 `127.0.0.1:3004`,certbot 签证书(参照 marketing vhost)。
- VPS `/root/WWFS-Management/.env`:
  - `AUTH_SECRET` = CRM 的 `JWT_SECRET`(必须一致,否则 SSO 静默失效)
  - `COOKIE_DOMAIN=.wallacewang.ca`
  - `ALLOWED_ROLES=admin`(以后加 `,hr,manager`)
  - `INGEST_TOKEN=<随机串>`(给月底定时任务用)
