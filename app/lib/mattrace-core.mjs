export const DEFAULT_PROVIDER = Object.freeze({
  provider: "chipcloud",
  protocol: "openai-chat",
  gateway: "https://ai.chipcloud.cc",
  model: "qwen3.8-max",
  apiKey: "",
});

const STAGES = [
  "文献解析",
  "数据提取",
  "单位规范化",
  "条件核验",
  "冲突检测",
  "报告生成",
];

export function createDemoState() {
  return {
    activeStage: 0,
    stages: STAGES.map((label, index) => ({
      label,
      status: index === 0 ? "active" : "pending",
    })),
    status: "running",
    records: 0,
  };
}

export function advanceDemoState(state) {
  const nextIndex = Math.min(state.activeStage + 1, STAGES.length - 1);
  const complete = state.activeStage >= STAGES.length - 1;

  return {
    ...state,
    activeStage: nextIndex,
    status: complete ? "complete" : "running",
    records: complete ? 87 : Math.round((nextIndex / (STAGES.length - 1)) * 87),
    stages: STAGES.map((label, index) => ({
      label,
      status:
        complete || index < nextIndex
          ? "complete"
          : index === nextIndex
            ? "active"
            : "pending",
    })),
  };
}

const HEADERS = {
  material: "材料体系",
  process: "制备工艺",
  property: "性能指标",
  value: "数值（单位）",
  condition: "测试条件",
  source: "来源",
  confidence: "可信度",
};

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeExport(format, records) {
  const keys = Object.keys(HEADERS);

  if (format === "json") {
    return JSON.stringify(records, null, 2);
  }

  if (format === "csv") {
    return [
      keys.map((key) => HEADERS[key]).join(","),
      ...records.map((record) => keys.map((key) => csvCell(record[key])).join(",")),
    ].join("\n");
  }

  if (format === "markdown") {
    return [
      `| ${keys.map((key) => HEADERS[key]).join(" | ")} |`,
      `| ${keys.map(() => "---").join(" | ")} |`,
      ...records.map(
        (record) =>
          `| ${keys.map((key) => String(record[key] ?? "").replaceAll("|", "\\|")).join(" | ")} |`,
      ),
    ].join("\n");
  }

  throw new Error(`Unsupported export format: ${format}`);
}
