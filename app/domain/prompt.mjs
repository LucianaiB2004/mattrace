const SYSTEM_PROMPT = `你是 MatTrace 材料文献证据提取 Agent。只根据用户提供的文档提取数据，不得补写或猜测。输出一个 JSON 对象，结构必须是：
{
  "summary": "简短总结",
  "records": [{
    "material": "材料体系",
    "process": "制备工艺",
    "property": "性能指标",
    "value": 1.23,
    "unit": "原始单位",
    "conditions": { "temperature": "温度", "method": "测试方法", "other": "其他条件" },
    "sourceDocument": "文档名",
    "page": 1,
    "evidence": "文档中的直接证据原文",
    "confidence": "high|medium|low"
  }],
  "missingConditions": [{ "recordIndex": 0, "field": "字段名", "message": "缺失说明" }],
  "conflicts": [{ "recordIndexes": [0, 1], "message": "冲突说明", "differencePercent": 35 }]
}
value 必须是数值；每条记录必须有可核对的 sourceDocument、page 和 evidence。没有证据的数据不要输出。`;

function documentBlock(document) {
  const pages = Array.isArray(document.pages) && document.pages.length
    ? document.pages.map((page) => `[第 ${page.page} 页]\n${page.text}`).join("\n\n")
    : document.text;
  return `===== 文档：${document.name} =====\n${pages.slice(0, 40_000)}`;
}

export function buildAnalysisMessages(documents) {
  const content = documents.map(documentBlock).join("\n\n").slice(0, 120_000);
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `请提取以下材料文献中的结构化数据，并严格返回 JSON：\n\n${content}` },
  ];
}
