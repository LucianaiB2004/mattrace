import { useEffect, useRef, useState } from "react";
import { testProvider } from "../services/ai-client.mjs";

type Props = {
  open: boolean;
  gateway: string;
  model: string;
  apiKey: string;
  onApply: (value: { gateway: string; model: string; apiKey: string }) => void;
  onClose: () => void;
  onNotify: (message: string, tone?: "success" | "error" | "info") => void;
};

export default function SettingsDialog({ open, gateway, model, apiKey, onApply, onClose, onNotify }: Props) {
  const [draft, setDraft] = useState({ gateway, model, apiKey });
  const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);
  if (!open) return null;

  async function checkConnection() {
    setStatus("testing");
    try {
      await testProvider(draft);
      setStatus("success");
      onNotify("模型服务连接成功，Key 未被保存", "success");
    } catch (error) {
      setStatus("error");
      onNotify(error instanceof Error ? error.message : "连接失败", "error");
    }
  }

  return (
    <div className="modal-backdrop">
      <button className="modal-dismiss" type="button" aria-label="关闭模型配置" onClick={onClose} />
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <button ref={closeRef} className="modal-close" onClick={onClose} type="button" aria-label="关闭模型配置">×</button>
        <p className="eyebrow">BRING YOUR OWN KEY</p>
        <h2 id="settings-title">模型配置</h2>
        <p>浏览器直接请求 OpenAI-compatible 接口；API Key 只保留在当前页面内存中。</p>
        <label>API 网关<input value={draft.gateway} onChange={(event) => setDraft({ ...draft, gateway: event.target.value })} /></label>
        <label>模型名称<input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} /></label>
        <label>API Key<input type="password" autoComplete="off" value={draft.apiKey} placeholder="运行时输入，不会保存" onChange={(event) => { setDraft({ ...draft, apiKey: event.target.value }); setStatus("idle"); }} /></label>
        <div className={`connection-note ${status}`}><span />{status === "testing" ? "正在连接模型服务…" : status === "success" ? "连接成功" : status === "error" ? "连接失败，请查看提示" : "Key 仅保存在当前页面内存中"}</div>
        <div className="privacy-box"><strong>隐私与数据流</strong><p>真实分析仅发送解析后的文本、文档名和页码；原始文件、项目快照和 API Key 不会发送或上传。</p></div>
        <div className="modal-actions three">
          <button className="secondary-button" type="button" onClick={() => { const next = { ...draft, apiKey: "" }; setDraft(next); onApply(next); onNotify("API Key 已从内存清除", "success"); }}>清除 Key</button>
          <button className="secondary-button" type="button" disabled={status === "testing"} onClick={checkConnection}>{status === "testing" ? "连接中…" : "测试连接"}</button>
          <button className="primary-button" type="button" onClick={() => { onApply(draft); onClose(); onNotify("当前会话配置已应用", "success"); }}>应用配置</button>
        </div>
      </section>
    </div>
  );
}
