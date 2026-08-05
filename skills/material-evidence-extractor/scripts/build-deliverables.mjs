export function buildDeliverables(records, coverageMatrix = [], comparabilityPassports = []) {
  const jsonl = records.map((record) => JSON.stringify(record)).join("\n");
  const csv = ["material,property,value,unit,source,page,confidence", ...records.map((record) => [record.material, record.property, record.value, record.unit, record.sourceDocument, record.page, record.confidence].map(csvCell).join(","))].join("\n");
  const coverage = ["document,status,page_count,checked_pages,record_count,reason", ...coverageMatrix.map((row) => [row.documentName, row.status, row.pageCount, row.checkedPages?.join("|"), row.recordCount, row.reason].map(csvCell).join(","))].join("\n");
  const passports = comparabilityPassports.map((item) => JSON.stringify(item)).join("\n");
  return { "records.jsonl": jsonl, "comparison.csv": csv, "coverage-matrix.csv": coverage, "comparability-passports.jsonl": passports };
}

function csvCell(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
