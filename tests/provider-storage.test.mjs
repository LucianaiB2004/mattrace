import test from "node:test";
import assert from "node:assert/strict";
import { clearProviderKey, loadProvider, saveProvider } from "../app/domain/provider-storage.mjs";

const defaults = { gateway: "https://ai.chipcloud.cc", model: "qwen3.8-max", apiKey: "" };
function storage(initial = {}) { const data = new Map(Object.entries(initial)); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) }; }

test("provider storage uses defaults for missing or malformed state", () => {
  assert.deepEqual(loadProvider(storage(), defaults), defaults);
  assert.deepEqual(loadProvider(storage({ "mattrace.provider.v1": "{" }), defaults), defaults);
});

test("provider storage remembers applied browser credentials", () => {
  const target = storage();
  saveProvider(target, { gateway: " https://ai.chipcloud.cc/ ", model: " qwen3.8-max ", apiKey: " runtime-key " });
  assert.deepEqual(loadProvider(target, defaults), { gateway: "https://ai.chipcloud.cc", model: "qwen3.8-max", apiKey: "runtime-key" });
});

test("clearing the key keeps gateway and model", () => {
  const target = storage();
  saveProvider(target, { ...defaults, apiKey: "runtime-key" });
  assert.deepEqual(clearProviderKey(target, defaults), defaults);
  assert.deepEqual(loadProvider(target, defaults), defaults);
});
