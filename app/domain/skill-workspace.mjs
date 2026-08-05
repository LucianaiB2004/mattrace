import JSZip from "jszip";

const STORAGE_KEY = "mattrace.skill.material-evidence-extractor.v1";
const WORKSPACE_KEY = "mattrace.skill.material-evidence-extractor.workspace.v1";

export const DEFAULT_SKILL_CONTENT = `---
name: material-evidence-extractor
description: Extract and audit structured material evidence from 1-20 papers, patents, or TDS files with explicit document coverage, page-level provenance, deterministic comparability scoring, missing-condition detection, and cross-source conflict checks.
---

# Material Evidence Extractor

## 任务描述

输入 1-20 篇论文、专利或 TDS（比赛官方推荐 3-10 篇），逐篇抽取全部可追溯材料证据；每篇必须输出 extracted、no_evidence、failed 或 cancelled 状态，不得静默遗漏。

## 独特能力：Evidence Coverage & Comparability Auditor

输出文档覆盖矩阵，并为每条记录生成可比性护照：证据定位 35 分、字段完整性 25 分、测试条件 20 分、单位可比性 20 分，同时列出扣分原因。

## 核心原则

把每个性能值作为一条独立证据记录。记录必须同时回答：什么材料、如何制备、测了什么、在什么条件下测量、原文在哪里。缺失内容标记为缺失，不用常识补写。

## 工作流

1. 登记文档：分配稳定 document_id，保留原始页码。
2. 识别材料实体：保存原始名称、规范化名称、化学式、掺杂量、样品形态和别名。
3. 拆分证据记录：每个材料、工艺、性能值和测试条件组合生成独立记录。
4. 绑定证据链：记录文档、页码、章节及表图编号，摘录最短证据片段。
5. 规范化单位：保留原值与原单位，仅在量纲明确时生成规范化值。
6. 核验条件：检查温度、压力、频率、样品方向、密度和测试方法等条件。
7. 检测冲突：仅比较条件兼容的数据，差异超过阈值时生成冲突记录。
8. 生成覆盖矩阵与可比性护照，明确每篇文档和每条记录的审计状态。
9. 生成交付物：输出结构化记录、对比表、证据报告、缺失与冲突清单。

## 输出前检查

- 每个数值都有 source_document 和 page。
- 原始值、规范化值和换算说明相互一致。
- 不同测试条件的数据不直接排名。
- 缺失字段不由模型补全。
- 冲突记录保留全部来源，不静默覆盖。`;

const OUTPUT_SCHEMA = `# 输出字段规范\n\n必填字段：record_id、document_id、material_name_raw、material_name_normalized、composition、processing_steps、property_name、value_raw、unit_raw、test_method、test_conditions、source_document、page、evidence_text、missing_conditions、confidence、review_required。\n\n缺失状态仅使用 not_reported、not_applicable 或 unclear。`;
const AGENT_YAML = `interface:\n  display_name: "MatTrace Material Evidence"\n  short_description: "Audit evidence coverage and comparability"\n  default_prompt: "Use $material-evidence-extractor to audit every selected material document."`;
const RECORD = `{"record_id":"rec-llzto-001","material_name_normalized":"LLZTO","composition":"Li6.4La3Zr1.4Ta0.6O12","processing_steps":"sintered at 900°C","property_name":"thermal conductivity","value_raw":"1.4","unit_raw":"W m-1 K-1","test_method":"TDTR","test_conditions":{"temperature":"room temperature"},"source_document":"Solid Electrolytes 2021.pdf","page":"2","evidence_text":"The room-temperature thermal conductivity was measured as 1.4 W m-1 K-1.","missing_conditions":["relative_density"],"confidence":"high","review_required":false}`;

export const SKILL_FILES = [
  { path: "SKILL.md", content: DEFAULT_SKILL_CONTENT, category: "contract", editable: true, language: "markdown" },
  { path: "agents/openai.yaml", content: AGENT_YAML, category: "contract", editable: true, language: "yaml" },
  { path: "references/output-schema.md", content: OUTPUT_SCHEMA, category: "contract", editable: true, language: "markdown" },
  { path: "examples/records.jsonl", content: RECORD, category: "example", editable: false, language: "json" },
  { path: "examples/comparison.csv", content: "material,property,value,unit,source,page,confidence\nLLZTO,thermal conductivity,1.4,W m-1 K-1,Solid Electrolytes 2021.pdf,2,high", category: "example", editable: false, language: "csv" },
  { path: "examples/evidence-report.md", content: "# Evidence Report\n\nLLZTO thermal conductivity: 1.4 W m-1 K-1. Source: Solid Electrolytes 2021.pdf, page 2. Confidence: high.", category: "example", editable: false, language: "markdown" },
  { path: "examples/missing-and-conflicts.md", content: "# Missing and Conflicts\n\nrelative_density: not_reported. No comparable conflict detected.", category: "example", editable: false, language: "markdown" },
  { path: "examples/review-queue.csv", content: "record_id,reason,source,page,priority\nrec-llzto-001,relative density not reported,Solid Electrolytes 2021.pdf,2,medium", category: "example", editable: false, language: "csv" },
  { path: "examples/coverage-matrix.csv", content: "document,status,page_count,checked_pages,record_count,reason\nSolid Electrolytes 2021.pdf,extracted,14,1|2|3|4|5|6|7|8|9|10|11|12|13|14,3,", category: "example", editable: false, language: "csv" },
  { path: "examples/comparability-passports.jsonl", content: '{"record_id":"rec-llzto-001","scores":{"evidence":35,"completeness":25,"conditions":20,"comparability":20,"total":100},"comparable":true,"reasons":[]}', category: "example", editable: false, language: "json" },
  { path: "references/coverage-and-comparability.md", content: "# Evidence Coverage & Comparability Auditor\n\nEvery document receives an explicit outcome. Every record receives a deterministic four-dimension score and review reasons.", category: "contract", editable: true, language: "markdown" },
  { path: "scripts/extract-evidence.mjs", content: "export function extractEvidence(document) { return document.pages.flatMap(({ page, text }) => /\\d/.test(text) ? [{ sourceDocument: document.name, page, evidenceText: text }] : []); }", category: "code", editable: false, language: "javascript" },
  { path: "scripts/normalize-record.mjs", content: "export function normalizeRecord(record) { const missingConditions = Object.entries(record.conditions ?? {}).filter(([, value]) => !value).map(([key]) => key); return { ...record, missingConditions, confidence: record.page && record.evidenceText ? (missingConditions.length ? 'medium' : 'high') : 'low' }; }", category: "code", editable: false, language: "javascript" },
  { path: "scripts/build-deliverables.mjs", content: "export function buildDeliverables(records, coverage, passports) { return { 'records.jsonl': records.map(JSON.stringify).join('\\n'), 'comparison.csv': records.map((record) => [record.material, record.property, record.value, record.unit].join(',')).join('\\n'), 'coverage-matrix.csv': coverage.map((row) => [row.documentName, row.status, row.recordCount].join(',')).join('\\n'), 'comparability-passports.jsonl': passports.map(JSON.stringify).join('\\n') }; }", category: "code", editable: false, language: "javascript" },
];

function assertSafeContent(content) {
  const normalized = String(content ?? "").trim();
  if (!normalized) throw new Error("Skill 内容不能为空");
  if (/\b(?:api[_ -]?key|token|secret)\s*[:=]\s*(?:sk-|[A-Za-z0-9_-]{16,})/i.test(normalized)) {
    throw new Error("Skill 内容不能包含 API Key 或其他敏感凭证");
  }
  return normalized;
}

export function loadSkill(storage) {
  return storage?.getItem(STORAGE_KEY) || DEFAULT_SKILL_CONTENT;
}

export function saveSkill(storage, content) {
  const safeContent = assertSafeContent(content);
  storage?.setItem(STORAGE_KEY, safeContent);
  return safeContent;
}

export function resetSkill(storage) {
  storage?.removeItem(STORAGE_KEY);
  return DEFAULT_SKILL_CONTENT;
}

export function buildSkillDownload(content) {
  return { filename: "SKILL.md", content: assertSafeContent(content), mime: "text/markdown" };
}

export function loadSkillWorkspace(storage) {
  let overrides = {};
  try { overrides = JSON.parse(storage?.getItem(WORKSPACE_KEY) || "{}"); } catch { overrides = {}; }
  const legacy = storage?.getItem(STORAGE_KEY);
  if (legacy && !overrides["SKILL.md"]) overrides["SKILL.md"] = legacy;
  return { files: SKILL_FILES.map((file) => ({ ...file, content: overrides[file.path] ?? file.content })) };
}

export function saveSkillFile(storage, path, content) {
  const file = SKILL_FILES.find((item) => item.path === path);
  if (!file) throw new Error("Skill 文件不存在");
  if (!file.editable) throw new Error("该 Skill 文件为只读");
  const safe = assertSafeContent(content);
  const workspace = loadSkillWorkspace(storage);
  const overrides = Object.fromEntries(workspace.files.filter((item) => item.editable).map((item) => [item.path, item.path === path ? safe : item.content]));
  storage?.setItem(WORKSPACE_KEY, JSON.stringify(overrides));
  if (path === "SKILL.md") storage?.setItem(STORAGE_KEY, safe);
  return safe;
}

export function resetSkillWorkspace(storage) { storage?.removeItem(WORKSPACE_KEY); storage?.removeItem(STORAGE_KEY); return loadSkillWorkspace(storage); }

export async function buildSkillZip(workspace) {
  const zip = new JSZip();
  const root = zip.folder("material-evidence-extractor");
  for (const file of workspace.files) root.file(file.path, assertSafeContent(file.content));
  return zip.generateAsync({ type: "blob" });
}
