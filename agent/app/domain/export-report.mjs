const CSV_COLUMNS = [
  ["材料体系", "material"],
  ["制备工艺", "process"],
  ["性能指标", "property"],
  ["原始数值", "valueRaw"],
  ["原始单位", "unit"],
  ["规范化数值", "normalizedValue"],
  ["规范化单位", "normalizedUnit"],
  ["测试条件", "conditionText"],
  ["来源文档", "sourceDocument"],
  ["页码定位", "page"],
  ["证据原文", "evidence"],
  ["可信度", "confidence"],
];

function requireReport(report) {
  if (!report || !Array.isArray(report.records) || report.records.length === 0) {
    throw new Error("暂无可导出的分析结果");
  }
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function markdownCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function buildMarkdown(report) {
  const lines = [
    "# MatTrace 材料证据报告",
    "",
    report.summary || `共提取 ${report.records.length} 条材料数据。`,
    "",
    "## 结构化数据",
    "",
    "| 材料体系 | 制备工艺 | 性能指标 | 数值 | 测试条件 | 来源 | 可信度 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...report.records.map((record) =>
      `| ${[
        record.material,
        record.process,
        record.property,
        `${record.valueRaw ?? record.value ?? "未说明"} ${record.unit ?? ""}`.trim(),
        record.conditionText,
        `${record.sourceDocument} · ${record.page}`,
        record.confidence,
      ].map(markdownCell).join(" | ")} |`,
    ),
    "",
    "## 证据原文",
    "",
    ...report.records.flatMap((record, index) => [
      `### ${index + 1}. ${record.material} · ${record.property}`,
      "",
      `> ${String(record.evidence).replaceAll("\n", " ")}`,
      "",
      `来源：${record.sourceDocument} · ${record.page}`,
      "",
    ]),
    "## 缺失条件",
    "",
    ...(report.missingConditions?.length
      ? report.missingConditions.map((item) => `- ${item.message}（${item.recordId}）`)
      : ["- 未发现缺失条件"]),
    "",
    "## 冲突检测",
    "",
    ...(report.conflicts?.length
      ? report.conflicts.map((item) => `- ${item.message}（差异 ${item.differencePercent ?? "待核验"}%）`)
      : ["- 未发现数值冲突"]),
  ];
  return lines.join("\n");
}

export function toCanonicalReport(report) {
  const missingByRecord = new Map();
  for (const item of report.missingConditions ?? []) {
    const fields = missingByRecord.get(item.recordId) ?? [];
    fields.push(item.field);
    missingByRecord.set(item.recordId, fields);
  }
  const records = report.records.map((record) => ({
    record_id: record.id,
    document_id: record.documentId ?? record.sourceDocument,
    material_name_raw: record.materialRaw ?? record.material,
    material_name_normalized: record.material,
    property_name: record.property,
    value_raw: record.valueRaw ?? String(record.value),
    unit_raw: record.unit,
    value_status: record.normalizedUnit && record.normalizedUnit !== record.unit ? "converted" : "reported",
    normalized_value: record.normalizedValue ?? null,
    normalized_unit: record.normalizedUnit ?? null,
    source_document: record.sourceDocument,
    page: record.page,
    evidence_text: record.evidence,
    missing_conditions: [...new Set(missingByRecord.get(record.id) ?? [])],
    confidence: record.confidence,
    confidence_reasons: record.confidenceReasons ?? [],
    review_required: Boolean(record.reviewRequired || missingByRecord.has(record.id)),
  }));
  return {
    coverage_matrix: (report.coverageMatrix ?? []).map((row) => ({ document_id: row.documentId ?? row.documentName, status: row.status, checked_pages: row.checkedPages ?? [], record_count: row.recordCount ?? 0, reason: row.reason ?? "" })),
    records,
    missing_conditions: report.missingConditions ?? [],
    conflicts: report.conflicts ?? [],
    review_queue: records.filter((record) => record.review_required).map((record) => ({ record_id: record.record_id, reasons: [...record.missing_conditions, ...record.confidence_reasons] })),
  };
}

export function buildExport(format, report) {
  requireReport(report);
  if (format === "json") {
    return {
      filename: "mattrace-report.json",
      mime: "application/json",
      content: JSON.stringify(toCanonicalReport(report), null, 2),
    };
  }
  if (format === "csv") {
    const rows = [
      CSV_COLUMNS.map(([label]) => label).join(","),
      ...report.records.map((record) =>
        CSV_COLUMNS.map(([, key]) => csvCell(record[key])).join(","),
      ),
    ];
    return {
      filename: "mattrace-report.csv",
      mime: "text/csv",
      content: `\uFEFF${rows.join("\r\n")}`,
    };
  }
  if (format === "markdown") {
    return {
      filename: "mattrace-report.md",
      mime: "text/markdown",
      content: buildMarkdown(report),
    };
  }
  throw new Error(`不支持的导出格式：${format}`);
}

export function buildAuditExport(format, report) {
  if (format === "coverage") {
    const rows = [
      "文档,状态,总页数,已检查页,记录数,说明",
      ...(report?.coverageMatrix ?? []).map((row) => [row.documentName, row.status, row.pageCount, row.checkedPages?.join("|"), row.recordCount, row.reason].map(csvCell).join(",")),
    ];
    return { filename: "coverage-matrix.csv", mime: "text/csv", content: `\uFEFF${rows.join("\r\n")}` };
  }
  if (format === "passports") {
    return {
      filename: "comparability-passports.jsonl",
      mime: "application/x-ndjson",
      content: (report?.comparabilityPassports ?? []).map((item) => JSON.stringify(item)).join("\n"),
    };
  }
  throw new Error(`不支持的审计导出格式：${format}`);
}
