const SYSTEM_PROMPT = `你是材料文献数据提取器。只根据输入原文，选择最有代表性的 1 条定量材料性能证据。只返回 JSON：{"summary":"简述","records":[{"material":"材料","process":"工艺或未说明","property":"性能","value":1.23,"unit":"单位","conditions":{},"sourceDocument":"原文档名","page":1,"evidence":"原文证据句","confidence":"high"}]}。value 必须是数字，不得猜测。`;

const EVIDENCE_TERMS = /conductiv|capacity|strength|modulus|accuracy|error|rmse|r\s*2|diffus|voltage|temperature|density|mpa|gpa|mah|w\s*m|s\/cm|%|kelvin|\bK\b/i;

export function selectEvidenceExcerpts(document, limit = 300) {
  const pages = Array.isArray(document.pages) && document.pages.length
    ? document.pages
    : [{ page: 1, text: String(document.text ?? "") }];
  const candidates = [];
  for (const page of pages) {
    const sentences = String(page.text ?? "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      if (/\d/.test(sentence) && EVIDENCE_TERMS.test(sentence)) {
        candidates.push(`[第 ${page.page} 页] ${sentence.trim()}`);
      }
    }
  }
  const selected = [];
  let length = 0;
  for (const candidate of candidates) {
    if (length + candidate.length > limit) continue;
    selected.push(candidate);
    length += candidate.length + 1;
  }
  if (selected.length) return selected.join("\n");
  return pages.map((page) => `[第 ${page.page} 页] ${page.text}`).join("\n").slice(0, limit);
}

function documentBlock(document) {
  return `===== 文档：${document.name} =====\n${selectEvidenceExcerpts(document)}`;
}

export function buildAnalysisMessages(documents) {
  const content = documents.map(documentBlock).join("\n\n").slice(0, 900);
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `请提取以下材料文献中的结构化数据，并严格返回 JSON：\n\n${content}` },
  ];
}
