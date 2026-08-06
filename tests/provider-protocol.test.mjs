import test from "node:test";
import assert from "node:assert/strict";

import { requestBody, requestUrl, responseText } from "../app/services/provider-protocol.mjs";

const messages = [{ role: "system", content: "contract" }, { role: "user", content: "evidence" }];
const agentPlan = { protocol: "openai-responses", gateway: "https://ark.cn-beijing.volces.com/api/plan/v3", model: "doubao-seed-evolving" };

test("Responses requests use the Agent Plan endpoint and input_text messages", () => {
  assert.equal(requestUrl(agentPlan), "https://ark.cn-beijing.volces.com/api/plan/v3/responses");
  const body = requestBody(agentPlan, messages, { maxTokens: 4096, stream: true });
  assert.equal(body.model, "doubao-seed-evolving");
  assert.equal(body.max_output_tokens, 4096);
  assert.equal(body.stream, true);
  assert.deepEqual(body.input[0], { role: "system", content: [{ type: "input_text", text: "contract" }] });
  assert.equal("messages" in body, false);
});

test("Chat requests retain the Chat Completions contract", () => {
  const config = { protocol: "openai-chat", gateway: "https://example.com", model: "chat-model" };
  assert.equal(requestUrl(config), "https://example.com/v1/chat/completions");
  const body = requestBody(config, messages, { maxTokens: 512, stream: false, json: true });
  assert.deepEqual(body.messages, messages);
  assert.equal(body.max_tokens, 512);
  assert.equal(body.response_format.type, "json_object");
});

test("Responses JSON extracts output_text and nested output content", async () => {
  assert.equal(await responseText("openai-responses", new Response(JSON.stringify({ output_text: "OK" }), { headers: { "content-type": "application/json" } })), "OK");
  assert.equal(await responseText("openai-responses", new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: "nested" }] }] }), { headers: { "content-type": "application/json" } })), "nested");
});

test("Responses SSE merges output text deltas", async () => {
  const response = new Response([
    `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "hel" })}\n\n`,
    `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "lo" })}\n\n`,
    `data: ${JSON.stringify({ type: "response.completed", response: { status: "completed" } })}\n\n`,
  ].join(""), { headers: { "content-type": "text/event-stream" } });
  assert.equal(await responseText("openai-responses", response), "hello");
});

test("Responses without output text fail explicitly", async () => {
  await assert.rejects(() => responseText("openai-responses", new Response("{}", { headers: { "content-type": "application/json" } })), /输出文本/);
});
