import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Store, X, KeyRound, UserCircle2 } from "lucide-react";
import { api } from "../api.js";
import { BOUTIQUES } from "../constants.js";
import { Field, ConfirmModal, ErrorBanner, inputStyle } from "../components/Shared.jsx";

const ROLE_COLORS = {
  Administrateur: { bg: "#8C3B2E", fg: "#FBF3EC" },
  Gérant: { bg: "#A8823D", fg: "#2B2320" },
  Vendeur: { bg: "#3F6B4A", fg: "#F3F7F3" },
};
function roleColor(nom) { return ROLE_COLORS[nom] || { bg: "#6B5D52", fg: "#FBF3EC" }; }
function initials(prenom, nom) { return `${(prenom || "?")[0] || ""}${(nom || "?")[0] || ""}`.toUpperCase(); }

export default function UtilisateursSection() {
  const [users, setUsers] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalUser, setModalUser] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([api.users.list(), api.roles.list()]);
      setUsers(u);
      setRoles(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNewUser = () => setModalUser({ isNew: true, nom: "", prenom: "", login: "", pin: "", roleId: roles?.[0]?.id || "", boutique: BOUTIQUES[0], actif: true, telephone: "", questionSecrete: "", reponseSecrete: "" });
  const openEditUser = (u) => setModalUser({ ...u, pin: "", reponseSecrete: "", isNew: false });

  const submitUser = async (form) => {
    if (!form.nom.trim() || !form.prenom.trim() || !form.login.trim() || (form.isNew && !/^\d{4,6}$/.test(form.pin))) {
      setError("Nom, prénom, identifiant et un code PIN (4 à 6 chiffres) sont obligatoires.");
      return;
    }
    try {
      if (form.isNew) {
        await api.users.create(form);
      } else {
        const payload = { ...form };
        if (!payload.pin) delete payload.pin;
        if (!payload.reponseSecrete) delete payload.reponseSecrete;
        await api.users.update(form.id, payload);
      }
      setModalUser(null);
      setError("");
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleActive = async (u) => {
    const codeConfirmation = window.prompt("Code de confirmation (action sensible) :");
    if (codeConfirmation === null) return;
    try { await api.users.update(u.id, { actif: !u.actif, codeConfirmation }); load(); } catch (e) { setError(e.message); }
  };

  const removeUser = async (u) => {
    const codeConfirmation = window.prompt("Code de confirmation (action sensible) :");
    if (codeConfirmation === null) return;
    try { await api.users.remove(u.id, codeConfirmation); setConfirmDelete(null); load(); } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <ErrorBanner error={error} onClose={() => setError("")} />
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm" style={{ color: "#6B5D52" }}>{users?.length || 0} employé(s) enregistré(s)</p>
        <button onClick={openNewUser} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>
          <Plus size={16} /> Nouvel employé
        </button>
      </div>

      {loading && <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement…</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        {users?.map((u) => {
          const role = roles.find((r) => r.id === u.roleId);
          const rc = roleColor(role?.nom);
          return (
            <div key={u.id} className="stitch card-hover rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center font-display font-semibold text-sm shrink-0" style={{ background: "#F1E9DC", color: "#8C3B2E" }}>
                    {initials(u.prenom, u.nom)}
                  </div>
                  <div>
                    <p className="font-medium leading-tight">{u.prenom} {u.nom}</p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: "#6B5D52" }}>@{u.login}</p>
                  </div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full mt-1" style={{ background: u.actif ? "#3F6B4A" : "#B8ADA0" }} />
              </div>
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: rc.bg, color: rc.fg }}>{role?.nom || "—"}</span>
                <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: "#F1E9DC", color: "#6B5D52" }}><Store size={11} /> {u.boutique}</span>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: "1px solid #EFE7D9" }}>
                <button onClick={() => toggleActive(u)} className="text-xs font-medium" style={{ color: "#6B5D52" }}>{u.actif ? "Désactiver" : "Réactiver"}</button>
                <div className="flex gap-3">
                  <button onClick={() => openEditUser(u)} style={{ color: "#8C3B2E" }}><Pencil size={16} /></button>
                  <button onClick={() => setConfirmDelete(u)} style={{ color: "#B04A3B" }}><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modalUser && <UserModal user={modalUser} roles={roles} onCancel={() => setModalUser(null)} onSubmit={submitUser} />}
      {confirmDelete && (
        <ConfirmModal title="Supprimer cet employé ?" message={`${confirmDelete.prenom} ${confirmDelete.nom} sera retiré définitivement.`} onCancel={() => setConfirmDelete(null)} onConfirm={() => removeUser(confirmDelete)} />
      )}
    </div>
  );
}

function UserModal({ user, roles, onCancel, onSubmit }) {
  const [form, setForm] = useState(user);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
      <div className="rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: "#FFFDF9" }}>
        <div className="flex items-center justify-between mb-5">
          <p className="font-display text-lg font-semibold">{form.isNew ? "Nouvel employé" : "Modifier l'employé"}</p>
          <button onClick={onCancel}><X size={18} color="#6B5D52" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom"><input value={form.prenom} onChange={(e) => set("prenom", e.target.value)} style={inputStyle} /></Field>
          <Field label="Nom"><input value={form.nom} onChange={(e) => set("nom", e.target.value)} style={inputStyle} /></Field>
        </div>
        <Field label="Identifiant de connexion">
          <div className="flex items-center gap-2 mt-1">
            <UserCircle2 size={16} color="#6B5D52" />
            <input value={form.login} onChange={(e) => set("login", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          </div>
        </Field>
        <Field label={form.isNew ? "Code PIN (4 à 6 chiffres)" : "Nouveau PIN (laisser vide pour ne pas changer)"}>
          <div className="flex items-center gap-2 mt-1">
            <KeyRound size={16} color="#6B5D52" />
            <input value={form.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, ""))} style={{ ...inputStyle, flex: 1 }} maxLength={6} inputMode="numeric" placeholder="••••" />
          </div>
        </Field>
        <Field label="Téléphone (pour réinitialiser son PIN)"><input value={form.telephone || ""} onChange={(e) => set("telephone", e.target.value)} style={inputStyle} /></Field>
        <Field label="Question secrète"><input value={form.questionSecrete || ""} onChange={(e) => set("questionSecrete", e.target.value)} style={inputStyle} placeholder="Ex : Nom de ma ville natale ?" /></Field>
        <Field label={form.isNew ? "Réponse secrète" : "Nouvelle réponse (laisser vide pour ne pas changer)"}><input value={form.reponseSecrete || ""} onChange={(e) => set("reponseSecrete", e.target.value)} style={inputStyle} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rôle"><select value={form.roleId} onChange={(e) => set("roleId", e.target.value)} style={inputStyle}>{roles.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}</select></Field>
          <Field label="Boutique"><select value={form.boutique} onChange={(e) => set("boutique", e.target.value)} style={inputStyle}>{BOUTIQUES.map((b) => <option key={b} value={b}>{b}</option>)}</select></Field>
        </div>
        <label className="flex items-center gap-2 mt-4 text-sm" style={{ color: "#6B5D52" }}>
          <input type="checkbox" checked={form.actif} onChange={(e) => set("actif", e.target.checked)} /> Compte actif
        </label>
        <Field label="Code de confirmation (action sensible)">
          <input type="password" value={form.codeConfirmation || ""} onChange={(e) => set("codeConfirmation", e.target.value)} style={inputStyle} placeholder="Connu uniquement de Djenie et Phil" />
        </Field>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm" style={{ color: "#6B5D52" }}>Annuler</button>
          <button onClick={() => onSubmit(form)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}