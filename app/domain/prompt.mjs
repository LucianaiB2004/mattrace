export const RUNTIME_SKILL_CONTRACT = `你正在执行 material-evidence-extractor Skill。只根据输入文档提取全部可追溯的定量性能记录，不得只挑选代表记录，也不得猜测。每条记录必须包含材料组成或材料体系、实验/制备条件、性能指标、原始数值、单位、测试条件、来源文档、来源页码、证据原文和可信度。缺失信息保留为“未说明”，并写入 missing_conditions。若检查后没有定量材料性能证据，返回 status=no_evidence、checked_pages、reason 和空 records。只返回 JSON 对象。`;

const OUTPUT_SCHEMA = `输出格式：{"status":"extracted|no_evidence","summary":"简述","checked_pages":[1],"reason":"无证据时说明原因","records":[{"material_name_raw":"原文材料名","material_name_normalized":"规范名","processing_steps":"工艺或未说明","property_name":"性能","value":1.23,"value_raw":"1.23","value_kind":"exact|range|limit|approx","unit_raw":"单位","test_conditions":{},"source_document":"原文档名","page":1,"evidence_text":"原文证据句"}],"missing_conditions":[{"record_index":0,"field":"缺失字段","message":"说明"}]}。精确值填写数字 value；范围、极限或约数的 value 必须为 null，并在 value_raw 与 value_kind 保留原文语义。`;

const EVIDENCE_TERMS = /conductiv|capacity|strength|modulus|accuracy|error|rmse|r\s*2|diffus|voltage|temperature|density|mpa|gpa|mah|w\s*m|s\/cm|%|kelvin|\bK\b/i;

export function selectEvidenceExcerpts(document, limit = 900) {
  const pages = Array.isArray(document.pages) && document.pages.length
    ? document.pages
    : [{ page: 1, text: String(document.text ?? "") }];
  const candidates = [];
  for (const page of pages) {
    const sentences = String(page.text ?? "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      if (/\d/.test(sentence) && EVIDENCE_TERMS.test(sentence)) {
        const compact = sentence.trim();
        const evidenceAt = compact.search(EVIDENCE_TERMS);
        const start = Math.max(0, evidenceAt - 250);
        const excerpt = `[第 ${page.page} 页] ${compact.slice(start, start + 500)}`;
        const score = (/(?:S\s*\/\s*cm|mS|MPa|GPa|mAh|W\s*m|%)/i.test(compact) ? 5 : 0)
          + (/(?:conductiv|capacity|strength|modulus|density)/i.test(compact) ? 2 : 0)
          + (/(?:table|chemical formula|composition)/i.test(compact) ? 4 : 0)
          + Math.min(compact.match(/\d+(?:\.\d+)?/g)?.length ?? 0, 5);
        candidates.push({ excerpt, score });
      }
    }
  }
  candidates.sort((left, right) => right.score - left.score);
  const selected = [];
  let length = 0;
  for (const candidate of candidates) {
    if (length + candidate.excerpt.length > limit) continue;
    selected.push(candidate.excerpt);
    length += candidate.excerpt.length + 1;
  }
  if (selected.length) return selected.join("\n");
  return pages.map((page) => `[第 ${page.page} 页] ${page.text}`).join("\n").slice(0, limit);
}

export function selectedEvidencePages(document, limit = 900) {
  const pages = [...selectEvidenceExcerpts(document, limit).matchAll(/\[第\s*([^\]]+?)\s*页\]/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  return [...new Set(pages)];
}

function documentBlock(document) {
  return `===== 文档：${document.name} =====\n${selectEvidenceExcerpts(document)}`;
}

export function buildAnalysisMessages(documents) {
  const content = documents.map(documentBlock).join("\n\n").slice(0, 900);
  return [
    { role: "system", content: `${RUNTIME_SKILL_CONTRACT}\n${OUTPUT_SCHEMA}` },
    { role: "user", content: `请提取以下材料文献中的结构化数据，并严格返回 JSON：\n\n${content}` },
  ];
}

export function buildDocumentAnalysisMessages(document) {
  return [
    { role: "system", content: `${RUNTIME_SKILL_CONTRACT}\n${OUTPUT_SCHEMA}` },
    { role: "user", content: `请仅检查以下已提供的证据片段并严格返回 JSON。checkedPages 只能填写片段标签中真实出现的页码，不得声称检查了未提供页面：\n\n${documentBlock(document)}` },
  ];
}
