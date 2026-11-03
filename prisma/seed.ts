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

  // 1b) 团队看板的初始名单（2026-10-16 Wallace：「现在就是 Amelia，Ishan，MAC，Ryzen 四个员工，
  //     其中 MAC 和 Ryzen 是 AI agent」）。只在不存在时创建 —— 之后在看板「管理名单」页改的内容不会被覆盖。
  const STAFF = [
    { name: "Amelia", role: "出镜理财顾问", weeklyFilmMinutes: 300, order: 1 },
    { name: "Ishan", role: "出镜理财顾问", weeklyFilmMinutes: 300, order: 2 },
  ];
  for (const s of STAFF) {
    await prisma.staff.upsert({ where: { name: s.name }, update: {}, create: s });
  }
  const AGENTS = [
    {
      key: "mac",
      name: "MAC",
      host: "Mac",
      duty: "读取自动派稿，把各 IP 的脚本同步到各人的 Google Drive；字幕路径助手",
      schedule: "每天",
      everyHours: 24,
      tokenMatch: "mac",
      order: 1,
    },
    {
      key: "ryzen",
      name: "Ryzen",
      host: "Ryzen PC",
      duty: "口播剪辑、通过 ADB 控制手机发布到各平台",
      schedule: "每天",
      everyHours: 24,
      tokenMatch: "ryzen",
      order: 2,
    },
  ];
  for (const a of AGENTS) {
    await prisma.agent.upsert({ where: { key: a.key }, update: {}, create: a });
  }

  // 1c) WWFS办公室（2026-11-03 Wallace：「每个部门做一套管理系统」「每个人负责一个单独的工作空间」
  //     「Mark 的工作空间就是我们的 marketing 网站」）。新 agent 直接建；已有的只补空字段，名单页改过的不覆盖。
  //     看板上的起始任务只在这个 agent 一张卡都没有时放进去。
  const OFFICE: {
    key: string; name: string; department: string; title: string; avatar: string; tags?: string; skills?: string;
    workspaceUrl?: string; workspaceName?: string; duty?: string; host?: string; schedule?: string;
    everyHours?: number; tokenMatch?: string; persona?: string; order?: number;
    tasks: { title: string; status: string; note?: string }[];
  }[] = [
    {
      key: "mark", name: "Mark", department: "社媒运营部", title: "社交媒体总运营", avatar: "🧭", order: 0,
      skills: "wwfs-agent-socialops,wwfs-ops-daily,wwfs-daily-editor,wwfs-scriptgen-ip,wwfs-scriptgen-marketing",
      tags: "出稿,分配,数据分析",
      workspaceUrl: "https://marketing.wallacewang.ca", workspaceName: "Marketing 网站",
      duty: "社交媒体总运营：出稿、分配给各 IP、看数据做分析；Marketing 网站值班，处理不了的报告老板；留资客户移交销售",
      host: "Mac mini（与 Chase 共用）", schedule: "每天 07:35 / 12:35 / 17:35（温哥华）", everyHours: 8, tokenMatch: "mark",
      persona: "你是 Mark，WWFS 的社交媒体总运营，负责出稿、分配、数据分析，工作空间是 Marketing 网站（marketing.wallacewang.ca），跟负责剪辑发布的 Chase 共用一台 Mac mini。宣发全在线上，不做销售；有人留了联系方式就移交销售。",
      tasks: [
        { title: "每天三次值班：巡检 Marketing 网站任务和异常", status: "doing" },
        { title: "Marketing 日报（daily / daily-noon）迁到 Mac 跑", status: "todo" },
        { title: "每天报宣发数字：发布 / 曝光 / 新粉 / 私信 / 留资", status: "todo" },
      ],
    },
    {
      key: "leo", name: "Leo", department: "市场部", title: "产品推广 & 网课", avatar: "🎓", order: 1,
      skills: "wwfs-agent-pr,wwfs-scriptgen-longvideo",
      tags: "产品推广,网课",
      duty: "线上产品推广和网课：选题、大纲、推广素材、上线节奏；只做线上宣发，留资客户移交销售",
      host: "待定", schedule: "待定", everyHours: 24,
      persona: "你是 Leo，WWFS 的产品推广和网课负责人。你负责网课选题、大纲、推广素材和上线节奏。你的工作空间还在搭建中。宣发全在线上，不做销售；有人留了联系方式就移交销售。",
      tasks: [
        { title: "定第一门网课的主题和大纲", status: "todo" },
        { title: "列产品推广素材清单（短视频 / 海报 / 文案）", status: "todo" },
        { title: "搭 Leo 的工作空间（网课后台）", status: "todo" },
        { title: "每天报宣发数字：发布 / 曝光 / 新粉 / 私信 / 留资 / 网课报名", status: "todo" },
      ],
    },
    {
      key: "recruit", name: "增员员", department: "增员部", title: "增员专员 · LinkedIn", avatar: "🤝", order: 2,
      skills: "wwfs-agent-recruiter",
      tags: "找人,预热,约见",
      workspaceUrl: "https://www.linkedin.com/mynetwork/", workspaceName: "LinkedIn",
      duty: "在 LinkedIn 找持牌 / 快持牌的华人顾问和 CFP（先 AB），预热、约见；只讲职业平台，不讲副业收入",
      host: "Mac mini · Chrome Profile 5", schedule: "每天 06:10（批准后）", everyHours: 24,
      persona: "你是增员员，WWFS 的 LinkedIn 增员专员。你在 LinkedIn 上找加拿大持牌或快持牌的华人顾问和 CFP，先做阿尔伯塔，只讲职业平台，从不讲副业或收入承诺。每天最多 10 条消息、每周 60 个邀请。",
      tasks: [
        { title: "卡尔加里候选人入库（9 位，只读搜索）", status: "done" },
        { title: "每天自动发消息和邀请", status: "blocked", note: "等老板说「可以」才开始自动发送" },
      ],
    },
    {
      // 打卡 key 仍是 mac（Mac 上的脚本都用这个），名字 2026-11-03 起叫 Chase
      key: "mac", name: "Chase", department: "社媒运营部", title: "剪辑 & 发布", avatar: "🎬", order: 1,
      skills: "wwfs-edit-koubo,wwfs-publish-shortvideo,wwfs-covergen-finance,wwfs-covergen-lifestyle",
      tags: "剪辑,发布",
      workspaceUrl: "https://claude.ai/artifact/WydxxqTJb67qRmB3dLj2mn", workspaceName: "视频进度看板",
      duty: "口播剪辑（1080p60、封面、字幕）和各平台发布（手机 + 网页）",
      host: "Mac mini（与 Mark 共用）", schedule: "每天 06:47 剪辑 · 每小时发布",
      persona: "你是 Chase，WWFS 的剪辑和发布，跟 Mark 共用一台 Mac mini：每天自动剪口播、出 1080p60 成片、按排程发到各平台。Mark 出稿和分配，你负责剪和发。",
      tasks: [
        { title: "每天 06:47 自动剪口播", status: "doing" },
        { title: "英文内容每小时自动发布（P1 手机）", status: "doing" },
      ],
    },
    {
      key: "ryzen", name: "Ryzen", department: "内容部", title: "剪辑 & 发布（Windows）", avatar: "🖥️", order: 4,
      tasks: [],
    },
  ];
  // 2026-11-03 Wallace：「社交媒体总运营是 Mark……剪辑和发布叫 Chase，Chase 和 Mark 共用一台 Mac」。
  // 还是种子默认值的老行直接换成新资料（名单页改过的不动）。
  const RENAMED: Record<string, Record<string, string>> = { mac: { name: "MAC" }, mark: { title: "运营经理" } };
  for (const o of OFFICE) {
    const { tasks, ...fields } = o;
    let agent = await prisma.agent.findUnique({ where: { key: o.key } });
    const was = RENAMED[o.key];
    if (agent && was && Object.entries(was).every(([k, v]) => (agent as any)[k] === v)) {
      agent = await prisma.agent.update({
        where: { id: agent.id },
        data: { name: o.name, title: o.title, duty: o.duty, host: o.host, schedule: o.schedule, department: o.department, tags: o.tags, persona: o.persona },
      });
    }
    if (!agent) {
      agent = await prisma.agent.create({ data: { ...fields, everyHours: o.everyHours ?? 24 } });
    } else {
      const fill: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined && (agent as any)[k] == null) fill[k] = v;
      }
      if (Object.keys(fill).length) agent = await prisma.agent.update({ where: { id: agent.id }, data: fill });
    }
    if (tasks.length && (await prisma.agentTask.count({ where: { agentId: agent.id } })) === 0) {
      await prisma.agentTask.createMany({ data: tasks.map((t, i) => ({ ...t, agentId: agent!.id, order: i })) });
    }
  }
  for (const n of ["Amelia", "Ishan"]) {
    await prisma.staff.updateMany({
      where: { name: n, department: null },
      data: { department: "出镜顾问", workspaceUrl: "https://crm.wallacewang.ca" },
    });
  }

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
