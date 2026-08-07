import test from "node:test";
import assert from "node:assert/strict";

import { analyzeDocument, requestGateway, testProvider } from "../app/services/ai-client.mjs";

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

test("local MatTrace routes the default gateway through its CORS proxy", () => {
  assert.equal(requestGateway("https://ai.chipcloud.cc", { hostname: "localhost" }), "http://127.0.0.1:8788/chipcloud");
  assert.equal(requestGateway("https://ark.cn-beijing.volces.com/api/plan/v3", { hostname: "localhost" }), "http://127.0.0.1:8788/ark-plan");
  assert.equal(requestGateway("https://ai.chipcloud.cc", { hostname: "example.github.io" }), "https://ai.chipcloud.cc");
  assert.equal(requestGateway("https://other.example", { hostname: "localhost" }), "https://other.example");
});

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

test("Responses provider test reserves enough output for reasoning models", async () => {
  let request;
  const result = await testProvider({
    gateway: "https://ark.cn-beijing.volces.com/api/plan/v3",
    model: "doubao-seed-evolving",
    apiKey: "runtime-only-key",
    protocol: "openai-responses",
  }, async (url, init) => {
    request = { url, init };
    return response(200, { output_text: "OK" });
  });

  assert.equal(result.ok, true);
  assert.equal(request.url, "https://ark.cn-beijing.volces.com/api/plan/v3/responses");
  assert.equal(JSON.parse(request.init.body).max_output_tokens, 128);
});

test("Responses document analysis reserves output beyond the reasoning budget", async () => {
  let requestBody;
  await analyzeDocument({
    gateway: "https://ark.cn-beijing.volces.com/api/plan/v3",
    model: "doubao-seed-evolving",
    apiKey: "runtime-only-key",
    protocol: "openai-responses",
  }, documents[0], async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return response(200, { output_text: JSON.stringify({ status: "no_evidence", checkedPages: [1], reason: "No quantitative evidence." }) });
  });

  assert.equal(requestBody.max_output_tokens, 32768);
});

test("analysis posts document evidence and returns a normalized report", async () => {
  let requestBody;
  const result = await analyzeDocument(
    config,
    documents[0],
    async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return response(200, {
        choices: [{ message: { content: "```json\n{\"status\":\"extracted\",\"checkedPages\":[1],\"records\":[{\"material\":\"LLZO\",\"process\":\"固相烧结\",\"property\":\"离子电导率\",\"value\":1.2,\"unit\":\"mS/cm\",\"conditions\":{\"temperature\":\"25°C\",\"method\":\"EIS\",\"frequency_range\":\"1 Hz-1 MHz\"},\"sourceDocument\":\"paper.txt\",\"page\":1,\"evidence\":\"LLZO conductivity is 1.2 mS/cm at 25°C.\",\"confidence\":\"high\"}]}\n```" } }],
      });
    },
  );

  assert.equal(requestBody.model, "qwen3.8-max");
  assert.match(requestBody.messages[1].content, /paper\.txt/);
  assert.equal(result.status, "extracted");
  assert.equal(result.records[0].normalizedValue, 0.0012);
});

test("analysis reports malformed model output without exposing the API key", async () => {
  await assert.rejects(
    () => analyzeDocument(config, documents[0], async () =>
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
    () => analyzeDocument(config, documents[0], async () => { throw aborted; }),
    (error) => error.name === "AbortError",
  );
});

test("single-document analysis supports an explicit no-evidence outcome", async () => {
  const result = await analyzeDocument(config, documents[0], async () => response(200, {
    choices: [{ message: { content: JSON.stringify({
      status: "no_evidence",
      checkedPages: [1],
      reason: "全文未发现定量材料性能记录",
      records: [],
    }) } }],
  }));
  assert.equal(result.status, "no_evidence");
  assert.deepEqual(result.checkedPages, [1]);
  assert.equal(result.records.length, 0);
});

test("single-document analysis never invents checked pages when the model omits them", async () => {
  const result = await analyzeDocument(config, documents[0], async () => response(200, {
    choices: [{ message: { content: JSON.stringify({ status: "no_evidence", records: [], reason: "未发现证据" }) } }],
  }));
  assert.deepEqual(result.checkedPages, []);
});

test("single-document analysis rejects model page claims outside submitted evidence", async () => {
  const result = await analyzeDocument(config, documents[0], async () => response(200, {
    choices: [{ message: { content: JSON.stringify({ status: "no_evidence", checkedPages: [1, 99], records: [], reason: "未发现证据" }) } }],
  }));
  assert.deepEqual(result.checkedPages, [1]);
});

test("single-document analysis drops records that cite pages outside submitted evidence", async () => {
  const result = await analyzeDocument(config, documents[0], async () => response(200, {
    choices: [{ message: { content: JSON.stringify({
      status: "extracted", checkedPages: [1, 99], records: [
        { material: "LLZO", process: "固相烧结", property: "离子电导率", value: 1.2, unit: "mS/cm", conditions: { temperature: "25°C", method: "EIS", frequency_range: "1 Hz-1 MHz" }, sourceDocument: "paper.txt", page: 1, evidence: "LLZO conductivity is 1.2 mS/cm at 25°C." },
        { material: "LATP", process: "固相烧结", property: "离子电导率", value: 9.9, unit: "mS/cm", conditions: { temperature: "25°C", method: "EIS", frequency_range: "1 Hz-1 MHz" }, sourceDocument: "paper.txt", page: 99, evidence: "LATP conductivity is 9.9 mS/cm at 25°C." },
      ],
    }) } }],
  }));
  assert.deepEqual(result.checkedPages, [1]);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].material, "LLZO");
});

test("single-document analysis downgrades evidence text absent from the submitted excerpt", async () => {
  const result = await analyzeDocument(config, documents[0], async () => response(200, {
    choices: [{ message: { content: JSON.stringify({
      status: "extracted", checkedPages: [1], records: [{
        material: "LLZO", process: "固相烧结", property: "离子电导率", value: 9.9, unit: "mS/cm",
        conditions: { temperature: "25°C", method: "EIS", frequency_range: "1 Hz-1 MHz" },
        sourceDocument: "paper.txt", page: 1, evidence: "LLZO conductivity is 9.9 mS/cm at 25°C.",
      }],
    }) } }],
  }));
  assert.equal(result.records[0].confidence, "low");
  assert.equal(result.records[0].reviewRequired, true);
  assert.match(result.records[0].confidenceReasons.join(" "), /提交的原文片段/);
});

test("single-document analysis merges an OpenAI-compatible SSE response", async () => {
  let requestBody;
  const json = JSON.stringify({ status: "extracted", checkedPages: [1], records: [{ material: "LLZO", process: "固相烧结", property: "离子电导率", value: 1.2, unit: "mS/cm", conditions: { temperature: "25°C" }, sourceDocument: "paper.txt", page: 1, evidence: "LLZO conductivity is 1.2 mS/cm at 25°C.", confidence: "high" }] });
  const midpoint = Math.floor(json.length / 2);
  const result = await analyzeDocument(config, documents[0], async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response([
      `data: ${JSON.stringify({ choices: [{ delta: { content: json.slice(0, midpoint) } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: json.slice(midpoint) } }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join(""), { status: 200, headers: { "content-type": "text/event-stream" } });
  });
  assert.equal(requestBody.stream, true);
  assert.equal(requestBody.enable_thinking, false);
  assert.equal(requestBody.max_tokens, 8192);
  assert.equal(result.status, "extracted");
  assert.equal(result.records[0].material, "LLZO");
});
