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
  return /(?:^|\r?\n)data:\s*\[DONE\](?:\r?\n|$)/.test(String(body ?? ""));
}

export function responseHeaders(upstream) {
  const headers = { ...upstream };
  delete headers["content-length"];
  return headers;
}
