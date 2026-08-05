import test from "node:test";
import assert from "node:assert/strict";
import { buildUpstreamHeaders, responseHeaders } from "../scripts/proxy-transport.mjs";

test("proxy uses browser-compatible headers for long gateway completions", () => {
  const headers = buildUpstreamHeaders({ authorization: "Bearer runtime", "content-type": "application/json" }, 42);
  assert.match(headers["User-Agent"], /Mozilla/);
  assert.match(headers["Accept-Encoding"], /gzip/);
  assert.equal(headers["Content-Length"], 42);
});

test("proxy preserves compressed response metadata while allowing chunked forwarding", () => {
  const headers = responseHeaders({ "content-encoding": "gzip", "content-length": "99", "content-type": "application/json" });
  assert.equal(headers["content-encoding"], "gzip");
  assert.equal(headers["content-type"], "application/json");
  assert.equal(headers["content-length"], undefined);
});
