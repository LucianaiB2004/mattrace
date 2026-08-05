import test from "node:test";
import assert from "node:assert/strict";
import { buildUpstreamHeaders, hasCompletedSse, responseHeaders } from "../scripts/proxy-transport.mjs";

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
});

test("proxy preserves compressed response metadata while allowing chunked forwarding", () => {
  const headers = responseHeaders({ "content-encoding": "gzip", "content-length": "99", "content-type": "application/json" });
  assert.equal(headers["content-encoding"], "gzip");
  assert.equal(headers["content-type"], "application/json");
  assert.equal(headers["content-length"], undefined);
});
