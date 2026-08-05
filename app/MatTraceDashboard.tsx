"use client";

import Image from "next/image";
import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import DetailsDrawer from "./components/DetailsDrawer";
import SettingsDialog from "./components/SettingsDialog";
import SkillManager from "./components/SkillManager";
import ToastRegion, { type Toast } from "./components/ToastRegion";
import { EXAMPLE_DOCUMENTS, createExampleReport } from "./domain/example-data.mjs";
import { buildExport } from "./domain/export-report.mjs";
import { createProjectSnapshot } from "./domain/project-snapshot.mjs";
import { createWorkflowState, transitionWorkflow } from "./domain/workflow.mjs";
import { analyzeDocuments } from "./services/ai-client.mjs";
import { parseDocument } from "./services/document-parser.mjs";
import { validateFiles } from "./services/file-validation.mjs";
import { createProjectStore } from "./services/project-store.mjs";
import { DEFAULT_PROVIDER } from "./lib/mattrace-core.mjs";
import "./MatTraceDashboard.css";

type ParsedDocument = {
  id: string; name: string; type: string; size: number; pageCount: number;
  text: string; pages: Array<{ page: number; text: string }>;
  status: string; example?: boolean;
};
type RecordRow = {
  id: string; material: string; process: string; property: string; value: number;
  unit: string; normalizedValue: number; normalizedUnit: string;
  conditions: Record<string, string>; conditionText: string; sourceDocument: string;
  page: number | string; evidence: string; confidence: "high" | "medium" | "low";
};
type AlertItem = { id: string; recordId?: string; recordIds?: string[]; message: string; field?: string; differencePercent?: number | null };
type Report = { records: RecordRow[]; missingConditions: AlertItem[]; conflicts: AlertItem[]; summary: string; generatedAt: string };
type Workflow = { phase: string; mode: string | null; activeStage: number; documentCount: number; reportId: string | null; error: string | null };
type Drawer = "skill" | "documents" | "records" | "evidence" | "missing" | "conflicts" | "export" | "privacy" | null;

const navItems = [
  ["⌂", "首页", "Dashboard", "dashboard"], ["✦", "Skill 管理", "Skill Studio", "skill"],
  ["▤", "文献管理", "Documents", "documents"],
  ["⌗", "数据提取", "Extraction", "results"], ["◇", "证据链", "Evidence", "evidence"],
  ["⚠", "冲突检测", "Conflicts", "conflicts"], ["⇩", "报告导出", "Export", "export"],
  ["⚙", "设置", "Settings", "settings"],
] as const;
const stageLabels = ["文献解析", "数据提取", "单位规范化", "条件核验", "冲突检测", "报告生成"];
const stageIcons = ["◴", "◉", "♨", "⌁", "↔", "✦"];

function bytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function download(output: { filename: string; content: string; mime: string }) {
  const href = URL.createObjectURL(new Blob([output.content], { type: `${output.mime};charset=utf-8` }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = output.filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function delay(milliseconds: number) { return new Promise((resolve) => window.setTimeout(resolve, milliseconds)); }

export default function MatTraceDashboard() {
  const initialReport = useMemo(() => createExampleReport() as Report, []);
  const [activeNav, setActiveNav] = useState("首页");
  const [documents, setDocuments] = useState<ParsedDocument[]>(() => [...EXAMPLE_DOCUMENTS] as ParsedDocument[]);
  const [report, setReport] = useState<Report | null>(initialReport);
  const [selectedRecordId, setSelectedRecordId] = useState(initialReport.records[0].id);
  const [workflow, setWorkflow] = useState<Workflow>(() => ({ ...createWorkflowState(), phase: "success", mode: "example", activeStage: 5, documentCount: 3, reportId: "example-report" }));
  const [gateway, setGateway] = useState(DEFAULT_PROVIDER.gateway);
  const [model, setModel] = useState(DEFAULT_PROVIDER.model);
  const [apiKey, setApiKey] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [documentPreview, setDocumentPreview] = useState<ParsedDocument | null>(null);
  const [exportFormat, setExportFormat] = useState<"json" | "csv" | "markdown">("markdown");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const records = report?.records ?? [];
  const activeRecord = records.find((item) => item.id === selectedRecordId) ?? records[0] ?? null;
  const realDocuments = documents.filter((item) => !item.example);
  const isBusy = workflow.phase === "parsing" || workflow.phase === "analyzing";
  const exportOutput = report?.records.length ? buildExport(exportFormat, report) : null;
  const materialCount = new Set(records.map((item) => item.material)).size;
  const propertyCount = new Set(records.map((item) => item.property)).size;

  function notify(message: string, tone: Toast["tone"] = "info") {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3600);
  }

  function navigate(zh: string, target: string) {
    setActiveNav(zh);
    if (target === "settings") { setSettingsOpen(true); return; }
    if (["skill", "documents", "records", "evidence", "conflicts", "export"].includes(target)) {
      setDrawer(target === "results" ? "records" : target as Drawer);
      return;
    }
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function addFiles(incoming: File[]) {
    const existing = documents.filter((item) => !item.example);
    const validation = validateFiles(incoming, existing);
    validation.rejected.forEach((item: { message: string; file: File }) => notify(`${item.file.name}：${item.message}`, "error"));
    if (!validation.accepted.length) return;
    setWorkflow((state) => transitionWorkflow(state, { type: "PARSE_STARTED" }));
    const parsed: ParsedDocument[] = [];
    for (const file of validation.accepted) {
      try {
        parsed.push(await parseDocument(file));
        notify(`${file.name} 解析完成`, "success");
      } catch (error) {
        notify(error instanceof Error ? error.message : `${file.name} 解析失败`, "error");
      }
    }
    const next = [...existing, ...parsed];
    setDocuments(next);
    setReport(null);
    setSelectedRecordId("");
    setWorkflow((state) => next.length
      ? transitionWorkflow(state, { type: "PARSE_SUCCEEDED", documentCount: next.length })
      : transitionWorkflow(state, { type: "PARSE_FAILED", error: "没有成功解析的文档" }));
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    void addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }

  function removeDocument(id: string) {
    const next = documents.filter((item) => item.id !== id);
    setDocuments(next);
    if (!next.some((item) => item.example)) { setReport(null); setSelectedRecordId(""); }
    notify("文档已移除", "success");
  }

  async function runExample() {
    if (isBusy) return;
    setDocuments([...EXAMPLE_DOCUMENTS] as ParsedDocument[]);
    setReport(null);
    setWorkflow((state) => transitionWorkflow(state, { type: "ANALYSIS_STARTED", mode: "example" }));
    for (let stage = 0; stage < 6; stage += 1) {
      setWorkflow((state) => transitionWorkflow(state, { type: "STAGE_CHANGED", stage }));
      await delay(260);
    }
    const next = createExampleReport() as Report;
    setReport(next);
    setSelectedRecordId(next.records[0].id);
    setWorkflow((state) => transitionWorkflow(state, { type: "ANALYSIS_SUCCEEDED", reportId: "example-report" }));
    notify("示例分析完成，所有结果均标记为示例数据", "success");
  }

  async function runRealAnalysis() {
    if (realDocuments.length < 3) { notify("真实分析需要至少 3 篇已解析文档", "error"); setDrawer("documents"); return; }
    if (!apiKey.trim()) { notify("请先在模型配置中输入 API Key", "error"); setSettingsOpen(true); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setReport(null);
    setWorkflow((state) => transitionWorkflow(state, { type: "ANALYSIS_STARTED", mode: "real" }));
    try {
      const next = await analyzeDocuments(
        { gateway, model, apiKey }, realDocuments, fetch, controller.signal,
        (stage: number) => setWorkflow((state) => transitionWorkflow(state, { type: "STAGE_CHANGED", stage })),
      ) as Report;
      setReport(next);
      setSelectedRecordId(next.records[0]?.id ?? "");
      setWorkflow((state) => transitionWorkflow(state, { type: "ANALYSIS_SUCCEEDED", reportId: `report-${Date.now()}` }));
      notify(`真实分析完成，共提取 ${next.records.length} 条数据`, "success");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setWorkflow((state) => transitionWorkflow(state, { type: "ANALYSIS_CANCELLED" }));
        notify("分析已取消，文档仍保留在工作区", "info");
      } else {
        const message = error instanceof Error ? error.message : "分析失败";
        setWorkflow((state) => transitionWorkflow(state, { type: "ANALYSIS_FAILED", error: message }));
        notify(message, "error");
      }
    } finally { abortRef.current = null; }
  }

  function cancelAnalysis() { abortRef.current?.abort(); }

  async function saveProject() {
    try {
      const snapshot = createProjectSnapshot({ documents, report, gateway, model, selectedRecordId });
      await createProjectStore().saveProject(snapshot);
      notify("当前项目已安全保存，不包含 API Key", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "项目保存失败", "error"); }
  }

  async function restoreProject() {
    try {
      const snapshot = await createProjectStore().loadProject();
      if (!snapshot) { notify("没有找到已保存的项目", "info"); return; }
      setDocuments(snapshot.documents as ParsedDocument[]);
      setReport(snapshot.report as Report | null);
      setGateway(snapshot.provider.gateway);
      setModel(snapshot.provider.model);
      setSelectedRecordId(snapshot.selectedRecordId ?? snapshot.report?.records?.[0]?.id ?? "");
      setWorkflow({ ...createWorkflowState(), phase: snapshot.report ? "success" : "ready", documentCount: snapshot.documents.length, activeStage: snapshot.report ? 5 : 0, reportId: snapshot.report ? "restored-report" : null } as Workflow);
      notify("项目已恢复，API Key 仍为空", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "项目恢复失败", "error"); }
  }

  async function deleteSavedProject() {
    try { await createProjectStore().deleteProject(); notify("已保存项目已删除", "success"); }
    catch (error) { notify(error instanceof Error ? error.message : "删除失败", "error"); }
  }

  function openExport(format: "json" | "csv" | "markdown") { setExportFormat(format); setDrawer("export"); }
  async function copyExport() {
    if (!exportOutput) return;
    try { await navigator.clipboard.writeText(exportOutput.content); notify("报告内容已复制", "success"); }
    catch { notify("浏览器未授予剪贴板权限，请使用下载", "error"); }
  }

  const summaryCards = [
    { label: "提取数据条数", value: records.length, tone: "violet", icon: "▥", drawer: "records" as Drawer },
    { label: "材料体系", value: materialCount, tone: "mint", icon: "⌬", drawer: "records" as Drawer },
    { label: "性能指标", value: propertyCount, tone: "blue", icon: "◴", drawer: "records" as Drawer },
    { label: "缺失条件", value: report?.missingConditions.length ?? 0, tone: "amber", icon: "!", drawer: "missing" as Drawer },
    { label: "冲突项", value: report?.conflicts.length ?? 0, tone: "coral", icon: "△", drawer: "conflicts" as Drawer },
  ];

  return (
    <main className="app-shell" id="dashboard">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand"><span className="brand-mark" aria-hidden="true">✦</span><div><strong>MatTrace</strong><small>Evidence-first AI</small></div></div>
        <nav className="nav-list">{navItems.map(([icon, zh, en, target]) => (
          <button className={`nav-item ${activeNav === zh ? "active" : ""}`} key={zh} onClick={() => navigate(zh, target)} type="button"><span className="nav-icon" aria-hidden="true">{icon}</span><span>{zh}</span><small>/ {en}</small></button>
        ))}</nav>
        <div className="mascot-zone"><p>Let&apos;s trace<br />every data!</p><Image src="/mattrace-mascot.png" alt="MatTrace 科研机器人" width={1024} height={1536} priority unoptimized /></div>
        <button className="skill-pill" type="button" onClick={() => setDrawer("skill")}><span /> Skill: material-evidence-extractor</button>
      </aside>

      <section className="workspace">
        <header className="topbar"><div><p className="eyebrow">MATERIALS INTELLIGENCE WORKSPACE</p><h1>Hi, 研究者 <span aria-hidden="true">👋</span></h1><p>让每一条材料数据都有出处、有条件、可复查。</p></div><div className="top-actions"><button className="project-action" type="button" onClick={saveProject}>保存当前项目</button><button className="project-action" type="button" onClick={restoreProject}>恢复项目</button><button className="model-button" onClick={() => setSettingsOpen(true)} type="button" aria-label="打开模型配置" title={gateway}><span className="status-dot" /><span><small>模型配置</small>{model}</span><b>⌄</b></button></div></header>

        <div className="content-grid"><section className="main-column">
          <article className="card upload-card" id="documents" aria-labelledby="upload-title">
            <div className="section-heading"><div><h2 id="upload-title">文档工作区 <span>（3–10 篇）</span></h2><p>PDF、DOCX、TXT、Markdown 均在浏览器本地解析</p></div><div className="run-actions"><button className="secondary-run" type="button" disabled={isBusy} onClick={runExample}>使用示例运行</button>{workflow.phase === "analyzing" ? <button className="run-button danger" type="button" onClick={cancelAnalysis}>取消分析</button> : <button className="run-button" type="button" disabled={isBusy} onClick={runRealAnalysis}>开始真实分析</button>}</div></div>
            <div className="mode-banner"><span className={workflow.mode === "real" ? "real" : "example"}>{workflow.mode === "real" ? "真实分析" : "示例数据"}</span><p>{workflow.phase === "error" ? workflow.error : workflow.phase === "cancelled" ? "分析已取消，可调整后重试" : report?.summary ?? "文档已就绪，等待开始分析"}</p><button type="button" onClick={() => setDrawer("privacy")}>隐私与数据流</button></div>
            <div className="upload-layout"><button className={`drop-zone ${isDragging ? "dragging" : ""}`} type="button" onClick={() => fileInputRef.current?.click()} onDragEnter={() => setIsDragging(true)} onDragLeave={() => setIsDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}><span className="upload-art" aria-hidden="true">⇧</span><strong>拖拽文件到这里，或点击上传</strong><small>支持 PDF、DOCX、TXT、MD（≤ 50MB）</small></button><input ref={fileInputRef} className="sr-only" type="file" multiple accept=".pdf,.docx,.txt,.md" onChange={handleFiles} />
              <div className="file-tray"><div className="tray-heading"><p>已添加 {documents.length}/10</p><button type="button" onClick={() => { setDocuments([]); setReport(null); setSelectedRecordId(""); notify("工作区已清空", "success"); }}>清空</button></div><div className="file-list">{documents.slice(0, 5).map((file) => <button className="file-chip" key={file.id} title={`${file.name} · ${bytes(file.size)}`} type="button" onClick={() => setDocumentPreview(file)}><span className={`file-type ${file.type}`}>{file.type.toUpperCase()}</span><small>{file.name.replace(/\.[^.]+$/, "")}</small><i>{file.example ? "示例" : `${file.pageCount}页`}</i></button>)}{documents.length < 10 && <button className="add-file" type="button" onClick={() => fileInputRef.current?.click()} aria-label="添加更多文献">+</button>}</div></div>
            </div>
          </article>

          <article className="card progress-card" aria-labelledby="progress-title"><div className="section-heading compact"><div><h2 id="progress-title">Agent 工作进度</h2><p>每一步都有显式状态，失败后可保留文档重试</p></div><span className={`phase-pill ${workflow.phase}`}>{workflow.phase === "analyzing" ? `${workflow.activeStage + 1}/6 进行中` : workflow.phase === "success" ? "6/6 已完成" : workflow.phase === "parsing" ? "解析中" : workflow.phase === "error" ? "需要处理" : "等待运行"}</span></div><div className="stage-track">{stageLabels.map((label, index) => { const status = workflow.phase === "success" || (workflow.phase === "analyzing" && index < workflow.activeStage) ? "complete" : workflow.phase === "analyzing" && index === workflow.activeStage ? "active" : "pending"; return <div className={`stage ${status}`} key={label}><div className="stage-top"><span className="stage-icon">{stageIcons[index]}</span>{index < 5 && <i />}</div><strong>{label}</strong><small>{status === "complete" ? "已完成" : status === "active" ? "进行中…" : "等待中"}</small></div>; })}</div></article>

          <article className="card data-card" id="results" aria-labelledby="overview-title"><div className="section-heading compact"><div><h2 id="overview-title">分析结果与证据</h2><p>点击数据行可查看原文、页码和来源文档</p></div><button className="text-button" type="button" onClick={() => setDrawer("records")}>查看全部数据 →</button></div><div className="summary-grid">{summaryCards.map((item) => <button className={`summary-card ${item.tone}`} key={item.label} type="button" onClick={() => setDrawer(item.drawer)}><span><small>{item.label}</small><strong>{item.value}</strong></span><b aria-hidden="true">{item.icon}</b></button>)}</div>
            <div className="table-wrap"><table><thead><tr><th>材料体系</th><th>制备工艺</th><th>性能指标</th><th>数值（单位）</th><th>测试条件</th><th>来源</th><th>可信度</th></tr></thead><tbody>{records.length ? records.slice(0, 5).map((record) => <tr className={selectedRecordId === record.id ? "selected" : ""} key={record.id} onClick={() => { setSelectedRecordId(record.id); setDrawer("evidence"); }} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { setSelectedRecordId(record.id); setDrawer("evidence"); } }}><td>{record.material}</td><td>{record.process}</td><td>{record.property}</td><td>{record.value} {record.unit}</td><td>{record.conditionText}</td><td>{record.sourceDocument} · P.{record.page}</td><td><span className={`confidence ${record.confidence}`}>{record.confidence === "high" ? "高" : record.confidence === "medium" ? "中" : "低"}</span></td></tr>) : <tr><td colSpan={7} className="empty-cell">暂无结果，请使用示例运行或完成真实分析</td></tr>}</tbody></table></div>
          </article>
          <footer className="workspace-footer"><span>♢ {workflow.mode === "real" ? "真实分析模式" : "示例演示模式"}</span><i /><span>由 material-evidence-extractor Skill 驱动</span></footer>
        </section>

        <aside className="insight-column" aria-label="证据与风险摘要">
          <article className="card evidence-card" id="evidence"><div className="section-heading compact"><div><h2>证据链预览 <span>✦</span></h2></div><button className="text-button" type="button" onClick={() => setDrawer("evidence")}>查看全部</button></div>{activeRecord ? <><div className="document-preview" aria-hidden="true"><div className="paper-lines"><b>EXTRACTED EVIDENCE</b><span /><span /><span /><span /><em>{activeRecord.sourceDocument}</em><span /><span /></div><strong>P.{activeRecord.page}</strong></div><blockquote>“{activeRecord.evidence}”</blockquote><p className="citation">{activeRecord.sourceDocument} · Page {activeRecord.page}</p><div className="evidence-tabs">{records.slice(0, 5).map((record, index) => <button className={selectedRecordId === record.id ? "active" : ""} key={record.id} onClick={() => setSelectedRecordId(record.id)} type="button" aria-label={`查看 ${record.material} 的证据`}>{index + 1}</button>)}</div></> : <div className="empty-panel">运行分析后在这里核对证据原文</div>}</article>
          <button className="alert-card missing" type="button" onClick={() => setDrawer("missing")}><div><h3>缺失条件提醒 <span>{report?.missingConditions.length ?? 0}</span></h3><p>{report?.missingConditions[0]?.message ?? "暂无缺失条件"}</p></div><b aria-hidden="true">⚗</b></button>
          <button className="alert-card conflict" id="conflicts" type="button" onClick={() => setDrawer("conflicts")}><div><h3>冲突检测提醒 <span>{report?.conflicts.length ?? 0}</span></h3><p>{report?.conflicts[0]?.message ?? "暂无数值冲突"}</p></div><b aria-hidden="true">△</b></button>
          <article className="card export-card" id="export"><div className="section-heading compact"><div><h2>导出报告</h2></div><button className="text-button" type="button" onClick={() => setDrawer("export")}>导出预览</button></div><div className="export-actions">{(["json", "csv", "markdown"] as const).map((format) => <button type="button" disabled={!report?.records.length} onClick={() => openExport(format)} key={format}><b>{format === "json" ? "⌘" : format === "csv" ? "▦" : "▤"}</b><span>{format === "markdown" ? "Markdown" : format.toUpperCase()}</span></button>)}</div></article>
          <article className="card session-card"><h3>项目与隐私</h3><p>仅在你点击保存时写入本浏览器，永不包含 API Key。</p><div><button type="button" onClick={saveProject}>保存</button><button type="button" onClick={deleteSavedProject}>删除存档</button></div></article>
        </aside></div>
      </section>

      {settingsOpen && <SettingsDialog open gateway={gateway} model={model} apiKey={apiKey} onClose={() => setSettingsOpen(false)} onApply={(value) => { setGateway(value.gateway); setModel(value.model); setApiKey(value.apiKey); }} onNotify={notify} />}
      <ToastRegion toasts={toasts} />

      <DetailsDrawer open={drawer !== null || documentPreview !== null} onClose={() => { setDrawer(null); setDocumentPreview(null); }} title={documentPreview ? documentPreview.name : drawer === "skill" ? "Skill 管理" : drawer === "documents" ? "文档管理" : drawer === "records" ? "全部提取数据" : drawer === "evidence" ? "证据链详情" : drawer === "missing" ? "缺失条件" : drawer === "conflicts" ? "冲突检测" : drawer === "export" ? "导出预览" : "隐私与数据流"} subtitle={documentPreview ? `${documentPreview.type.toUpperCase()} · ${bytes(documentPreview.size)} · ${documentPreview.pageCount} 页` : drawer === "skill" ? "预览、修改并导出比赛 Skill" : undefined}>
        {!documentPreview && drawer === "skill" && <SkillManager onNotify={notify} />}
        {documentPreview && <><div className="document-text-preview">{documentPreview.pages.map((page) => <section key={page.page}><strong>第 {page.page} 页</strong><p>{page.text || "本页没有可提取文本"}</p></section>)}</div><button className="drawer-danger" type="button" onClick={() => { removeDocument(documentPreview.id); setDocumentPreview(null); }}>移除此文档</button></>}
        {!documentPreview && drawer === "documents" && <div className="drawer-list">{documents.map((doc) => <article key={doc.id}><span className={`file-type ${doc.type}`}>{doc.type.toUpperCase()}</span><div><strong>{doc.name}</strong><p>{bytes(doc.size)} · {doc.pageCount} 页 · {doc.example ? "示例文档" : "本地已解析"}</p></div><button type="button" onClick={() => setDocumentPreview(doc)}>预览</button><button type="button" onClick={() => removeDocument(doc.id)}>移除</button></article>)}</div>}
        {!documentPreview && drawer === "records" && <div className="record-grid">{records.map((record) => <button key={record.id} type="button" onClick={() => { setSelectedRecordId(record.id); setDrawer("evidence"); }}><span>{record.material}</span><strong>{record.value} {record.unit}</strong><small>{record.property} · {record.sourceDocument}</small></button>)}</div>}
        {!documentPreview && drawer === "evidence" && (activeRecord ? <div className="evidence-detail"><div className="evidence-meta"><span>{activeRecord.material}</span><span>{activeRecord.property}</span><span>{activeRecord.value} {activeRecord.unit}</span><span>{activeRecord.confidence}</span></div><blockquote>{activeRecord.evidence}</blockquote><p><strong>来源：</strong>{activeRecord.sourceDocument} · 第 {activeRecord.page} 页</p><p><strong>制备：</strong>{activeRecord.process}</p><p><strong>条件：</strong>{activeRecord.conditionText}</p><div className="drawer-tabs">{records.map((record) => <button className={record.id === selectedRecordId ? "active" : ""} key={record.id} type="button" onClick={() => setSelectedRecordId(record.id)}>{record.id}</button>)}</div></div> : <div className="drawer-empty">暂无证据</div>)}
        {!documentPreview && drawer === "missing" && <div className="issue-list">{report?.missingConditions.length ? report.missingConditions.map((item) => <article key={item.id}><b>!</b><div><strong>{item.message}</strong><p>关联记录：{item.recordId}</p></div><button type="button" onClick={() => { setSelectedRecordId(item.recordId ?? ""); setDrawer("evidence"); }}>查看证据</button></article>) : <div className="drawer-empty">没有发现缺失条件</div>}</div>}
        {!documentPreview && drawer === "conflicts" && <div className="issue-list conflict-list">{report?.conflicts.length ? report.conflicts.map((item) => <article key={item.id}><b>△</b><div><strong>{item.message}</strong><p>相关记录：{item.recordIds?.join("、")} · 差异 {item.differencePercent ?? "待核验"}%</p></div><button type="button" onClick={() => { setSelectedRecordId(item.recordIds?.[0] ?? ""); setDrawer("evidence"); }}>核对来源</button></article>) : <div className="drawer-empty">没有发现跨文献数值冲突</div>}</div>}
        {!documentPreview && drawer === "export" && <div className="export-workspace"><div className="format-tabs">{(["json", "csv", "markdown"] as const).map((format) => <button className={exportFormat === format ? "active" : ""} type="button" key={format} onClick={() => setExportFormat(format)}>{format === "markdown" ? "Markdown" : format.toUpperCase()}</button>)}</div>{exportOutput ? <><pre>{exportOutput.content}</pre><div className="drawer-actions"><button type="button" onClick={copyExport}>复制内容</button><button className="primary-button" type="button" onClick={() => download(exportOutput)}>下载 {exportOutput.filename}</button></div></> : <div className="drawer-empty">暂无可导出的分析结果</div>}</div>}
        {!documentPreview && drawer === "privacy" && <div className="privacy-detail"><section><b>1</b><div><h3>浏览器本地处理</h3><p>原始 PDF、DOCX、TXT 与 Markdown 在当前浏览器解析，不上传到 MatTrace 服务器。</p></div></section><section><b>2</b><div><h3>模型请求内容</h3><p>点击真实分析后，仅向你配置的 API 发送文档名、页码和解析后的文本。</p></div></section><section><b>3</b><div><h3>API Key</h3><p>Key 只存在于 React 内存，页面刷新即清除；不会进入 IndexedDB、导出、日志或 URL。</p></div></section><section><b>4</b><div><h3>项目保存</h3><p>只有主动点击保存才写入 IndexedDB，内容限于文档解析结果、分析报告和公开模型配置。</p></div></section></div>}
      </DetailsDrawer>
    </main>
  );
}
