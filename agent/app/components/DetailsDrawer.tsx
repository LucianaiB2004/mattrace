import { useEffect, useRef, useState } from "react";

type DrawerProps = {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  editableTitle?: boolean;
  onRenameTitle?: (name: string) => void;
  children: React.ReactNode;
};

export default function DetailsDrawer({ title, subtitle, open, onClose, editableTitle = false, onRenameTitle, children }: DrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [titleError, setTitleError] = useState("");
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { if (editingTitle) titleInputRef.current?.focus(); }, [editingTitle]);
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
  function beginRename() { if (editableTitle) { setDraftTitle(title); setTitleError(""); setEditingTitle(true); } }
  function cancelRename() { setDraftTitle(title); setTitleError(""); setEditingTitle(false); }
  function commitRename() {
    if (!onRenameTitle) return cancelRename();
    try { onRenameTitle(draftTitle); setTitleError(""); setEditingTitle(false); }
    catch (error) { setTitleError(error instanceof Error ? error.message : "文档重命名失败"); }
  }
  if (!open) return null;
  return (
    <div className="drawer-layer">
      <button className="drawer-backdrop" type="button" aria-label="点击遮罩关闭详情" onClick={onClose} />
      <aside className="details-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header>
          <div><p className="eyebrow">MATTRACE INSPECTOR</p>{editingTitle ? <input ref={titleInputRef} id="drawer-title" className="drawer-title-editor" aria-label="文档名称" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} onBlur={commitRename} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitRename(); } if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancelRename(); } }} /> : <h2 id="drawer-title" className={editableTitle ? "editable" : ""} title={editableTitle ? "双击重命名文档" : undefined} onDoubleClick={beginRename}>{title}</h2>}{titleError && <p className="drawer-title-error" role="alert">{titleError}</p>}{subtitle && <p>{subtitle}</p>}</div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭详情">×</button>
        </header>
        <div className="drawer-content">{children}</div>
      </aside>
    </div>
  );
}
