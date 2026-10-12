import { useState, useEffect, useCallback } from "react";
import { Globe, Truck, Store } from "lucide-react";
import { api } from "../api.js";
import { fmt } from "../constants.js";
import { ErrorBanner } from "../components/Shared.jsx";

const STATUTS = ["EnAttente", "Confirmee", "Preparee", "Livree", "Annulee"];
const LABEL = {
  EnAttente: "En attente", Confirmee: "Confirmée", Preparee: "Préparée",
  Livree: "Livrée", Annulee: "Annulée",
};
const COULEUR_STATUT = {
  EnAttente: { bg: "#F1E9DC", fg: "#8C3B2E" },
  Confirmee: { bg: "#E3EEE6", fg: "#3F6B4A" },
  Preparee: { bg: "#E3EEE6", fg: "#3F6B4A" },
  Livree: { bg: "#DDEADD", fg: "#2F5A38" },
  Annulee: { bg: "#F7E2DE", fg: "#B04A3B" },
};

export default function CommandesEnLigneSection() {
  const [commandes, setCommandes] = useState([]);
  const [filtre, setFiltre] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enCours, setEnCours] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCommandes(await api.boutique.commandesAdmin(filtre || undefined)); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [filtre]);
  useEffect(() => { load(); }, [load]);

  const changerStatut = async (commande, statut) => {
    setEnCours(commande.id);
    try { await api.boutique.modifierStatutCommande(commande.id, statut); load(); }
    catch (e) { setError(e.message); } finally { setEnCours(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <p className="font-display text-2xl font-semibold flex items-center gap-2"><Globe size={20} color="#8C3B2E" /> Commandes en ligne</p>
          <p className="text-xs mt-0.5" style={{ color: "#6B5D52" }}>Commandes passées depuis le site e-commerce.</p>
        </div>
        <select value={filtre} onChange={(e) => setFiltre(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #DDD3C4", background: "#fff" }}>
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
        </select>
      </div>

      <ErrorBanner error={error} onClose={() => setError("")} />

      {loading ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement…</p>
      ) : (
        <div className="space-y-3">
          {commandes.map((c) => {
            const coul = COULEUR_STATUT[c.statut] || COULEUR_STATUT.EnAttente;
            return (
              <div key={c.id} className="rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {c.numero}
                      <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: coul.bg, color: coul.fg }}>{LABEL[c.statut]}</span>
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#6B5D52" }}>{new Date(c.createdAt).toLocaleString("fr-FR")}</p>
                    <p className="text-sm mt-2">{c.nomClient} · {c.telephoneClient}{c.emailClient ? ` · ${c.emailClient}` : ""}</p>
                    <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: "#6B5D52" }}>
                      {c.modeLivraison === "Livraison" ? <Truck size={13} /> : <Store size={13} />}
                      {c.modeLivraison === "Livraison" ? `Livraison — ${c.adresseLivraison}` : `Retrait — ${c.boutique}`}
                    </p>
                    {c.notes && <p className="text-xs mt-1 italic" style={{ color: "#6B5D52" }}>« {c.notes} »</p>}
                  </div>
                  <p className="font-display text-xl font-semibold">{fmt(c.total)} F</p>
                </div>

                <div className="mt-3 pt-3 space-y-1" style={{ borderTop: "1px solid #EFE7D9" }}>
                  {c.lignes.map((l) => (
                    <div key={l.id} className="flex items-center justify-between text-sm">
                      <span>{l.quantite} × {l.designation}{l.pointure ? ` (pointure ${l.pointure})` : ""}</span>
                      <span>{fmt(l.sousTotal)} F</span>
                    </div>
                  ))}
                </div>

                {c.statut !== "Livree" && c.statut !== "Annulee" && (
                  <div className="flex items-center gap-2 mt-4 pt-4 flex-wrap" style={{ borderTop: "1px solid #EFE7D9" }}>
                    {c.statut === "EnAttente" && (
                      <button disabled={enCours === c.id} onClick={() => changerStatut(c, "Confirmee")} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Confirmer (décrémente le stock)</button>
                    )}
                    {c.statut === "Confirmee" && (
                      <button disabled={enCours === c.id} onClick={() => changerStatut(c, "Preparee")} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Marquer préparée</button>
                    )}
                    {c.statut === "Preparee" && (
                      <button disabled={enCours === c.id} onClick={() => changerStatut(c, "Livree")} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Marquer livrée</button>
                    )}
                    <button disabled={enCours === c.id} onClick={() => changerStatut(c, "Annulee")} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: "#B04A3B" }}>Annuler</button>
                  </div>
                )}
              </div>
            );
          })}
          {commandes.length === 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>Aucune commande pour l'instant.</p>}
        </div>
      )}
    </div>
  );
}
