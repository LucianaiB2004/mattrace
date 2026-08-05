import { useEffect, useRef } from "react";

type DrawerProps = {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function DetailsDrawer({ title, subtitle, open, onClose, children }: DrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="drawer-layer">
      <button className="drawer-backdrop" type="button" aria-label="点击遮罩关闭详情" onClick={onClose} />
      <aside className="details-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header>
          <div><p className="eyebrow">MATTRACE INSPECTOR</p><h2 id="drawer-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭详情">×</button>
        </header>
        <div className="drawer-content">{children}</div>
      </aside>
    </div>
  );
}
