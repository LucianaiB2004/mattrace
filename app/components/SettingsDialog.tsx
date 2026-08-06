import { useEffect, useRef, useState } from "react";
import { testProvider } from "../services/ai-client.mjs";
import { PROVIDER_PRESETS, providerPreset } from "../domain/provider-presets.mjs";

type Props = {
  open: boolean;
  gateway: string;
  model: string;
  apiKey: string;
  provider: string;
  protocol: string;
  onApply: (value: { provider: string; protocol: string; gateway: string; model: string; apiKey: string }) => void;
  onClose: () => void;
  onNotify: (message: string, tone?: "success" | "error" | "info") => void;
};

export default function SettingsDialog({ open, gateway, model, apiKey, provider, protocol, onApply, onClose, onNotify }: Props) {
  const [draft, setDraft] = useState({ gateway, model, apiKey, provider, protocol });
  const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      opener?.focus();
    };
  }, [open]);
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
        <p>支持 OpenAI Chat Completions 与 Responses API；应用配置后，API Key 会保存在当前浏览器。</p>
        <label>供应商预设<select value={draft.provider} onChange={(event) => { const next = providerPreset(event.target.value); if (!next) return; setDraft(next.provider === "custom" ? { ...draft, provider: "custom" } : { ...draft, ...next }); setStatus("idle"); }}>{PROVIDER_PRESETS.map((item) => <option value={item.provider} key={item.provider}>{item.label}</option>)}</select></label>
        <label>接口协议<select value={draft.protocol} onChange={(event) => { setDraft({ ...draft, provider: "custom", protocol: event.target.value }); setStatus("idle"); }}><option value="openai-chat">OpenAI Chat Completions</option><option value="openai-responses">OpenAI Responses API</option></select></label>
        <label>API 网关<input value={draft.gateway} onChange={(event) => setDraft({ ...draft, provider: "custom", gateway: event.target.value })} /></label>
        <label>模型名称<input value={draft.model} onChange={(event) => setDraft({ ...draft, provider: "custom", model: event.target.value })} /></label>
        <label>API Key<input type="password" autoComplete="off" value={draft.apiKey} placeholder="输入一次，应用后由当前浏览器记住" onChange={(event) => { setDraft({ ...draft, apiKey: event.target.value }); setStatus("idle"); }} /></label>
        <div className={`connection-note ${status}`}><span />{status === "testing" ? "正在连接模型服务…" : status === "success" ? "连接成功" : status === "error" ? "连接失败，请查看提示" : draft.apiKey ? "Key 已保存在当前浏览器" : "尚未保存 API Key"}</div>
        <div className="privacy-box"><strong>本地存储说明</strong><p>Key 保存在当前浏览器的 localStorage（未加密），不会进入项目快照、Skill、导出报告或 GitHub。请勿在不可信设备上启用。</p></div>
        <div className="modal-actions three">
          <button className="secondary-button" type="button" onClick={() => { const next = { ...draft, apiKey: "" }; setDraft(next); onApply(next); onNotify("API Key 已从当前浏览器清除", "success"); }}>清除 Key</button>
          <button className="secondary-button" type="button" disabled={status === "testing"} onClick={checkConnection}>{status === "testing" ? "连接中…" : "测试连接"}</button>
          <button className="primary-button" type="button" onClick={() => { onApply(draft); onClose(); onNotify("配置已保存到当前浏览器", "success"); }}>应用配置</button>
        </div>
      </section>
    </div>
  );
}
