const STORAGE_KEY = "mattrace.skill.material-evidence-extractor.v1";

export const DEFAULT_SKILL_CONTENT = `---
name: material-evidence-extractor
description: Extract structured material composition, processing, property, test-condition, and provenance records from 3-10 papers with page-level evidence, unit normalization, missing-condition detection, and cross-document conflict checks.
---

# Material Evidence Extractor

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
8. 生成交付物：输出结构化记录、对比表、证据报告、缺失与冲突清单。

## 输出前检查

- 每个数值都有 source_document 和 page。
- 原始值、规范化值和换算说明相互一致。
- 不同测试条件的数据不直接排名。
- 缺失字段不由模型补全。
- 冲突记录保留全部来源，不静默覆盖。`;

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
