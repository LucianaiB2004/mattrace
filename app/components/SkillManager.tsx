"use client";

import { useState } from "react";
import { buildSkillDownload, loadSkill, resetSkill, saveSkill } from "../domain/skill-workspace.mjs";

type SkillManagerProps = { onNotify: (message: string, tone?: "info" | "success" | "error") => void };

function downloadSkill(content: string) {
  const output = buildSkillDownload(content);
  const href = URL.createObjectURL(new Blob([output.content], { type: `${output.mime};charset=utf-8` }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = output.filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

export default function SkillManager({ onNotify }: SkillManagerProps) {
  const [content, setContent] = useState(() => loadSkill(window.localStorage));
  const [mode, setMode] = useState<"overview" | "preview" | "edit">("overview");

  function save() {
    try {
      setContent(saveSkill(window.localStorage, content));
      onNotify("Skill 已保存到当前浏览器", "success");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "Skill 保存失败", "error");
    }
  }

  function restore() {
    setContent(resetSkill(window.localStorage));
    onNotify("已恢复比赛 Skill 默认版本", "success");
  }

  return <div className="skill-manager">
    <section className="skill-identity"><span className="skill-logo">✦</span><div><p>当前启用 Skill</p><h3>material-evidence-extractor</h3><span className="skill-status">● 已启用 · 浏览器本地版本</span></div></section>
    <div className="skill-tabs" role="tablist" aria-label="Skill 管理视图">
      <button className={mode === "overview" ? "active" : ""} type="button" onClick={() => setMode("overview")}>概览</button>
      <button className={mode === "preview" ? "active" : ""} type="button" onClick={() => setMode("preview")}>预览 Skill</button>
      <button className={mode === "edit" ? "active" : ""} type="button" onClick={() => setMode("edit")}>编辑 Skill</button>
    </div>
    {mode === "overview" && <div className="skill-overview"><article><small>适用任务</small><strong>3–10 篇材料文献</strong><p>结构化提取材料、工艺、性能、测试条件和页级证据。</p></article><article><small>核心能力</small><strong>证据链与冲突检测</strong><p>单位规范化、条件缺失检测、跨文献可比性核验。</p></article><article><small>数据边界</small><strong>本地保存、显式导出</strong><p>修改不会写回仓库，也不会保存或导出 API Key。</p></article></div>}
    {mode === "preview" && <pre className="skill-markdown-preview">{content}</pre>}
    {mode === "edit" && <textarea className="skill-editor" aria-label="Skill Markdown 编辑器" value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} />}
    <div className="skill-actions">
      <button type="button" onClick={restore}>恢复默认</button>
      <button type="button" onClick={() => downloadSkill(content)}>导出 SKILL.md</button>
      <button className="primary-button" type="button" onClick={save}>保存到浏览器</button>
    </div>
  </div>;
}
