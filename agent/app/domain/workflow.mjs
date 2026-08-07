const VALID_PHASES = new Set([
  "idle",
  "parsing",
  "ready",
  "analyzing",
  "success",
  "cancelled",
  "error",
]);

export function createWorkflowState() {
  return {
    phase: "idle",
    mode: null,
    activeStage: 0,
    documentCount: 0,
    reportId: null,
    error: null,
  };
}

export function transitionWorkflow(state, event) {
  if (!VALID_PHASES.has(state.phase)) throw new Error("工作流状态无效");
  switch (event.type) {
    case "PARSE_STARTED":
      return { ...state, phase: "parsing", error: null };
    case "PARSE_SUCCEEDED":
      return { ...state, phase: "ready", documentCount: event.documentCount, error: null };
    case "PARSE_FAILED":
      return { ...state, phase: "error", error: event.error || "文档解析失败" };
    case "ANALYSIS_STARTED":
      return { ...state, phase: "analyzing", mode: event.mode, activeStage: 0, reportId: null, error: null };
    case "STAGE_CHANGED":
      if (!Number.isInteger(event.stage) || event.stage < 0 || event.stage > 5) {
        throw new Error("阶段索引必须在 0 到 5 之间");
      }
      return { ...state, activeStage: event.stage };
    case "ANALYSIS_SUCCEEDED":
      return { ...state, phase: "success", activeStage: 5, reportId: event.reportId, error: null };
    case "ANALYSIS_FAILED":
      return { ...state, phase: "error", error: event.error || "分析失败" };
    case "ANALYSIS_CANCELLED":
      return { ...state, phase: "cancelled", error: null };
    case "RESET":
      return createWorkflowState();
    default:
      throw new Error(`未知工作流事件：${event.type}`);
  }
}
