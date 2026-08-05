export type Toast = { id: number; message: string; tone?: "success" | "error" | "info" };

export default function ToastRegion({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div className={`toast ${toast.tone ?? "info"}`} key={toast.id}>
          <span aria-hidden="true">{toast.tone === "success" ? "✓" : toast.tone === "error" ? "!" : "i"}</span>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
