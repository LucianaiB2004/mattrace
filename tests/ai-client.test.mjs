import test from "node:test";
import assert from "node:assert/strict";

import { analyzeDocuments, testProvider } from "../app/services/ai-client.mjs";

const config = {
  gateway: "https://ai.chipcloud.cc/",
  model: "qwen3.8-max",
  apiKey: "runtime-only-key",
};

const documents = [{
  id: "doc-1",
  name: "paper.txt",
  type: "txt",
  size: 50,
  pageCount: 1,
  text: "LLZO conductivity is 1.2 mS/cm at 25°C.",
  pages: [{ page: 1, text: "LLZO conductivity is 1.2 mS/cm at 25°C." }],
}];

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
    async text() { return typeof body === "string" ? body : JSON.stringify(body); },
  };
}

test("provider test normalizes the models URL and sends bearer authorization", async () => {
  let request;
  const result = await testProvider(config, async (url, init) => {
    request = { url, init };
    return response(200, { data: [{ id: "qwen3.8-max" }] });
  });

  assert.equal(result.ok, true);
  assert.equal(request.url, "https://ai.chipcloud.cc/v1/models");
  assert.equal(request.init.headers.Authorization, "Bearer runtime-only-key");
});

test("provider test falls back to a minimal chat request when models is unsupported", async () => {
  const requests = [];
  const result = await testProvider(config, async (url, init) => {
    requests.push({ url, init });
    if (url.endsWith("/models")) return response(404, { error: "not found" });
    return response(200, { choices: [{ message: { content: "OK" } }] });
  });

  assert.equal(result.ok, true);
  assert.equal(requests[1].url, "https://ai.chipcloud.cc/v1/chat/completions");
  assert.equal(JSON.parse(requests[1].init.body).max_tokens, 8);
});

test("analysis posts document evidence and returns a normalized report", async () => {
  let requestBody;
  const stages = [];
  const result = await analyzeDocuments(
    config,
    documents,
    async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return response(200, {
        choices: [{ message: { content: "```json\n{\"records\":[{\"material\":\"LLZO\",\"process\":\"固相烧结\",\"property\":\"离子电导率\",\"value\":1.2,\"unit\":\"mS/cm\",\"conditions\":{\"temperature\":\"25°C\"},\"sourceDocument\":\"paper.txt\",\"page\":1,\"evidence\":\"LLZO conductivity is 1.2 mS/cm at 25°C.\",\"confidence\":\"high\"}]}\n```" } }],
      });
    },
    undefined,
    (stage) => stages.push(stage),
  );

  assert.equal(requestBody.model, "qwen3.8-max");
  assert.equal(requestBody.max_tokens, 512);
  assert.equal(requestBody.response_format.type, "json_object");
  assert.match(requestBody.messages[1].content, /paper\.txt/);
  assert.equal(result.records[0].normalizedValue, 0.0012);
  assert.deepEqual(stages, [0, 1, 2, 3, 4, 5]);
});

test("analysis reports malformed model output without exposing the API key", async () => {
  await assert.rejects(
    () => analyzeDocuments(config, documents, async () =>
      response(200, { choices: [{ message: { content: "not json runtime-only-key" } }] }),
    ),
    (error) => {
      assert.match(error.message, /模型返回格式无效/);
      assert.equal(error.message.includes("runtime-only-key"), false);
      return true;
    },
  );
});

test("analysis preserves AbortError so the UI can distinguish cancellation", async () => {
  const aborted = new DOMException("Aborted", "AbortError");
  await assert.rejects(
    () => analyzeDocuments(config, documents, async () => { throw aborted; }),
    (error) => error.name === "AbortError",
  );
});
