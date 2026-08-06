import { extractJsonObject, normalizeAnalysisResult } from "../domain/analysis.mjs";
import { buildAnalysisMessages, buildDocumentAnalysisMessages, selectEvidenceExcerpts, selectedEvidencePages } from "../domain/prompt.mjs";
import { requestBody, requestUrl, responseText } from "./provider-protocol.mjs";

export function requestGateway(gateway, runtimeLocation = globalThis.location) {
  const clean = String(gateway ?? "").trim().replace(/\/+$/, "");
  const local = runtimeLocation?.hostname === "localhost" || runtimeLocation?.hostname === "127.0.0.1";
  if (!local) return clean;
  if (clean === "https://ai.chipcloud.cc") return "http://127.0.0.1:8788/chipcloud";
  if (clean === "https://ark.cn-beijing.volces.com/api/plan/v3") return "http://127.0.0.1:8788/ark-plan";
  return clean;
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

export async function testProvider(config, fetchImpl = fetch, signal) {
  const resolved = { ...config, protocol: config.protocol ?? "openai-chat", gateway: requestGateway(config.gateway) };
  const requestHeaders = headers(config);
  if (resolved.protocol === "openai-responses") {
    const response = await fetchImpl(requestUrl(resolved), {
      method: "POST", headers: requestHeaders, signal,
      body: JSON.stringify(requestBody(resolved, [{ role: "user", content: "Reply OK" }], { maxTokens: 16 })),
    });
    if (!response.ok) throw safeError("连接失败", await errorMessage(response), config);
    await responseText(resolved.protocol, response);
    return { ok: true, method: "responses" };
  }
  const models = await fetchImpl(requestUrl(resolved, "models"), { method: "GET", headers: requestHeaders, signal });
  if (models.ok) return { ok: true, method: "models" };
  if (![404, 405, 501].includes(models.status)) {
    throw safeError("连接失败", await errorMessage(models), config);
  }

  const chat = await fetchImpl(requestUrl(resolved), {
    method: "POST",
    headers: requestHeaders,
    signal,
    body: JSON.stringify(requestBody(resolved, [{ role: "user", content: "Reply OK" }], { maxTokens: 8, temperature: 0 })),
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
  const resolved = { ...config, protocol: config.protocol ?? "openai-chat", gateway: requestGateway(config.gateway) };
  const requestHeaders = headers(config);
  onStage(0);
  onStage(1);
  let response;
  try {
    response = await fetchImpl(requestUrl(resolved), {
      method: "POST",
      headers: requestHeaders,
      signal,
      body: JSON.stringify(requestBody(resolved, buildAnalysisMessages(documents), { maxTokens: 512, json: true })),
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw safeError("网络请求失败", error?.message || "无法连接模型服务", config);
  }
  if (!response.ok) throw safeError("分析请求失败", await errorMessage(response), config);

  try {
    onStage(2);
    const raw = extractJsonObject(await responseText(resolved.protocol, response));
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
  const resolved = { ...config, protocol: config.protocol ?? "openai-chat", gateway: requestGateway(config.gateway) };
  let response;
  try {
    response = await fetchImpl(requestUrl(resolved), {
      method: "POST",
      headers: headers(config),
      signal,
      body: JSON.stringify(requestBody(resolved, buildDocumentAnalysisMessages(document), { maxTokens: 4096, stream: true, json: true })),
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw safeError("网络请求失败", error?.message || "无法连接模型服务", config);
  }
  if (!response.ok) throw safeError("分析请求失败", await errorMessage(response), config);
  try {
    const raw = extractJsonObject(await responseText(resolved.protocol, response));
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
