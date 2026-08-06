import { readFile } from "node:fs/promises";
import { buildDeliverables } from "./build-deliverables.mjs";
import { normalizeRecord } from "./normalize-record.mjs";

const root = new URL("../", import.meta.url);

function jsonLines(text) {
  return text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

const [recordsText, outcomesText, passportsText, inputSchemaText, outputSchemaText] = await Promise.all([
  readFile(new URL("examples/records.jsonl", root), "utf8"),
  readFile(new URL("examples/document-outcomes.jsonl", root), "utf8"),
  readFile(new URL("examples/comparability-passports.jsonl", root), "utf8"),
  readFile(new URL("references/input-schema.json", root), "utf8"),
  readFile(new URL("references/output-schema.json", root), "utf8"),
]);

const records = jsonLines(recordsText).map(normalizeRecord);
const outcomes = jsonLines(outcomesText);
const passports = jsonLines(passportsText);
const inputSchema = JSON.parse(inputSchemaText);
const outputSchema = JSON.parse(outputSchemaText);
const requiredRecordFields = outputSchema.properties.records.items.required;

if (inputSchema.properties.documents.minItems !== 3 || inputSchema.properties.documents.maxItems !== 10) throw new Error("输入 Schema 必须限定 3-10 篇");
if (!["coverage_matrix", "records", "missing_conditions", "conflicts", "review_queue"].every((field) => outputSchema.required.includes(field))) throw new Error("输出 Schema 缺少顶层必填字段");
for (const record of records) {
  const missing = requiredRecordFields.filter((field) => !(field in record));
  if (missing.length) throw new Error(`示例记录缺少 Schema 字段: ${missing.join(", ")}`);
}
if (!new Set(outcomes.map((item) => item.status)).isSupersetOf(new Set(["extracted", "no_evidence", "failed", "cancelled"]))) throw new Error("文档状态示例不完整");

const coverage = outcomes.map((item) => ({ ...item, document_name: item.document_id }));
const deliverables = buildDeliverables(records, coverage, passports);
if (Object.keys(deliverables).length !== 7) throw new Error("交付物数量不是 7");

process.stdout.write(`${JSON.stringify({ ok: true, schema_validated: true, example_records: records.length, document_outcomes: outcomes.length, deliverables: Object.keys(deliverables).length })}\n`);
