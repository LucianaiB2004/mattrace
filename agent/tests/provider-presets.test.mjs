import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_PROVIDER, providerPreset, resolveProviderPreset } from "../app/domain/provider-presets.mjs";

test("default provider is the ChipCloud preset with no bundled key", () => {
  assert.deepEqual(DEFAULT_PROVIDER, {
    provider: "chipcloud",
    label: "ChipCloud",
    protocol: "openai-chat",
    gateway: "https://ai.chipcloud.cc",
    model: "qwen3.8-max",
    apiKey: "",
  });
});

test("Agent Plan preset uses the Responses endpoint base and evolving model", () => {
  assert.deepEqual(providerPreset("volcengine-agent-plan"), {
    provider: "volcengine-agent-plan",
    label: "火山方舟 Agent Plan",
    protocol: "openai-responses",
    gateway: "https://ark.cn-beijing.volces.com/api/plan/v3",
    model: "doubao-seed-evolving",
  });
});

test("provider resolution recognizes presets and keeps unknown endpoints custom", () => {
  assert.equal(resolveProviderPreset("https://ai.chipcloud.cc", "openai-chat"), "chipcloud");
  assert.equal(resolveProviderPreset("https://ark.cn-beijing.volces.com/api/plan/v3", "openai-responses"), "volcengine-agent-plan");
  assert.equal(resolveProviderPreset("https://example.com/v3", "openai-chat"), "custom");
});
