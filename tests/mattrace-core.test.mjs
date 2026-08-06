import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PROVIDER,
  advanceDemoState,
  createDemoState,
  serializeExport,
} from "../app/lib/mattrace-core.mjs";

test("uses the configured gateway and qwen model without a bundled key", () => {
  assert.deepEqual(DEFAULT_PROVIDER, {
    provider: "chipcloud",
    protocol: "openai-chat",
    gateway: "https://ai.chipcloud.cc",
    model: "qwen3.8-max",
    apiKey: "",
  });
});

test("advances the six-stage evidence workflow deterministically", () => {
  let state = createDemoState();
  assert.equal(state.activeStage, 0);
  assert.equal(state.stages.length, 6);

  for (let index = 0; index < 6; index += 1) {
    state = advanceDemoState(state);
  }

  assert.equal(state.activeStage, 5);
  assert.equal(state.status, "complete");
  assert.equal(state.records, 87);
});

test("serializes records as JSON, CSV, and Markdown", () => {
  const records = [
    {
      material: "Li₇La₃Zr₂O₁₂",
      process: "固相烧结",
      property: "离子电导率",
      value: "1.2 × 10⁻³ S/cm",
      condition: "25°C，阻抗法",
      source: "Adv. Mater. 2024, Table 1",
      confidence: "高",
    },
  ];

  assert.match(serializeExport("json", records), /"material": "Li₇La₃Zr₂O₁₂"/);
  assert.match(serializeExport("csv", records), /^材料体系,制备工艺,性能指标/m);
  assert.match(serializeExport("markdown", records), /^\| 材料体系 \| 制备工艺 \|/m);
});

test("rejects an unsupported export format", () => {
  assert.throws(() => serializeExport("xml", []), /Unsupported export format/);
});
