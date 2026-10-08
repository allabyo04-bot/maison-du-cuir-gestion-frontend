export const inputStyle = { width: "100%", marginTop: "4px", padding: "8px 10px", borderRadius: "8px", border: "1px solid #DDD3C4", background: "#FFFFFF", fontSize: "14px", outline: "none" };
export const selectStyle = { padding: "8px 10px", borderRadius: "8px", border: "1px solid #DDD3C4", background: "#FFFFFF", fontSize: "13px", outline: "none" };

export function Field({ label, children }) {
  return (
    <div className="mt-3">
      <label className="text-xs font-mono uppercase tracking-wide" style={{ color: "#8C3B2E" }}>{label}</label>
      {children}
    </div>
  );
}

export function ConfirmModal({ title, message, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-20" style={{ background: "rgba(43,35,32,0.4)" }}>
      <div className="rounded-xl p-6 max-w-sm w-full" style={{ background: "#FFFFFF" }}>
        <p className="font-display text-lg font-semibold mb-2">{title}</p>
        <p className="text-sm mb-5" style={{ color: "#6B5D52" }}>{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm" style={{ color: "#6B5D52" }}>Annuler</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#B04A3B", color: "#FBF3EC" }}>Supprimer</button>
        </div>
      </div>
    </div>
  );
}

export function ErrorBanner({ error, onClose }) {
  if (!error) return null;
  return (
    <div className="mb-6 px-4 py-3 rounded-lg text-sm flex items-center justify-between" style={{ background: "#FBEAE7", border: "1px solid #E3B6AD", color: "#8C3B2E" }}>
      <span>{error}</span>
      <button onClick={onClose} aria-label="Fermer">✕</button>
    </div>
  );
}
