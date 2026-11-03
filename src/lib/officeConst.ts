// 客户端组件也要用的常量，单独放，免得把 db 打进浏览器包。

export const TASK_COLUMNS = [
  { key: "todo", label: "待办", cls: "bg-stone-100 text-stone-700" },
  { key: "doing", label: "进行中", cls: "bg-blue-50 text-blue-700" },
  { key: "blocked", label: "卡住", cls: "bg-red-50 text-red-700" },
  // 留了联系方式的客户：宣发只到这里，后面交给销售（销售位目前招聘中）
  { key: "handoff", label: "移交销售", cls: "bg-violet-50 text-violet-700" },
  { key: "done", label: "完成", cls: "bg-emerald-50 text-emerald-700" },
] as const;
export type TaskStatus = (typeof TASK_COLUMNS)[number]["key"];
export const isTaskStatus = (s: unknown): s is TaskStatus => TASK_COLUMNS.some((c) => c.key === s);
