export function buildUpstreamHeaders(incoming, contentLength, streaming = false) {
  return {
    Authorization: incoming.authorization || "",
    "Content-Type": incoming["content-type"] || "application/json",
    "Content-Length": contentLength,
    "User-Agent": "Mozilla/5.0 MatTrace-Local-Proxy/1.0",
    Accept: "application/json",
    "Accept-Encoding": streaming ? "identity" : "gzip, deflate, br",
    Connection: "keep-alive",
  };
}

export function hasCompletedSse(body) {
  const text = String(body ?? "");
  return /(?:^|\r?\n)data:\s*\[DONE\](?:\r?\n|$)/.test(text)
    || /(?:^|\r?\n)data:\s*\{[^\r\n]*"type"\s*:\s*"response\.completed"/.test(text);
}

export function responseHeaders(upstream) {
  const headers = { ...upstream };
  delete headers["content-length"];
  return headers;
}
const ROUTES = Object.freeze([
  { prefix: "/chipcloud", origin: "https://ai.chipcloud.cc", basePath: "", allowed: new Set(["/v1/models", "/v1/chat/completions"]) },
  { prefix: "/ark-plan", origin: "https://ark.cn-beijing.volces.com", basePath: "/api/plan/v3", allowed: new Set(["/responses"]) },
]);

export function resolveUpstream(requestUrl) {
  const pathname = String(requestUrl ?? "").split("?", 1)[0];
  const route = ROUTES.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
  if (!route) return null;
  const suffix = pathname.slice(route.prefix.length) || "/";
  if (!route.allowed.has(suffix)) return null;
  return { origin: route.origin, pathname: `${route.basePath}${suffix}` };
}
