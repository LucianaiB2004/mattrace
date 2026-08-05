import test from "node:test";
import assert from "node:assert/strict";

import {
  createWorkflowState,
  transitionWorkflow,
} from "../app/domain/workflow.mjs";

test("workflow follows parsing, ready, analyzing, and success phases", () => {
  let state = createWorkflowState();
  state = transitionWorkflow(state, { type: "PARSE_STARTED" });
  assert.equal(state.phase, "parsing");
  state = transitionWorkflow(state, { type: "PARSE_SUCCEEDED", documentCount: 3 });
  assert.equal(state.phase, "ready");
  assert.equal(state.documentCount, 3);
  state = transitionWorkflow(state, { type: "ANALYSIS_STARTED", mode: "real" });
  state = transitionWorkflow(state, { type: "STAGE_CHANGED", stage: 3 });
  assert.equal(state.activeStage, 3);
  state = transitionWorkflow(state, { type: "ANALYSIS_SUCCEEDED", reportId: "report-new" });
  assert.equal(state.phase, "success");
  assert.equal(state.reportId, "report-new");
});

test("starting a new run clears stale report and errors", () => {
  const old = {
    ...createWorkflowState(),
    phase: "error",
    error: "旧错误",
    reportId: "report-old",
  };
  const next = transitionWorkflow(old, { type: "ANALYSIS_STARTED", mode: "example" });
  assert.equal(next.phase, "analyzing");
  assert.equal(next.reportId, null);
  assert.equal(next.error, null);
  assert.equal(next.activeStage, 0);
});

test("workflow supports cancellation and retry without losing parsed documents", () => {
  let state = { ...createWorkflowState(), phase: "analyzing", documentCount: 4 };
  state = transitionWorkflow(state, { type: "ANALYSIS_CANCELLED" });
  assert.equal(state.phase, "cancelled");
  assert.equal(state.documentCount, 4);
  state = transitionWorkflow(state, { type: "ANALYSIS_STARTED", mode: "real" });
  assert.equal(state.phase, "analyzing");
  assert.equal(state.documentCount, 4);
});

test("workflow rejects impossible stage indexes", () => {
  assert.throws(
    () => transitionWorkflow(createWorkflowState(), { type: "STAGE_CHANGED", stage: 6 }),
    /阶段索引必须在 0 到 5 之间/,
  );
});
