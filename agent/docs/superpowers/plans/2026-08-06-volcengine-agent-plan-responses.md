# Volcengine Agent Plan Responses Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a selectable Volcengine Ark Agent Plan provider that calls `doubao-seed-evolving` through the OpenAI-compatible Responses API without regressing the existing Chat Completions provider.

**Architecture:** Extend the persisted provider object with a protocol discriminator and central preset catalog. Keep scientific normalization unchanged; a focused protocol adapter in the AI client converts requests and extracts Chat Completions or Responses text before the existing validator. Extend the localhost proxy with two fixed upstream route prefixes rather than an open proxy.

**Tech Stack:** React 19, TypeScript, ECMAScript modules, Fetch API, OpenAI-compatible Responses API, Node HTTP proxy, node:test, Playwright.

## Global Constraints

- Existing ChipCloud `openai-chat` behavior remains available.
- Agent Plan uses `https://ark.cn-beijing.volces.com/api/plan/v3`, `openai-responses`, and `doubao-seed-evolving`.
- API Keys remain browser-only and must not enter source files, logs, exports, Skill files, snapshots, or Git history.
- Local proxy upstreams are fixed allowlisted constants; no arbitrary target URL is accepted.
- Responses output must pass the existing page, quote, conditions, confidence, and comparability checks.
- No new runtime dependency is required.

---

### Task 1: Provider presets and persisted protocol migration

**Files:**
- Create: `app/domain/provider-presets.mjs`
- Modify: `app/domain/provider-storage.mjs`
- Modify: `app/lib/mattrace-core.mjs`
- Modify: `app/components/SettingsDialog.tsx`
- Modify: `app/MatTraceDashboard.tsx`
- Test: `tests/provider-storage.test.mjs`
- Test: `tests/provider-presets.test.mjs`

**Interfaces:**
- Produces: `PROVIDER_PRESETS`, `providerPreset(id)`, and provider objects shaped as `{ provider, protocol, gateway, model, apiKey }`.
- Consumes: existing `loadProvider`, `saveProvider`, and `DEFAULT_PROVIDER` callers.

- [ ] **Step 1: Write failing preset and migration tests**

```js
assert.deepEqual(providerPreset("volcengine-agent-plan"), {
  provider: "volcengine-agent-plan",
  protocol: "openai-responses",
  gateway: "https://ark.cn-beijing.volces.com/api/plan/v3",
  model: "doubao-seed-evolving",
});
assert.equal(loadProvider(storageWithLegacyChatConfig, defaults).protocol, "openai-chat");
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/provider-storage.test.mjs tests/provider-presets.test.mjs`
Expected: FAIL because preset and protocol migration do not exist.

- [ ] **Step 3: Implement catalog, migration, and UI selector**

```js
export const PROVIDER_PRESETS = Object.freeze([
  { id: "chipcloud", label: "ChipCloud", protocol: "openai-chat", gateway: "https://ai.chipcloud.cc", model: "qwen3.8-max" },
  { id: "volcengine-agent-plan", label: "火山方舟 Agent Plan", protocol: "openai-responses", gateway: "https://ark.cn-beijing.volces.com/api/plan/v3", model: "doubao-seed-evolving" },
  { id: "custom", label: "自定义 OpenAI Chat", protocol: "openai-chat", gateway: "", model: "" },
]);
```

The selector applies gateway/model/protocol without embedding a key. Changing provider clears the current report in the dashboard.

- [ ] **Step 4: Run focused tests and commit**

Run: `node --test tests/provider-storage.test.mjs tests/provider-presets.test.mjs`
Expected: PASS.

Commit: `feat: add Agent Plan provider preset`

### Task 2: OpenAI Responses request and response adapter

**Files:**
- Create: `app/services/provider-protocol.mjs`
- Modify: `app/services/ai-client.mjs`
- Test: `tests/provider-protocol.test.mjs`
- Test: `tests/ai-client.test.mjs`

**Interfaces:**
- Produces: `requestUrl(config)`, `requestBody(config, messages, options)`, and `responseText(protocol, response)`.
- Consumes: normalized provider config and existing analysis message arrays.

- [ ] **Step 1: Write failing Responses adapter tests**

```js
assert.equal(requestUrl(agentPlan), "https://ark.cn-beijing.volces.com/api/plan/v3/responses");
assert.deepEqual(requestBody(agentPlan, messages, { maxTokens: 4096 }).input[0], {
  role: "system",
  content: [{ type: "input_text", text: messages[0].content }],
});
assert.equal(await responseText("openai-responses", jsonResponse({ output_text: "OK" })), "OK");
```

Add an SSE case with `response.output_text.delta` events and a missing-output error case.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/provider-protocol.test.mjs tests/ai-client.test.mjs`
Expected: FAIL because the adapter is missing and Agent Plan still targets Chat Completions.

- [ ] **Step 3: Implement the protocol adapter and use it for connection and analysis**

```js
export function requestUrl(config) {
  const root = String(config.gateway).replace(/\/+$/, "");
  return config.protocol === "openai-responses" ? `${root}/responses` : `${root.endsWith("/v1") ? root : `${root}/v1`}/chat/completions`;
}
```

Responses requests use `input`, `max_output_tokens`, and `stream`; Chat requests retain `messages`, `max_tokens`, and `response_format`. Both response paths return a plain text string to `extractJsonObject`, after which all existing scientific validation remains unchanged.

- [ ] **Step 4: Run focused tests and commit**

Run: `node --test tests/provider-protocol.test.mjs tests/ai-client.test.mjs`
Expected: PASS for Chat JSON/SSE and Responses JSON/SSE.

Commit: `feat: support OpenAI Responses protocol`

### Task 3: Fixed-upstream localhost proxy routing

**Files:**
- Modify: `scripts/local-ai-proxy.mjs`
- Modify: `scripts/proxy-transport.mjs`
- Modify: `app/services/ai-client.mjs`
- Test: `tests/local-ai-proxy.test.mjs`
- Test: `tests/ai-client.test.mjs`

**Interfaces:**
- Produces local routes `/chipcloud/*` and `/ark-plan/*` on `http://127.0.0.1:8788`.
- Consumes browser-visible provider gateways; `requestGateway` maps only the two known gateways while localhost is active.

- [ ] **Step 1: Write failing routing allowlist tests**

```js
assert.deepEqual(resolveUpstream("/ark-plan/responses"), {
  origin: "https://ark.cn-beijing.volces.com",
  pathname: "/api/plan/v3/responses",
});
assert.equal(resolveUpstream("/https://evil.example"), null);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/local-ai-proxy.test.mjs tests/ai-client.test.mjs`
Expected: FAIL because the proxy currently has one hard-coded upstream.

- [ ] **Step 3: Implement fixed route resolution**

```js
const ROUTES = Object.freeze({
  "/chipcloud": { origin: "https://ai.chipcloud.cc", basePath: "" },
  "/ark-plan": { origin: "https://ark.cn-beijing.volces.com", basePath: "/api/plan/v3" },
});
```

Reject unknown prefixes and preserve the existing localhost Origin checks, secret-free logging behavior, streaming transport, and response headers.

- [ ] **Step 4: Run focused tests and commit**

Run: `node --test tests/local-ai-proxy.test.mjs tests/ai-client.test.mjs`
Expected: PASS.

Commit: `feat: proxy Agent Plan on localhost`

### Task 4: Documentation, browser behavior, and real verification

**Files:**
- Modify: `README.md`
- Modify: `tests/e2e/mattrace.spec.ts`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes all provider UI, protocol, and proxy behavior from Tasks 1–3.
- Produces reviewer-visible usage instructions and end-to-end proof.

- [ ] **Step 1: Add failing browser assertions**

```ts
await settings.getByLabel("供应商预设").selectOption("volcengine-agent-plan");
await expect(settings.getByLabel("API 网关")).toHaveValue("https://ark.cn-beijing.volces.com/api/plan/v3");
await expect(settings.getByLabel("模型名称")).toHaveValue("doubao-seed-evolving");
```

Mock `/ark-plan/responses` once with JSON and once with Responses SSE; assert provider persistence and evidence output.

- [ ] **Step 2: Run targeted browser test and verify RED**

Run: `npx playwright test -g "Agent Plan"`
Expected: FAIL before the selector and Responses route are wired.

- [ ] **Step 3: Finish UI copy and README**

Document both providers, Responses endpoint, local proxy mapping, browser-only key storage, CORS limitation for static hosting, and model name. Do not include a credential.

- [ ] **Step 4: Run automated verification**

Run:

```powershell
npm test
npm run lint
npm run test:e2e
npm run test:e2e:static
```

Expected: all commands exit 0.

- [ ] **Step 5: Perform real browser verification without persisting secrets to disk**

Start the app and local proxy, choose the Agent Plan preset, enter the user-supplied credential through the browser UI, test the connection, analyze three bundled papers, verify coverage/evidence results, then run a repository secret scan. Browser localStorage may retain the credential; no screenshot, trace, console output, file, or commit may contain it.

- [ ] **Step 6: Commit**

Commit: `docs: document Agent Plan provider`

