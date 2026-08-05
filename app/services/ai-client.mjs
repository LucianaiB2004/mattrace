import { extractJsonObject, normalizeAnalysisResult } from "../domain/analysis.mjs";
import { buildAnalysisMessages } from "../domain/prompt.mjs";

function baseV1(gateway) {
  const clean = String(gateway ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(clean)) throw new Error("API 网关必须是有效的 HTTP(S) 地址");
  return clean.endsWith("/v1") ? clean : `${clean}/v1`;
}

export function requestGateway(gateway, runtimeLocation = globalThis.location) {
  const clean = String(gateway ?? "").trim().replace(/\/+$/, "");
  const local = runtimeLocation?.hostname === "localhost" || runtimeLocation?.hostname === "127.0.0.1";
  return local && clean === "https://ai.chipcloud.cc" ? "http://127.0.0.1:8788" : clean;
}

function headers(config) {
  if (!String(config.apiKey ?? "").trim()) throw new Error("请输入 API Key");
  return {
    Authorization: `Bearer ${config.apiKey.trim()}`,
    "Content-Type": "application/json",
  };
}

async function errorMessage(response) {
  try {
    const body = await response.text();
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message || parsed?.message;
    if (message) return String(message).slice(0, 240);
  } catch {
    // Use the HTTP status when the body is not structured JSON.
  }
  return `HTTP ${response.status}`;
}

function safeError(prefix, detail, config) {
  const key = String(config.apiKey ?? "");
  const safe = key ? String(detail).replaceAll(key, "[已隐藏]") : String(detail);
  return new Error(`${prefix}：${safe}`);
}

function contentFromCompletion(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("模型响应缺少 message.content");
  return content;
}

export async function testProvider(config, fetchImpl = fetch, signal) {
  const root = baseV1(requestGateway(config.gateway));
  const requestHeaders = headers(config);
  const models = await fetchImpl(`${root}/models`, { method: "GET", headers: requestHeaders, signal });
  if (models.ok) return { ok: true, method: "models" };
  if (![404, 405, 501].includes(models.status)) {
    throw safeError("连接失败", await errorMessage(models), config);
  }

  const chat = await fetchImpl(`${root}/chat/completions`, {
    method: "POST",
    headers: requestHeaders,
    signal,
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: "Reply OK" }],
      max_tokens: 8,
      temperature: 0,
    }),
  });
  if (!chat.ok) throw safeError("连接失败", await errorMessage(chat), config);
  return { ok: true, method: "chat" };
}

export async function analyzeDocuments(
  config,
  documents,
  fetchImpl = fetch,
  signal,
  onStage = () => {},
) {
  if (!Array.isArray(documents) || documents.length === 0) throw new Error("请先添加可解析的文档");
  const root = baseV1(requestGateway(config.gateway));
  const requestHeaders = headers(config);
  onStage(0);
  onStage(1);
  let response;
  try {
    response = await fetchImpl(`${root}/chat/completions`, {
      method: "POST",
      headers: requestHeaders,
      signal,
      body: JSON.stringify({
        model: String(config.model ?? "").trim(),
        messages: buildAnalysisMessages(documents),
        temperature: 0.1,
        max_tokens: 512,
        response_format: { type: "json_object" },
      }),
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw safeError("网络请求失败", error?.message || "无法连接模型服务", config);
  }
  if (!response.ok) throw safeError("分析请求失败", await errorMessage(response), config);

  let payload;
  try {
    payload = await response.json();
    onStage(2);
    const raw = extractJsonObject(contentFromCompletion(payload));
    onStage(3);
    const result = normalizeAnalysisResult(raw);
    onStage(4);
    onStage(5);
    return result;
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw safeError("模型返回格式无效", error?.message || "无法解析", config);
  }
}
