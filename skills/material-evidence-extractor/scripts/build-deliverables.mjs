export function buildDeliverables(records, coverageMatrix = [], comparabilityPassports = [], conflicts = []) {
  const jsonl = records.map((record) => JSON.stringify(record)).join("\n");
  const comparableIds = new Set(comparabilityPassports.filter((item) => item.comparable).map((item) => item.record_id));
  const csv = ["material,property,value,unit,source,page,confidence", ...records.filter((record) => comparableIds.has(record.record_id)).map((record) => [record.material_name_normalized, record.property_name, record.normalized_value ?? record.value_raw, record.normalized_unit ?? record.unit_raw, record.source_document, record.page, record.confidence].map(csvCell).join(","))].join("\n");
  const coverage = ["document,status,page_count,checked_pages,record_count,reason", ...coverageMatrix.map((row) => [row.document_name ?? row.documentName, row.status, row.page_count ?? row.pageCount, (row.checked_pages ?? row.checkedPages)?.join("|"), row.record_count ?? row.recordCount, row.reason].map(csvCell).join(","))].join("\n");
  const passports = comparabilityPassports.map((item) => JSON.stringify(item)).join("\n");
  const evidence = ["# Evidence Report", ...records.map((record) => `\n## ${record.record_id}\n\n- Material: ${record.material_name_normalized}\n- Property: ${record.property_name} ${record.value_raw} ${record.unit_raw}\n- Source: ${record.source_document}, page ${record.page}\n- Evidence: ${record.evidence_text}`)].join("\n");
  const missing = ["# Missing Conditions and Conflicts", "", "## Missing conditions", ...records.flatMap((record) => (record.missing_conditions ?? []).map((field) => `- ${record.record_id}: ${field} = not_reported`)), "", "## Conflicts", ...(conflicts.length ? conflicts.map((item) => `- ${item.id ?? "conflict"}: ${item.message}`) : ["- No condition-compatible conflicts detected."])].join("\n");
  const reviewRows = records.filter((record) => record.review_required || (record.missing_conditions ?? []).length).map((record) => [record.record_id, (record.missing_conditions ?? []).join("|") || "review_required", record.source_document, record.page, record.confidence].map(csvCell).join(","));
  const review = ["record_id,reason,source,page,confidence", ...reviewRows].join("\n");
  return { "records.jsonl": jsonl, "comparison.csv": csv, "evidence-report.md": evidence, "missing-and-conflicts.md": missing, "review-queue.csv": review, "coverage-matrix.csv": coverage, "comparability-passports.jsonl": passports };
}

function csvCell(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
