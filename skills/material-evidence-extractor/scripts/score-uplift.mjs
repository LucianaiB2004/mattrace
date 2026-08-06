import { pathToFileURL } from "node:url";

const DEFAULT_FIELDS = ["material_name_normalized", "property_name", "normalized_value", "normalized_unit", "source_document", "page"];

export function median(values) {
  if (!Array.isArray(values) || !values.length) throw new Error("分数列表不能为空");
  const sorted = values.map(Number).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function matches(expected, actual, tolerance) {
  if (typeof expected === "number" && typeof actual === "number") {
    const scale = Math.max(Math.abs(expected), 1e-12);
    return Math.abs(expected - actual) / scale <= tolerance;
  }
  return String(expected ?? "").trim().toLowerCase() === String(actual ?? "").trim().toLowerCase();
}

export function scoreRun(gold, predicted, options = {}) {
  const fields = options.fields ?? DEFAULT_FIELDS;
  const tolerance = options.relative_tolerance ?? 0.02;
  const fieldScores = Object.fromEntries(fields.map((field) => [field, 0]));
  const unused = new Set(predicted.map((_, index) => index));
  let matched = 0;
  for (const expected of gold) {
    const ranked = [...unused].map((index) => ({ index, item: predicted[index], identity: ["material_name_normalized", "property_name", "source_document", "page"].filter((field) => matches(expected[field], predicted[index]?.[field], tolerance)).length })).sort((a, b) => b.identity - a.identity);
    const selected = ranked[0];
    const candidate = selected?.item ?? {};
    if (selected) unused.delete(selected.index);
    for (const field of fields) {
      if (matches(expected[field], candidate[field], tolerance)) {
        fieldScores[field] += 1;
        matched += 1;
      }
    }
  }
  const denominator = Math.max(gold.length * fields.length, 1);
  return { score: Number((matched / denominator).toFixed(6)), fields: Object.fromEntries(Object.entries(fieldScores).map(([field, count]) => [field, count / Math.max(gold.length, 1)])), matched_fields: matched, total_fields: denominator };
}

export function summarizeUplift(baselineScores, skillScores) {
  if (baselineScores.length !== 3 || skillScores.length !== 3) throw new Error("baseline 与 Skill 必须恰好运行 3 次");
  const baseline = median(baselineScores);
  const skill = median(skillScores);
  return { baseline_median: baseline, skill_median: skill, uplift: Number((skill - baseline).toFixed(6)), runs_per_arm: 3 };
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const parseScores = (value) => String(value ?? "").split(",").filter(Boolean).map(Number);
  const summary = summarizeUplift(parseScores(option("--baseline")), parseScores(option("--skill")));
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}
