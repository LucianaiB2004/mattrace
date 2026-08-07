export function competitionMode(selectedCount) {
  if (selectedCount === 0) return { strict: false, label: "未选择文档" };
  if (selectedCount === 1) return { strict: true, label: "已选择 1 篇文档" };
  return { strict: true, label: `已选择 ${selectedCount} 篇文档` };
}
