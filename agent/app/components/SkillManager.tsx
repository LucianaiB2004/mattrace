"use client";

import { useState } from "react";
import { buildSkillDownload, buildSkillZip, loadSkillWorkspace, resetSkillWorkspace, saveSkillFile, summarizeSkillFiles } from "../domain/skill-workspace.mjs";

type SkillFile = { path: string; content: string; category: string; editable: boolean; language: string };
type SkillManagerProps = { onNotify: (message: string, tone?: "info" | "success" | "error") => void };

function downloadBlob(blob: Blob, filename: string) { const href = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = href; anchor.download = filename; anchor.click(); URL.revokeObjectURL(href); }

export default function SkillManager({ onNotify }: SkillManagerProps) {
  const [workspace, setWorkspace] = useState(() => loadSkillWorkspace(window.localStorage));
  const [mode, setMode] = useState<"overview" | "files">("overview");
  const [selectedPath, setSelectedPath] = useState("SKILL.md");
  const [editing, setEditing] = useState(false);
  const selected = workspace.files.find((file: SkillFile) => file.path === selectedPath) as SkillFile;
  const [draft, setDraft] = useState(selected.content);
  const counts = summarizeSkillFiles(workspace.files);

  function select(file: SkillFile) { setSelectedPath(file.path); setDraft(file.content); setEditing(false); }
  function save() { try { saveSkillFile(window.localStorage, selected.path, draft); const next = loadSkillWorkspace(window.localStorage); setWorkspace(next); setDraft(next.files.find((file: SkillFile) => file.path === selected.path)?.content ?? draft); setEditing(false); onNotify("Skill 文件已保存到当前浏览器", "success"); } catch (error) { onNotify(error instanceof Error ? error.message : "Skill 保存失败", "error"); } }
  function restore() { const next = resetSkillWorkspace(window.localStorage); setWorkspace(next); const file = next.files.find((item: SkillFile) => item.path === selectedPath) ?? next.files[0]; setDraft(file.content); setEditing(false); onNotify("已恢复完整 Skill 默认版本", "success"); }
  function exportFile() { const output = buildSkillDownload(selected.content); downloadBlob(new Blob([output.content], { type: output.mime }), selected.path.split("/").at(-1) ?? output.filename); }
  async function exportZip() { try { downloadBlob(await buildSkillZip(workspace), "material-evidence-extractor.zip"); onNotify("完整 Skill ZIP 已生成", "success"); } catch { onNotify("Skill ZIP 生成失败", "error"); } }

  return <div className="skill-manager">
    <section className="skill-identity"><span className="skill-logo">✦</span><div><p>完整可复用 Skill</p><h3>material-evidence-extractor</h3><span className="skill-status">● 已启用 · {workspace.files.length} 个文件 · 浏览器本地版本</span></div></section>
    <div className="skill-tabs" role="tablist" aria-label="Skill 管理视图"><button className={mode === "overview" ? "active" : ""} type="button" onClick={() => setMode("overview")}>交付概览</button><button className={mode === "files" ? "active" : ""} type="button" onClick={() => setMode("files")}>完整文件</button></div>
    {mode === "overview" ? <div className="skill-overview"><article><small>任务输入</small><strong>3–10 篇论文、专利或 TDS</strong><p>抽取材料组成、实验条件、性能指标、单位、测试条件、来源页码、缺失字段和可信度。</p></article><article><small>Skill 输出</small><strong>JSON/CSV + 证据链</strong><p>同时生成缺失条件报告、可信度评分、冲突清单和可复查引用。</p></article><article><small>完整交付</small><strong>合同 {counts.contract} · 示例 {counts.example} · 核心代码 {counts.code}</strong><p>页面展示内容与 ZIP 使用同一个权威文件清单，包含 Schema、失败案例与 uplift 评分器，API Key 永不进入 Skill 包。</p></article></div> : <div className="skill-workspace"><nav className="skill-file-tree" aria-label="Skill 文件树">{["contract", "example", "code"].map((category) => <section key={category}><strong>{category === "contract" ? "Skill 合同" : category === "example" ? "输出示例" : "核心代码"}</strong>{workspace.files.filter((file: SkillFile) => file.category === category).map((file: SkillFile) => <button className={file.path === selectedPath ? "active" : ""} type="button" onClick={() => select(file)} key={file.path}>{file.path}{file.editable ? " ✎" : ""}</button>)}</section>)}</nav><section className="skill-file-view"><header><div><small>{selected.editable ? "可编辑文件" : "只读文件"}</small><strong>{selected.path}</strong></div>{selected.editable && !editing && <button type="button" onClick={() => setEditing(true)}>编辑当前文件</button>}</header>{editing ? <textarea className="skill-editor" aria-label="Skill Markdown 编辑器" value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} /> : <pre className="skill-markdown-preview">{selected.content}</pre>}{editing && <div className="skill-inline-actions"><button type="button" onClick={() => { setDraft(selected.content); setEditing(false); }}>取消</button><button className="primary-button" type="button" onClick={save}>保存当前文件</button></div>}</section></div>}
    <div className="skill-actions"><button type="button" onClick={restore}>恢复默认</button><button type="button" onClick={exportFile}>导出 {selected.path.split("/").at(-1)}</button><button className="primary-button" type="button" onClick={() => void exportZip()}>导出完整 Skill ZIP</button></div>
  </div>;
}
