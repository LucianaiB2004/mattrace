export function competitionMode(selectedCount) {
  if (selectedCount === 0) return { strict: false, label: "未选择文档" };
  if (selectedCount >= 3 && selectedCount <= 10) return { strict: true, label: "比赛严格模式 · 3–10 篇" };
  return { strict: false, label: "演示模式 · 比赛要求 3–10 篇" };
}
