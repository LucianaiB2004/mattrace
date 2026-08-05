import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";

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
    const upstreamRequest = httpsRequest(url, options, (upstreamResponse) => {
      const chunks = [];
      upstreamResponse.on("data", (chunk) => chunks.push(chunk));
      upstreamResponse.on("end", () => resolve({
        status: upstreamResponse.statusCode || 502,
        headers: upstreamResponse.headers,
        body: Buffer.concat(chunks),
      }));
    });
    upstreamRequest.on("error", reject);
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
    const upstreamResponse = await requestUpstream(`${upstream}${request.url}`, {
      method: request.method,
      headers: {
        Authorization: request.headers.authorization || "",
        "Content-Type": request.headers["content-type"] || "application/json",
        "Content-Length": requestBody.length,
        "Accept-Encoding": "identity",
      },
    }, requestBody);
    const headers = { ...upstreamResponse.headers };
    delete headers["content-encoding"];
    delete headers["content-length"];
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
