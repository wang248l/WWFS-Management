import { getJson } from "./team";

/**
 * 培训面板：每个员工的 skill 都在 wang248l/agent-skills 的一个文件夹里，「培训」= 在他的 project 里用 Claude 改这些文件。
 * 版本 = 文件夹最近一次提交（短 sha），上次培训 = 那次提交的时间。要 GITHUB_TOKEN 能读这个仓库，没配就只给链接。
 */
export const SKILL_REPO = process.env.SKILL_REPO || "wang248l/agent-skills";

export type SkillInfo = { folder: string; url: string; sha: string | null; date: string | null; message: string | null; commits: number | null };

export async function loadSkills(skills: string | null): Promise<{ connected: boolean; items: SkillInfo[] }> {
  const folders = (skills || "").split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  const token = process.env.GITHUB_TOKEN;
  const items = await Promise.all(
    folders.map(async (folder): Promise<SkillInfo> => {
      const base = { folder, url: `https://github.com/${SKILL_REPO}/tree/main/${folder}`, sha: null, date: null, message: null, commits: null };
      if (!token) return base;
      const r = await getJson<any[]>(`https://api.github.com/repos/${SKILL_REPO}/commits?path=${encodeURIComponent(folder)}&per_page=30`, {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
      });
      if (!r.ok || !r.data.length) return base;
      const c = r.data[0];
      return { ...base, sha: c.sha.slice(0, 7), date: c.commit?.committer?.date || null, message: (c.commit?.message || "").split("\n")[0], commits: r.data.length };
    }),
  );
  return { connected: !!token, items };
}
