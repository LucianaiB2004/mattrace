export const PROVIDER_PRESETS = Object.freeze([
  Object.freeze({ provider: "chipcloud", label: "ChipCloud", protocol: "openai-chat", gateway: "https://ai.chipcloud.cc", model: "qwen3.8-max" }),
  Object.freeze({ provider: "volcengine-agent-plan", label: "火山方舟 Agent Plan", protocol: "openai-responses", gateway: "https://ark.cn-beijing.volces.com/api/plan/v3", model: "doubao-seed-evolving" }),
  Object.freeze({ provider: "custom", label: "自定义 OpenAI 接口", protocol: "openai-chat", gateway: "", model: "" }),
]);

// The first preset, with no bundled key. API keys live only in the browser.
export const DEFAULT_PROVIDER = Object.freeze({ ...PROVIDER_PRESETS[0], apiKey: "" });

export function providerPreset(id) {
  const preset = PROVIDER_PRESETS.find((item) => item.provider === id);
  return preset ? { ...preset } : null;
}

export function resolveProviderPreset(gateway, protocol) {
  const clean = String(gateway ?? "").trim().replace(/\/+$/, "");
  return PROVIDER_PRESETS.find((item) => item.provider !== "custom" && item.gateway === clean && item.protocol === protocol)?.provider ?? "custom";
}
