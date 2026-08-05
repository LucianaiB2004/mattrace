export function buildUpstreamHeaders(incoming, contentLength) {
  return {
    Authorization: incoming.authorization || "",
    "Content-Type": incoming["content-type"] || "application/json",
    "Content-Length": contentLength,
    "User-Agent": "Mozilla/5.0 MatTrace-Local-Proxy/1.0",
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
  };
}

export function responseHeaders(upstream) {
  const headers = { ...upstream };
  delete headers["content-length"];
  return headers;
}
