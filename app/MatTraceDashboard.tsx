"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  DEFAULT_PROVIDER,
  advanceDemoState,
  createDemoState,
  serializeExport,
  type DemoState,
} from "./lib/mattrace-core.mjs";
import "./MatTraceDashboard.css";

type RecordRow = {
  material: string;
  process: string;
  property: string;
  value: string;
  condition: string;
  source: string;
  confidence: string;
  evidence: string;
  page: string;
};

const navItems = [
  ["⌂", "首页", "Dashboard"],
  ["▤", "文献管理", "Documents"],
  ["⌗", "数据提取", "Extraction"],
  ["◇", "证据链", "Evidence"],
  ["⚠", "冲突检测", "Conflicts"],
  ["⇩", "报告导出", "Export"],
  ["⚙", "设置", "Settings"],
];

const demoFiles = [
  { name: "Adv. Mater. 2024", type: "PDF" },
  { name: "J. Alloys Compd. 2023", type: "PDF" },
  { name: "Acta Mater. 2022", type: "PDF" },
  { name: "CN1145*** 专利", type: "DOCX" },
];

const records: RecordRow[] = [
  {
    material: "Li₇La₃Zr₂O₁₂",
    process: "固相烧结",
    property: "离子电导率",
    value: "1.2 × 10⁻³ S/cm",
    condition: "25°C，阻抗法",
    source: "Adv. Mater. 2024, Table 1",
    confidence: "高",
    evidence:
      "The ionic conductivity of LLZO sintered at 900°C was measured to be 1.2 × 10⁻³ S/cm at 25°C.",
    page: "P.12 · Table 1",
  },
  {
    material: "CoCrFeNiMo₀.₅",
    process: "真空熔炼",
    property: "屈服强度",
    value: "685 MPa",
    condition: "室温，拉伸速率 1e−3 s⁻¹",
    source: "J. Alloys Compd. 2023, Fig. 3",
    confidence: "中",
    evidence:
      "The alloy reached a yield strength of 685 MPa under room-temperature tensile testing.",
    page: "P.8 · Fig. 3",
  },
  {
    material: "Ti₃AlC₂ MXene",
    process: "HF 刻蚀",
    property: "比容量",
    value: "312 mAh/g",
    condition: "1 A/g，三电极",
    source: "Acta Mater. 2022, Table S2",
    confidence: "高",
    evidence:
      "A specific capacity of 312 mAh/g was reported at 1 A/g in a three-electrode configuration.",
    page: "P.S6 · Table S2",
  },
];

const summaryCards = [
  { label: "提取数据条数", value: "87", tone: "violet", icon: "▥" },
  { label: "材料体系", value: "23", tone: "mint", icon: "⌬" },
  { label: "性能指标", value: "8", tone: "blue", icon: "◴" },
  { label: "缺失条件", value: "3", tone: "amber", icon: "!" },
  { label: "冲突项", value: "2", tone: "coral", icon: "△" },
];

const stageIcons = ["◴", "◉", "♨", "⌁", "↔", "✦"];

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

export default function MatTraceDashboard() {
  const [activeNav, setActiveNav] = useState("首页");
  const [files, setFiles] = useState(demoFiles);
  const [selectedRecord, setSelectedRecord] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gateway, setGateway] = useState(DEFAULT_PROVIDER.gateway);
  const [model, setModel] = useState(DEFAULT_PROVIDER.model);
  const [apiKey, setApiKey] = useState("");
  const [connection, setConnection] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [connectionMessage, setConnectionMessage] = useState(
    "Key 仅保存在当前页面内存中",
  );
  const [demoState, setDemoState] = useState<DemoState>(() => {
    let state = createDemoState();
    for (let step = 0; step < 5; step += 1) state = advanceDemoState(state);
    return state;
  });
  const [isRunning, setIsRunning] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeEvidence = records[selectedRecord];
  const completedStages = demoState.stages.filter(
    (stage) => stage.status === "complete",
  ).length;
  const runLabel = isRunning ? "生成报告中" : "重新演示";

  const publicConfig = useMemo(
    () => ({ gateway, model }),
    [gateway, model],
  );

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
      .slice(0, Math.max(0, 10 - files.length))
      .map((file) => ({
        name: file.name.replace(/\.[^.]+$/, ""),
        type: file.name.split(".").pop()?.toUpperCase() || "FILE",
      }));
    if (selected.length) setFiles((current) => [...current, ...selected]);
    event.target.value = "";
  }

  function runDemo() {
    setIsRunning(true);
    let state = createDemoState();
    setDemoState(state);
    let step = 0;
    const timer = window.setInterval(() => {
      state = advanceDemoState(state);
      setDemoState(state);
      step += 1;
      if (step >= 6) {
        window.clearInterval(timer);
        setIsRunning(false);
      }
    }, 560);
  }

  async function testConnection() {
    if (!apiKey.trim()) {
      setConnection("error");
      setConnectionMessage("请输入 API Key 后再测试连接");
      return;
    }

    setConnection("testing");
    setConnectionMessage("正在连接模型服务…");
    const base = gateway.replace(/\/$/, "");
    const url = base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setConnection("success");
      setConnectionMessage("连接成功，Key 未被保存");
    } catch {
      setConnection("error");
      setConnectionMessage("连接失败，请检查地址、Key 或浏览器跨域限制");
    }
  }

  function exportData(format: "json" | "csv" | "markdown") {
    const safeRecords = records.map((record) =>
      Object.fromEntries(
        Object.entries(record).filter(([key]) => key !== "evidence" && key !== "page"),
      ),
    );
    const extensions = { json: "json", csv: "csv", markdown: "md" };
    const mimes = {
      json: "application/json",
      csv: "text/csv",
      markdown: "text/markdown",
    };
    downloadText(
      `mattrace-report.${extensions[format]}`,
      serializeExport(format, safeRecords),
      mimes[format],
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <div>
            <strong>MatTrace</strong>
            <small>Evidence-first AI</small>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map(([icon, zh, en]) => (
            <button
              className={`nav-item ${activeNav === zh ? "active" : ""}`}
              key={zh}
              onClick={() => {
                setActiveNav(zh);
                if (zh === "设置") setSettingsOpen(true);
              }}
              type="button"
            >
              <span className="nav-icon" aria-hidden="true">{icon}</span>
              <span>{zh}</span>
              <small>/ {en}</small>
            </button>
          ))}
        </nav>

        <div className="mascot-zone">
          <p>Let&apos;s trace<br />every data!</p>
          <Image
            src="/mattrace-mascot.png"
            alt="MatTrace 科研机器人"
            width={1024}
            height={1536}
            priority
          />
        </div>

        <div className="skill-pill">
          <span /> Skill: material-evidence-extractor
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">MATERIALS INTELLIGENCE WORKSPACE</p>
            <h1>Hi, 研究者 <span aria-hidden="true">👋</span></h1>
            <p>让每一条材料数据都有出处、有条件、可复查。</p>
          </div>
          <button
            className="model-button"
            onClick={() => setSettingsOpen(true)}
            type="button"
            aria-label="打开模型配置"
            title={gateway}
          >
            <span className="status-dot" />
            <span><small>模型配置</small>{publicConfig.model}</span>
            <b>⌄</b>
          </button>
        </header>

        <div className="content-grid">
          <section className="main-column">
            <article className="card upload-card" aria-labelledby="upload-title">
              <div className="section-heading">
                <div>
                  <h2 id="upload-title">上传文献 <span>（3–10 篇）</span></h2>
                  <p>论文、专利或技术数据表将仅在当前浏览器会话中处理</p>
                </div>
                <button className="run-button" type="button" onClick={runDemo}>
                  <span>{isRunning ? "●" : "▶"}</span> {runLabel}
                </button>
              </div>

              <div className="upload-layout">
                <button
                  className="drop-zone"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="upload-art" aria-hidden="true">⇧</span>
                  <strong>拖拽文件到这里，或点击上传</strong>
                  <small>支持 PDF、DOCX、TXT（≤ 50MB）</small>
                </button>
                <input
                  ref={fileInputRef}
                  className="sr-only"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md"
                  onChange={handleFiles}
                />
                <div className="file-tray">
                  <p>已上传 {files.length}/10</p>
                  <div className="file-list">
                    {files.slice(0, 5).map((file, index) => (
                      <button
                        className="file-chip"
                        key={`${file.name}-${index}`}
                        title={file.name}
                        type="button"
                      >
                        <span className={`file-type ${file.type.toLowerCase()}`}>
                          {file.type}
                        </span>
                        <small>{file.name}</small>
                      </button>
                    ))}
                    {files.length < 10 && (
                      <button
                        className="add-file"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="添加更多文献"
                      >+
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>

            <article className="card progress-card" aria-labelledby="progress-title">
              <div className="section-heading compact">
                <div>
                  <h2 id="progress-title">Agent 工作进度</h2>
                  <p>Skill 将提取、核验和报告拆分成可检查步骤</p>
                </div>
                <span className="progress-count">{completedStages}/6 阶段</span>
              </div>
              <div className="stage-track">
                {demoState.stages.map((stage, index) => (
                  <div className={`stage ${stage.status}`} key={stage.label}>
                    <div className="stage-top">
                      <span className="stage-icon">{stageIcons[index]}</span>
                      {index < demoState.stages.length - 1 && <i />}
                    </div>
                    <strong>{stage.label}</strong>
                    <small>
                      {stage.status === "complete"
                        ? index === 0
                          ? "5/5 完成"
                          : index === 1
                            ? "87 条数据"
                            : "已完成"
                        : stage.status === "active"
                          ? "进行中…"
                          : "等待中"}
                    </small>
                  </div>
                ))}
              </div>
            </article>

            <article className="card data-card" aria-labelledby="overview-title">
              <div className="section-heading compact">
                <div>
                  <h2 id="overview-title">数据提取概览</h2>
                  <p>同一性能只有在测试条件兼容时才进入比较组</p>
                </div>
                <button className="text-button" type="button">查看全部数据 →</button>
              </div>

              <div className="summary-grid">
                {summaryCards.map((item) => (
                  <div className={`summary-card ${item.tone}`} key={item.label}>
                    <span><small>{item.label}</small><strong>{item.value}</strong></span>
                    <b aria-hidden="true">{item.icon}</b>
                  </div>
                ))}
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>材料体系</th><th>制备工艺</th><th>性能指标</th>
                      <th>数值（单位）</th><th>测试条件</th><th>来源</th><th>可信度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => (
                      <tr
                        className={selectedRecord === index ? "selected" : ""}
                        key={record.material}
                        onClick={() => setSelectedRecord(index)}
                      >
                        <td>{record.material}</td><td>{record.process}</td><td>{record.property}</td>
                        <td>{record.value}</td><td>{record.condition}</td><td>{record.source}</td>
                        <td><span className={`confidence ${record.confidence}`}>{record.confidence}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <footer className="workspace-footer">
              <span>♢ 已用时 02:48</span>
              <i />
              <span>由 material-evidence-extractor Skill 驱动</span>
            </footer>
          </section>

          <aside className="insight-column" aria-label="证据与风险摘要">
            <article className="card evidence-card">
              <div className="section-heading compact">
                <div><h2>证据链预览 <span>✦</span></h2></div>
                <button className="text-button" type="button">查看全部</button>
              </div>
              <div className="document-preview" aria-hidden="true">
                <div className="paper-lines">
                  <b>RESULTS &amp; DISCUSSION</b>
                  <span /><span /><span /><span /><span />
                  <em>Table 1. Conductivity measurements</em>
                  <span /><span /><span />
                </div>
                <strong>{activeEvidence.page}</strong>
              </div>
              <blockquote>“{activeEvidence.evidence}”</blockquote>
              <p className="citation">{activeEvidence.source}</p>
              <div className="evidence-tabs">
                {records.map((record, index) => (
                  <button
                    className={selectedRecord === index ? "active" : ""}
                    key={record.material}
                    onClick={() => setSelectedRecord(index)}
                    type="button"
                    aria-label={`查看 ${record.material} 的证据`}
                  >{index + 1}</button>
                ))}
              </div>
            </article>

            <article className="alert-card missing">
              <div><h3>缺失条件提醒 <span>3</span></h3><ul><li>测试温度未说明（2 条）</li><li>样品相对密度未说明（1 条）</li></ul></div>
              <b aria-hidden="true">⚗</b>
            </article>

            <article className="alert-card conflict">
              <div><h3>冲突检测提醒 <span>2</span></h3><p>同一材料体系在不同文献中性能差异超过 30%</p></div>
              <b aria-hidden="true">△</b>
            </article>

            <article className="card export-card">
              <div className="section-heading compact"><div><h2>导出报告</h2></div></div>
              <div className="export-actions">
                <button type="button" onClick={() => exportData("json")}><b>⌘</b><span>JSON</span></button>
                <button type="button" onClick={() => exportData("csv")}><b>▦</b><span>CSV</span></button>
                <button type="button" onClick={() => exportData("markdown")}><b>▤</b><span>Markdown</span></button>
              </div>
            </article>
          </aside>
        </div>
      </section>

      {settingsOpen && (
        <div className="modal-backdrop">
          <button
            className="modal-dismiss"
            type="button"
            aria-label="关闭模型配置"
            onClick={() => setSettingsOpen(false)}
          />
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <button className="modal-close" onClick={() => setSettingsOpen(false)} type="button" aria-label="关闭模型配置">×</button>
            <p className="eyebrow">BRING YOUR OWN KEY</p>
            <h2 id="settings-title">模型配置</h2>
            <p>浏览器将直接请求你指定的 OpenAI-compatible 接口，MatTrace 不保存密钥。</p>
            <label>API 网关<input value={gateway} onChange={(event) => setGateway(event.target.value)} /></label>
            <label>模型名称<input value={model} onChange={(event) => setModel(event.target.value)} /></label>
            <label>API Key<input type="password" autoComplete="off" value={apiKey} placeholder="sk-••••••••" onChange={(event) => { setApiKey(event.target.value); setConnection("idle"); setConnectionMessage("Key 仅保存在当前页面内存中"); }} /></label>
            <div className={`connection-note ${connection}`}><span />{connectionMessage}</div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => { setApiKey(""); setConnection("idle"); setConnectionMessage("Key 已从当前页面清除"); }}>清除 Key</button>
              <button className="primary-button" type="button" disabled={connection === "testing"} onClick={testConnection}>{connection === "testing" ? "连接中…" : "测试连接"}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
