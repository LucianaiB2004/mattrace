export function buildDeliverables(records) {
  const jsonl = records.map((record) => JSON.stringify(record)).join("\n");
  const csv = ["material,property,value,unit,source,page,confidence", ...records.map((record) => [record.material, record.property, record.value, record.unit, record.sourceDocument, record.page, record.confidence].map(csvCell).join(","))].join("\n");
  return { "records.jsonl": jsonl, "comparison.csv": csv };
}

function csvCell(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
