import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { buildUpstreamHeaders, hasCompletedSse, resolveUpstream, responseHeaders } from "./proxy-transport.mjs";

const port = Number(process.argv[2] || 8788);

// The proxy binds to loopback, so only local pages can reach it. Accept any
// loopback origin (localhost / 127.0.0.1 / 0.0.0.0), regardless of port.
function isLoopbackOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1";
  } catch {
    return false;
  }
}

function corsHeaders(origin) {
  return {
    ...(isLoopbackOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function requestUpstream(url, options, body) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const upstreamRequest = httpsRequest(url, options, (upstreamResponse) => {
      const chunks = [];
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve({ status: upstreamResponse.statusCode || 502, headers: upstreamResponse.headers, body: Buffer.concat(chunks) });
      };
      upstreamResponse.on("data", (chunk) => {
        chunks.push(chunk);
        if (String(upstreamResponse.headers["content-type"] ?? "").includes("text/event-stream") && hasCompletedSse(Buffer.concat(chunks))) {
          finish();
          upstreamResponse.destroy();
        }
      });
      upstreamResponse.on("end", finish);
    });
    upstreamRequest.on("error", (error) => { if (!settled) reject(error); });
    // Reasoning models can take several minutes per document for extraction;
    // the local proxy just relays a single user, so allow a long ceiling.
    upstreamRequest.setTimeout(600_000, () => upstreamRequest.destroy(new Error("Upstream timeout")));
    if (body.length) upstreamRequest.write(body);
    upstreamRequest.end();
  });
}

createServer(async (request, response) => {
  const origin = request.headers.origin || "";
  const cors = corsHeaders(origin);
  const upstream = resolveUpstream(request.url);
  if (request.method === "OPTIONS") {
    response.writeHead(204, cors);
    response.end();
    return;
  }
  if (!isLoopbackOrigin(origin) || !upstream) {
    response.writeHead(403, { ...cors, "Content-Type": "application/json" });
    response.end('{"error":{"message":"Local proxy only accepts MatTrace localhost requests"}}');
    return;
  }
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const requestBody = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
    const streaming = requestBody.includes(Buffer.from('"stream":true'));
    const upstreamResponse = await requestUpstream(`${upstream.origin}${upstream.pathname}`, {
      method: request.method,
      headers: buildUpstreamHeaders(request.headers, requestBody.length, streaming),
    }, requestBody);
    const headers = responseHeaders(upstreamResponse.headers);
    response.writeHead(upstreamResponse.status, { ...headers, ...cors });
    response.end(upstreamResponse.body);
  } catch (error) {
    response.writeHead(502, { ...cors, "Content-Type": "application/json" });
    const causeCode = error && typeof error === "object" && error.cause && typeof error.cause === "object" ? error.cause.code : "";
    const message = error instanceof Error ? error.message : "Proxy request failed";
    response.end(JSON.stringify({ error: { message: causeCode ? `${message} (${causeCode})` : message } }));
  }
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`MatTrace local AI proxy listening on http://127.0.0.1:${port}\n`);
});
