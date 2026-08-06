import { extractJsonObject, normalizeAnalysisResult } from "../domain/analysis.mjs";
import { buildAnalysisMessages, buildDocumentAnalysisMessages, selectEvidenceExcerpts, selectedEvidencePages } from "../domain/prompt.mjs";

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

function compactEvidence(value) {
  return String(value ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
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

async function contentFromResponse(response) {
  if (response.headers?.get?.("content-type")?.includes("text/event-stream")) {
    const chunks = [];
    for (const line of (await response.text()).split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const event = JSON.parse(data);
        const content = event?.choices?.[0]?.delta?.content ?? event?.choices?.[0]?.message?.content;
        if (typeof content === "string") chunks.push(content);
      } catch {
        throw new Error("模型流式响应包含无效事件");
      }
    }
    if (!chunks.length) throw new Error("模型流式响应缺少内容");
    return chunks.join("");
  }
  return contentFromCompletion(await response.json());
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

export async function analyzeDocument(config, document, fetchImpl = fetch, signal) {
  if (!document) throw new Error("缺少待分析文档");
  const root = baseV1(requestGateway(config.gateway));
  let response;
  try {
    response = await fetchImpl(`${root}/chat/completions`, {
      method: "POST",
      headers: headers(config),
      signal,
      body: JSON.stringify({
        model: String(config.model ?? "").trim(),
        messages: buildDocumentAnalysisMessages(document),
        temperature: 0.1,
        max_tokens: 4096,
        stream: true,
        enable_thinking: false,
        response_format: { type: "json_object" },
      }),
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw safeError("网络请求失败", error?.message || "无法连接模型服务", config);
  }
  if (!response.ok) throw safeError("分析请求失败", await errorMessage(response), config);
  try {
    const raw = extractJsonObject(await contentFromResponse(response));
    const submittedPages = new Set(selectedEvidencePages(document));
    const claimedPages = raw.checked_pages ?? raw.checkedPages;
    const checkedPages = Array.isArray(claimedPages)
      ? [...new Set(claimedPages.map(Number).filter((page) => submittedPages.has(page)))]
      : [];
    const indexedRecords = Array.isArray(raw.records)
      ? raw.records.map((record, index) => ({ record, index })).filter(({ record }) => submittedPages.has(Number(record?.page)))
      : [];
    const indexMap = new Map(indexedRecords.map(({ index }, nextIndex) => [index, nextIndex]));
    const missingKey = Array.isArray(raw.missing_conditions) ? "missing_conditions" : "missingConditions";
    const filteredMissing = Array.isArray(raw[missingKey])
      ? raw[missingKey].flatMap((item) => {
          const originalIndex = Number(item?.record_index ?? item?.recordIndex);
          const nextIndex = indexMap.get(originalIndex);
          if (nextIndex == null) return [];
          return [{ ...item, record_index: nextIndex, recordIndex: nextIndex }];
        })
      : [];
    const validated = { ...raw, records: indexedRecords.map(({ record }) => record), [missingKey]: filteredMissing };
    if (raw.status === "no_evidence" || validated.records.length === 0) {
      return {
        status: "no_evidence",
        records: [],
        missingConditions: [],
        conflicts: [],
        summary: String(raw.summary ?? ""),
        checkedPages,
        reason: String(raw.reason ?? (raw.records?.length ? "模型返回的证据页不在实际核查范围内" : "未发现可追溯的定量材料性能证据")),
      };
    }
    const normalized = normalizeAnalysisResult(validated);
    const submittedEvidence = compactEvidence(selectEvidenceExcerpts(document));
    normalized.records = normalized.records.map((record) => {
      const quote = compactEvidence(record.evidence);
      if (quote && submittedEvidence.includes(quote)) return { ...record, evidenceSourceBound: true };
      return {
        ...record,
        evidenceSourceBound: false,
        confidence: "low",
        confidenceReasons: [...record.confidenceReasons, "证据原文无法在实际提交的原文片段中定位"],
        reviewRequired: true,
      };
    });
    return { status: "extracted", checkedPages, reason: "", ...normalized };
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw safeError("模型返回格式无效", error?.message || "无法解析", config);
  }
}
