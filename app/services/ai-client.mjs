import { extractJsonObject, normalizeAnalysisResult } from "../domain/analysis.mjs";
import { buildDocumentAnalysisMessages, selectEvidenceExcerpts, selectedEvidencePages } from "../domain/prompt.mjs";
import { requestBody, requestUrl, responseText } from "./provider-protocol.mjs";

export function requestGateway(gateway, runtimeLocation = globalThis.location) {
  const clean = String(gateway ?? "").trim().replace(/\/+$/, "");
  const local = runtimeLocation?.hostname === "localhost" || runtimeLocation?.hostname === "127.0.0.1";
  if (!local) return clean;
  if (clean === "https://ai.chipcloud.cc") return "http://127.0.0.1:8788/chipcloud";
  if (clean === "https://ark.cn-beijing.volces.com/api/plan/v3") return "http://127.0.0.1:8788/ark-plan";
  return clean;
}

function bearerToken(config) {
  return String(config.apiKey ?? "").trim().replace(/^bearer\s+/i, "");
}

function headers(config) {
  const token = bearerToken(config);
  if (!token) throw new Error("请输入 API Key");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function compactEvidence(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

// Reduce a unit to its letter stem so a table-header unit such as
// "ionic conductivity (S cm−1)" or "W m^-1 K^-1" matches evidence rows that
// carry the number but no inline unit. Exponents are dropped.
function unitStem(value) {
  return compactEvidence(value).replace(/[-.]?\d+/g, "");
}

// Strip digits glued to letters so exponents typeset as "m-1", "kg3", or
// "wm1k1" collapse to the same letter stem ("wmk") and can match a header unit.
function unitContextKey(contextCompact) {
  return contextCompact.replace(/(\p{L})\d+/gu, "$1");
}

const UNREPORTED_UNIT = /^(?:未说明|未标注|未报告|unreported)?$/i;
const DIMENSIONLESS_UNIT = /^(?:%|无单位|无量纲|dimensionless|none|n\/?a|arb\.?\s*units?|a\.?u\.?)$/i;

function unitInContext(unit, context) {
  const raw = String(unit ?? "").trim();
  if (!raw || UNREPORTED_UNIT.test(raw) || DIMENSIONLESS_UNIT.test(raw)) return false;
  return unitContextKey(context).includes(unitStem(raw));
}

// Group the submitted evidence text by page tag ("[第 N 页] ...") so a unit that
// only shows up in a table header can still be matched on the right page.
function submittedContextByPage(submittedEvidenceText) {
  const byPage = new Map();
  const chunks = String(submittedEvidenceText).split(/\n(?=\[第\s*\d+\s*页\])/);
  for (const chunk of chunks) {
    const tag = chunk.match(/\[第\s*(\d+)\s*页\]/);
    if (!tag) continue;
    const page = Number(tag[1]);
    byPage.set(page, (byPage.get(page) ?? "") + compactEvidence(chunk));
  }
  return byPage;
}

// When a value lands on a table row but its unit only appears in the column
// header, the evidence sentence alone cannot bind it. If the unit is present
// elsewhere in the submitted text for that page, accept it as located via the
// table header and leave a review note: the number is traceable, but the
// header/row association should be eyeballed.
function bindTableHeaderUnits(records, submittedEvidenceByPage) {
  return records.map((record) => {
    const unitIssue = record.confidenceReasons.some((reason) => reason.includes("未定位到当前单位"));
    if (!unitIssue) return record;
    const context = submittedEvidenceByPage.get(Number(record.page)) ?? "";
    if (!unitInContext(record.unit, context)) return record;
    return {
      ...record,
      confidence: record.confidence === "high" ? "high" : "medium",
      confidenceReasons: [...record.confidenceReasons, "单位位于同页表头/上下文，数值已定位但需核对表头对应关系"],
      reviewRequired: true,
    };
  });
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

// Agent Plan responses include reasoning tokens in the output budget, so the
// ceiling must leave room for both reasoning and the full JSON result.
const ANALYSIS_MAX_TOKENS = Object.freeze({ "openai-responses": 32768, "openai-chat": 8192 });

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
      body: JSON.stringify(requestBody(resolved, [{ role: "user", content: "Reply only with OK." }], { maxTokens: 128 })),
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

export async function analyzeDocument(config, document, fetchImpl = fetch, signal) {
  if (!document) throw new Error("缺少待分析文档");
  const resolved = { ...config, protocol: config.protocol ?? "openai-chat", gateway: requestGateway(config.gateway) };
  let response;
  try {
    response = await fetchImpl(requestUrl(resolved), {
      method: "POST",
      headers: headers(config),
      signal,
      body: JSON.stringify(requestBody(resolved, buildDocumentAnalysisMessages(document), {
        maxTokens: ANALYSIS_MAX_TOKENS[resolved.protocol] ?? 8192,
        stream: true,
        json: true,
      })),
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
    const submittedEvidenceText = selectEvidenceExcerpts(document);
    const submittedEvidence = compactEvidence(submittedEvidenceText);
    const submittedByPage = submittedContextByPage(submittedEvidenceText);
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
    normalized.records = bindTableHeaderUnits(normalized.records, submittedByPage);
    return { status: "extracted", checkedPages, reason: "", ...normalized };
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw safeError("模型返回格式无效", error?.message || "无法解析", config);
  }
}
