import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { buildUpstreamHeaders, hasCompletedSse, responseHeaders } from "./proxy-transport.mjs";

const upstream = "https://ai.chipcloud.cc";
const port = Number(process.argv[2] || 8788);
const allowedOrigins = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);

function corsHeaders(origin) {
  return {
    ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
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
    upstreamRequest.setTimeout(120_000, () => upstreamRequest.destroy(new Error("Upstream timeout")));
    if (body.length) upstreamRequest.write(body);
    upstreamRequest.end();
  });
}

createServer(async (request, response) => {
  const origin = request.headers.origin || "";
  const cors = corsHeaders(origin);
  if (request.method === "OPTIONS") {
    response.writeHead(204, cors);
    response.end();
    return;
  }
  if (!allowedOrigins.has(origin) || !request.url?.startsWith("/v1/")) {
    response.writeHead(403, { ...cors, "Content-Type": "application/json" });
    response.end('{"error":{"message":"Local proxy only accepts MatTrace localhost requests"}}');
    return;
  }
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const requestBody = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
    const streaming = requestBody.includes(Buffer.from('"stream":true'));
    const upstreamResponse = await requestUpstream(`${upstream}${request.url}`, {
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
