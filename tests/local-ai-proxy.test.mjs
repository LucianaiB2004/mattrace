import test from "node:test";
import assert from "node:assert/strict";
import { buildUpstreamHeaders, hasCompletedSse, resolveUpstream, responseHeaders } from "../scripts/proxy-transport.mjs";

test("proxy resolves only fixed ChipCloud and Agent Plan routes", () => {
  assert.deepEqual(resolveUpstream("/ark-plan/responses"), { origin: "https://ark.cn-beijing.volces.com", pathname: "/api/plan/v3/responses" });
  assert.deepEqual(resolveUpstream("/chipcloud/v1/models"), { origin: "https://ai.chipcloud.cc", pathname: "/v1/models" });
  assert.equal(resolveUpstream("/https://evil.example"), null);
  assert.equal(resolveUpstream("/ark-plan/unknown"), null);
});

test("proxy uses browser-compatible headers for long gateway completions", () => {
  const headers = buildUpstreamHeaders({ authorization: "Bearer runtime", "content-type": "application/json" }, 42);
  assert.match(headers["User-Agent"], /Mozilla/);
  assert.match(headers["Accept-Encoding"], /gzip/);
  assert.equal(headers["Content-Length"], 42);
});

test("proxy requests identity encoding when it must inspect an SSE completion marker", () => {
  const headers = buildUpstreamHeaders({ authorization: "Bearer runtime", "content-type": "application/json" }, 42, true);
  assert.equal(headers["Accept-Encoding"], "identity");
});

test("proxy treats the SSE done marker as a complete upstream response", () => {
  assert.equal(hasCompletedSse("data: {\"choices\":[]}\n\ndata: [DONE]\n\n"), true);
  assert.equal(hasCompletedSse("data: {\"choices\":[]}"), false);
  assert.equal(hasCompletedSse('data: {"type":"response.completed"}\n\n'), true);
});

test("proxy preserves compressed response metadata while allowing chunked forwarding", () => {
  const headers = responseHeaders({ "content-encoding": "gzip", "content-length": "99", "content-type": "application/json" });
  assert.equal(headers["content-encoding"], "gzip");
  assert.equal(headers["content-type"], "application/json");
  assert.equal(headers["content-length"], undefined);
});
