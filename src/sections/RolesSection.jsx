import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { api } from "../api.js";
import { ErrorBanner } from "../components/Shared.jsx";

const PERM_LABELS = [
  ["ventes", "Ventes"], ["livraison", "Livraison"], ["stock", "Stock"], ["clients", "Clients / CRM"],
  ["rapports", "Rapports"], ["utilisateurs", "Utilisateurs"], ["configuration", "Configuration"],
];
const ROLE_COLORS = {
  Administrateur: { bg: "#8C3B2E", fg: "#FBF3EC" },
  Gérant: { bg: "#A8823D", fg: "#2B2320" },
  Vendeur: { bg: "#3F6B4A", fg: "#F3F7F3" },
};
function roleColor(nom) { return ROLE_COLORS[nom] || { bg: "#6B5D52", fg: "#FBF3EC" }; }

export default function RolesSection() {
  const [roles, setRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [error, setError] = useState("");
  const [clesApi, setClesApi] = useState([]);
  const [nouvelleCleNom, setNouvelleCleNom] = useState("");
  const [cleGeneree, setCleGeneree] = useState(null);

  const load = useCallback(async () => {
    try { setRoles(await api.roles.list()); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadClesApi = useCallback(async () => {
    try { setClesApi(await api.apiPublique.listerCles()); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { loadClesApi(); }, [loadClesApi]);

  const togglePermission = async (role, key) => {
    const codeConfirmation = window.prompt("Code de confirmation (action sensible) :");
    if (codeConfirmation === null) return;
    try {
      await api.roles.update(role.id, { permissions: { ...role.permissions, [key]: !role.permissions[key] }, codeConfirmation });
      load();
    } catch (e) { setError(e.message); }
  };

  const addRole = async () => {
    const nom = newRoleName.trim();
    if (!nom) return;
    const codeConfirmation = window.prompt("Code de confirmation (action sensible) :");
    if (codeConfirmation === null) return;
    try {
      await api.roles.create({ nom, permissions: { ventes: false, livraison: false, stock: false, clients: false, rapports: false, utilisateurs: false, configuration: false }, codeConfirmation });
      setNewRoleName("");
      load();
    } catch (e) { setError(e.message); }
  };

  const deleteRole = async (role) => {
    const codeConfirmation = window.prompt("Code de confirmation (action sensible) :");
    if (codeConfirmation === null) return;
    try { await api.roles.remove(role.id, codeConfirmation); load(); } catch (e) { setError(e.message); }
  };

  const creerCleApi = async () => {
    const nom = nouvelleCleNom.trim();
    if (!nom) { setError("Indique un nom pour cet accès (ex : nom de l'agence)."); return; }
    const codeConfirmation = window.prompt("Code de confirmation (action sensible — donner un accès externe) :");
    if (codeConfirmation === null) return;
    try {
      const res = await api.apiPublique.creerCle(nom, codeConfirmation);
      setCleGeneree(res);
      setNouvelleCleNom("");
      loadClesApi();
    } catch (e) { setError(e.message); }
  };
  const toggleCleApi = async (cle) => {
    try { await api.apiPublique.toggleCle(cle.id, !cle.actif); loadClesApi(); } catch (e) { setError(e.message); }
  };

  const changerCode = async () => {
    const codeActuel = window.prompt("Code de confirmation actuel :");
    if (codeActuel === null) return;
    const nouveauCode = window.prompt("Nouveau code (6 caractères minimum) :");
    if (nouveauCode === null) return;
    try {
      await api.securite.changerCode(codeActuel, nouveauCode);
      window.alert("Code de confirmation changé avec succès.");
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <ErrorBanner error={error} onClose={() => setError("")} />
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: "#6B5D52" }}>Le code de confirmation est exigé en plus du PIN pour créer/modifier/supprimer un employé ou un rôle — connu uniquement de Djenie et Phil.</p>
        <button onClick={changerCode} className="text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap" style={{ border: "1px solid #DDD3C4", color: "#6B5D52" }}>Changer le code</button>
      </div>
      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #EAE1D2" }}>
        <table className="w-full text-sm" style={{ background: "#FFFFFF" }}>
          <thead>
            <tr style={{ background: "#F1E9DC" }}>
              <th className="text-left px-4 py-3 font-medium">Rôle</th>
              {PERM_LABELS.map(([key, label]) => <th key={key} className="px-3 py-3 font-medium text-center font-mono text-xs" style={{ color: "#6B5D52" }}>{label}</th>)}
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => {
              const rc = roleColor(r.nom);
              return (
                <tr key={r.id} style={{ borderTop: "1px solid #EFE7D9" }}>
                  <td className="px-4 py-3"><span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: rc.bg, color: rc.fg }}>{r.nom}</span></td>
                  {PERM_LABELS.map(([key]) => (
                    <td key={key} className="px-3 py-3 text-center">
                      <button disabled={r.systeme} onClick={() => togglePermission(r, key)} className="w-6 h-6 rounded flex items-center justify-center mx-auto" style={{ background: r.permissions[key] ? "#3F6B4A" : "#F1E9DC", opacity: r.systeme ? 0.6 : 1 }}>
                        {r.permissions[key] && <Check size={14} color="#F3F7F3" />}
                      </button>
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right">{!r.systeme && <button onClick={() => deleteRole(r)} style={{ color: "#B04A3B" }}><Trash2 size={15} /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-5">
        <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Nom du nouveau rôle" className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #DDD3C4", background: "#FFFFFF" }} />
        <button onClick={addRole} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}><Plus size={16} /> Ajouter</button>
      </div>
      <p className="text-xs mt-3" style={{ color: "#6B5D52" }}>Le rôle Administrateur garde toujours accès complet et ne peut pas être modifié.</p>

      <div className="rounded-xl p-5 mt-8" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
        <p className="font-display font-semibold mb-1">Accès externes en lecture seule (ex : site e-commerce)</p>
        <p className="text-xs mb-4" style={{ color: "#6B5D52" }}>
          Ces clés donnent uniquement accès au catalogue et au stock, en lecture seule — jamais aux ventes, clients, ou comptes utilisateurs. Ne jamais transmettre un compte de l'application ni les identifiants de la base à un prestataire externe : utilise ce système à la place.
        </p>

        {cleGeneree && (
          <div className="rounded-lg p-4 mb-4" style={{ background: "#E9F0EA", border: "1px solid #C9DECD" }}>
            <p className="text-sm font-medium mb-1">Clé créée pour "{cleGeneree.nom}" — copie-la maintenant, elle ne sera plus jamais affichée :</p>
            <p className="font-mono text-sm break-all p-2 rounded" style={{ background: "#FFFFFF" }}>{cleGeneree.cle}</p>
            <p className="text-xs mt-2" style={{ color: "#6B5D52" }}>Donne-leur cette clé (à mettre dans l'en-tête <code>x-api-key</code>) et l'URL <code>/api/api-publique/catalogue</code> — rien d'autre.</p>
            <button onClick={() => setCleGeneree(null)} className="text-xs mt-2 underline" style={{ color: "#6B5D52" }}>J'ai copié la clé, fermer</button>
          </div>
        )}

        <div className="space-y-2 mb-4">
          {clesApi.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "#F1E9DC" }}>
              <div>
                <p className="text-sm font-medium">{c.nom}</p>
                <p className="text-xs" style={{ color: "#6B5D52" }}>{c.actif ? "Active" : "Désactivée"}{c.derniereUtilisation ? ` · dernière utilisation ${new Date(c.derniereUtilisation).toLocaleDateString("fr-FR")}` : " · jamais utilisée"}</p>
              </div>
              <button onClick={() => toggleCleApi(c)} className="text-xs px-3 py-1 rounded-full font-medium" style={c.actif ? { background: "#B04A3B", color: "#FBF3EC" } : { background: "#3F6B4A", color: "#F3F7F3" }}>
                {c.actif ? "Désactiver" : "Réactiver"}
              </button>
            </div>
          ))}
          {clesApi.length === 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>Aucun accès externe créé pour l'instant.</p>}
        </div>

        <div className="flex gap-2">
          <input value={nouvelleCleNom} onChange={(e) => setNouvelleCleNom(e.target.value)} placeholder="Nom de l'accès, ex : Agence site e-commerce" className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #DDD3C4", background: "#FFFFFF" }} />
          <button onClick={creerCleApi} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap" style={{ background: "#8C3B2E", color: "#FBF3EC" }}><Plus size={16} /> Créer un accès</button>
        </div>
      </div>
    </div>
  );
}
