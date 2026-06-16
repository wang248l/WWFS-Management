import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---- Department + KPI catalogue --------------------------------------------
// Edit this list to add/rename metrics; the seed upserts by `key`, so it is
// safe to re-run on every deploy. Removing an entry here does NOT delete the
// metric (to avoid wiping historical values) — delete it in the DB explicitly.

type MetricDef = {
  key: string;
  name: string;
  unit?: string;
  betterWhen?: "up" | "down" | "neutral";
  format?: "number" | "percent" | "currency";
  defaultSource?: "manual" | "cron" | "crm" | "marketing";
  description?: string;
};

type DeptDef = {
  key: string;
  name: string;
  icon: string;
  metrics: MetricDef[];
};

const CATALOGUE: DeptDef[] = [
  {
    key: "sales",
    name: "销售部",
    icon: "💼",
    metrics: [
      { key: "sales_conversion_rate", name: "销售转化率", unit: "%", format: "percent", betterWhen: "up", defaultSource: "crm", description: "成交客户数 ÷ 接收线索数。来源:CRM。" },
      { key: "leads_received", name: "接收线索数", unit: "个", betterWhen: "up", defaultSource: "crm", description: "本月分配给销售的线索总数。来源:CRM。" },
      { key: "new_clients", name: "新增成交客户", unit: "个", betterWhen: "up", defaultSource: "crm", description: "本月新成交的客户数。来源:CRM。" },
      { key: "sales_revenue", name: "成交业绩", unit: "$", format: "currency", betterWhen: "up", defaultSource: "manual", description: "本月新成交业绩金额。" },
    ],
  },
  {
    key: "marketing",
    name: "市场部",
    icon: "📣",
    metrics: [
      { key: "traffic", name: "总流量", unit: "次", betterWhen: "up", defaultSource: "marketing", description: "全平台总播放/曝光量。来源:Marketing 系统。" },
      { key: "dm_count", name: "私信数量", unit: "条", betterWhen: "up", defaultSource: "cron", description: "全平台收到的私信/咨询数。月底由 Claude 抓取各平台后台。" },
      { key: "new_followers", name: "新增粉丝", unit: "个", betterWhen: "up", defaultSource: "marketing", description: "全平台本月净增粉丝。来源:Marketing 系统。" },
      { key: "videos_published", name: "发布视频数", unit: "条", betterWhen: "up", defaultSource: "marketing", description: "本月发布的视频/笔记总数。来源:Marketing 发布中心。" },
      { key: "hit_videos", name: "爆款数", unit: "条", betterWhen: "up", defaultSource: "marketing", description: "本月评定为爆款的内容数。来源:Marketing 系统。" },
    ],
  },
  {
    key: "operations",
    name: "运营部",
    icon: "📊",
    metrics: [
      { key: "leads", name: "客资总数", unit: "个", betterWhen: "up", defaultSource: "marketing", description: "本月通过投流/内容获取的客资总数。" },
      { key: "ad_spend", name: "投流花费", unit: "$", format: "currency", betterWhen: "neutral", defaultSource: "marketing", description: "本月广告投放总花费。来源:Marketing 投流追踪。" },
      { key: "cost_per_lead", name: "单客资成本", unit: "$", format: "currency", betterWhen: "down", defaultSource: "marketing", description: "投流花费 ÷ 客资总数。越低越好。" },
      { key: "cost_per_open", name: "开口成本", unit: "$", format: "currency", betterWhen: "down", defaultSource: "manual", description: "总成本 ÷ 有效开口/对话数。越低越好。" },
    ],
  },
];

async function main() {
  // 1) Department + metric catalogue — always seeded, idempotent.
  for (let d = 0; d < CATALOGUE.length; d++) {
    const dept = CATALOGUE[d];
    const department = await prisma.department.upsert({
      where: { key: dept.key },
      update: { name: dept.name, icon: dept.icon, order: d },
      create: { key: dept.key, name: dept.name, icon: dept.icon, order: d },
    });

    for (let m = 0; m < dept.metrics.length; m++) {
      const mt = dept.metrics[m];
      await prisma.metric.upsert({
        where: { key: mt.key },
        update: {
          name: mt.name,
          unit: mt.unit ?? null,
          betterWhen: mt.betterWhen ?? "up",
          format: mt.format ?? "number",
          defaultSource: mt.defaultSource ?? "manual",
          description: mt.description ?? null,
          order: m,
          departmentId: department.id,
        },
        create: {
          key: mt.key,
          name: mt.name,
          unit: mt.unit ?? null,
          betterWhen: mt.betterWhen ?? "up",
          format: mt.format ?? "number",
          defaultSource: mt.defaultSource ?? "manual",
          description: mt.description ?? null,
          order: m,
          departmentId: department.id,
        },
      });
    }
  }
  console.log(`Seeded ${CATALOGUE.length} departments and their metric catalogue.`);

  // 2) Local admin — only when SSO is NOT active. With COOKIE_DOMAIN set, CRM is
  //    the sole identity provider and a local admin would just be an orphan row.
  if (process.env.COOKIE_DOMAIN) {
    console.log(`SSO active (COOKIE_DOMAIN=${process.env.COOKIE_DOMAIN}). Skipping local admin seed.`);
    return;
  }

  const username = process.env.SEED_ADMIN_USERNAME || "admin";
  const password = process.env.SEED_ADMIN_PASSWORD || "change-me-on-first-login";
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`Admin user '${username}' already exists, skipping.`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { username, passwordHash, displayName: "Management Admin", role: "admin" },
  });
  console.log(`Seeded local admin '${username}'. Change the password after first login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
