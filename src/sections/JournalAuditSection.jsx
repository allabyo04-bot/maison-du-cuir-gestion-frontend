import { useState, useEffect, useCallback } from "react";
import { ScrollText, Users as UsersIcon, Percent } from "lucide-react";
import { api } from "../api.js";
import { fmt } from "../constants.js";
import { ErrorBanner } from "../components/Shared.jsx";

const ACTION_LABELS = {
  PRIX_MODIFIE: "Prix modifié",
  SUPPRESSION: "Suppression",
  CONNEXION: "Connexion",
  PIN_MODIFIE: "PIN modifié",
  ROLE_MODIFIE: "Rôle modifié",
};
const ACTION_COLORS = {
  PRIX_MODIFIE: { fg: "#A8823D", bg: "#FBF3E3" },
  SUPPRESSION: { fg: "#B04A3B", bg: "#FBEAE7" },
  CONNEXION: { fg: "#3F6B4A", bg: "#E9F0EA" },
  PIN_MODIFIE: { fg: "#6B5D52", bg: "#F1E9DC" },
  ROLE_MODIFIE: { fg: "#8C3B2E", bg: "#FBF3EC" },
};

function Onglets({ vue, setVue }) {
  const items = [
    ["JOURNAL", "Journal général", ScrollText],
    ["CLIENTS", "Fiches clients", UsersIcon],
    ["REMISES", "Remises par caissière", Percent],
  ];
  return (
    <div className="flex gap-2 mb-5 flex-wrap">
      {items.map(([id, label, Icon]) => (
        <button key={id} type="button" onClick={() => setVue(id)}
          className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1.5"
          style={vue === id ? { background: "#2B2320", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52", border: "1px solid #DDD3C4" }}>
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  );
}

function FiltrePeriode({ dateDebut, setDateDebut, dateFin, setDateFin }) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div>
        <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Du</label>
        <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid #DDD3C4" }} />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Au</label>
        <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid #DDD3C4" }} />
      </div>
    </div>
  );
}

function JournalGeneral() {
  const [entrees, setEntrees] = useState(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  const load = useCallback(async () => {
    try { setEntrees(await api.journalAudit.list({ action, dateDebut, dateFin })); }
    catch (e) { setError(e.message); }
  }, [action, dateDebut, dateFin]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <FiltrePeriode dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin} />
        <select value={action} onChange={(e) => setAction(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #DDD3C4" }}>
          <option value="">Toutes les actions</option>
          {Object.entries(ACTION_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      {error && <ErrorBanner error={error} />}
      {entrees === null ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement...</p>
      ) : entrees.length === 0 ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Rien à signaler pour cette période.</p>
      ) : (
        <div className="space-y-1.5">
          {entrees.map((e) => {
            const couleur = ACTION_COLORS[e.action] || { fg: "#6B5D52", bg: "#F1E9DC" };
            return (
              <div key={e.id} className="rounded-xl p-3 flex items-start justify-between gap-3 text-sm" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
                <div className="min-w-0">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: couleur.bg, color: couleur.fg }}>
                    {ACTION_LABELS[e.action] || e.action}
                  </span>
                  <span className="ml-2">{e.cible}</span>
                  {e.detail && <span className="ml-1.5" style={{ color: "#6B5D52" }}>— {e.detail}</span>}
                  <div className="text-xs mt-1" style={{ color: "#6B5D52" }}>
                    Par {e.utilisateur?.prenom} {e.utilisateur?.nom}{e.boutique ? ` · ${e.boutique}` : ""}
                  </div>
                </div>
                <span className="text-xs shrink-0 whitespace-nowrap" style={{ color: "#6B5D52" }}>
                  {new Date(e.createdAt).toLocaleString("fr-FR")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FichesClients() {
  const [clients, setClients] = useState(null);
  const [error, setError] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [sansTelephoneUniquement, setSansTelephoneUniquement] = useState(false);

  const load = useCallback(async () => {
    try { setClients(await api.journalAudit.fichesClients({ dateDebut, dateFin })); }
    catch (e) { setError(e.message); }
  }, [dateDebut, dateFin]);
  useEffect(() => { load(); }, [load]);

  const affiches = clients ? clients.filter((c) => !sansTelephoneUniquement || !c.telephone) : [];
  const nbSansTelephone = clients ? clients.filter((c) => !c.telephone).length : 0;

  return (
    <div>
      <FiltrePeriode dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin} />
      {(dateDebut || dateFin) && (
        <p className="text-xs mb-3" style={{ color: "#A8823D" }}>
          Les anciennes fiches (créées avant ce suivi, date de création inconnue) sont exclues d'un filtre par période — retire le filtre pour les revoir.
        </p>
      )}
      {error && <ErrorBanner error={error} />}
      {clients === null ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement...</p>
      ) : (
        <>
          {nbSansTelephone > 0 && (
            <label className="flex items-center gap-2 text-sm mb-3" style={{ color: "#B04A3B" }}>
              <input type="checkbox" checked={sansTelephoneUniquement} onChange={(e) => setSansTelephoneUniquement(e.target.checked)} />
              N'afficher que les {nbSansTelephone} fiche(s) sans numéro de téléphone (forcément anciennes — le champ est obligatoire depuis)
            </label>
          )}
          {affiches.length === 0 ? (
            <p className="text-sm" style={{ color: "#6B5D52" }}>Aucune fiche pour cette période.</p>
          ) : (
            <div className="space-y-1.5">
              {affiches.map((c) => (
                <div key={c.id} className="rounded-xl p-3 flex items-center justify-between gap-3 text-sm" style={{ background: "#FFFFFF", border: c.telephone ? "1px solid #EAE1D2" : "1px solid #B04A3B" }}>
                  <div>
                    <span className="font-medium">{c.nomPrenoms}</span>
                    <span className="ml-1.5 font-mono text-xs" style={{ color: "#6B5D52" }}>{c.code}</span>
                    {!c.telephone && <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: "#FBEAE7", color: "#B04A3B" }}>Sans téléphone</span>}
                    <div className="text-xs mt-1" style={{ color: "#6B5D52" }}>
                      Créée par {c.creePar ? `${c.creePar.prenom} ${c.creePar.nom}` : "inconnu (ancienne fiche, avant ce suivi)"}
                    </div>
                  </div>
                  <span className="text-xs shrink-0 whitespace-nowrap text-right" style={{ color: c.creePar ? "#6B5D52" : "#A8823D" }}>
                    {c.creePar ? new Date(c.createdAt).toLocaleDateString("fr-FR") : "Date inconnue"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RemisesParCaissiere() {
  const [lignes, setLignes] = useState(null);
  const [error, setError] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  const load = useCallback(async () => {
    try { setLignes(await api.journalAudit.remisesParCaissiere({ dateDebut, dateFin })); }
    catch (e) { setError(e.message); }
  }, [dateDebut, dateFin]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <FiltrePeriode dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin} />
      {error && <ErrorBanner error={error} />}
      {lignes === null ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement...</p>
      ) : lignes.length === 0 ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Aucune demande de remise sur cette période.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 600 }}>
            <thead>
              <tr style={{ color: "#6B5D52", borderBottom: "1px solid #EAE1D2" }}>
                <th className="text-left py-2">Caissier(ère)</th>
                <th className="text-right py-2">Demandes</th>
                <th className="text-right py-2">Montant total</th>
                <th className="text-right py-2">Approuvées</th>
                <th className="text-right py-2">Refusées</th>
                <th className="text-right py-2">En attente</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={i} style={{ borderTop: "1px solid #EFE7D9" }}>
                  <td className="py-2">{l.caissier.prenom} {l.caissier.nom}</td>
                  <td className="text-right py-2">{l.nombre}</td>
                  <td className="text-right py-2 font-mono">{fmt(l.montantTotal)} F</td>
                  <td className="text-right py-2" style={{ color: "#3F6B4A" }}>{l.approuvees}</td>
                  <td className="text-right py-2" style={{ color: "#B04A3B" }}>{l.refusees}</td>
                  <td className="text-right py-2" style={{ color: "#A8823D" }}>{l.enAttente}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function JournalAuditSection() {
  const [vue, setVue] = useState("JOURNAL");

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-1">Journal d'audit</h1>
      <p className="text-sm mb-5" style={{ color: "#6B5D52" }}>
        Réservé à l'administrateur — pour repérer des tendances (pas pour un usage quotidien des caissières).
      </p>
      <Onglets vue={vue} setVue={setVue} />
      {vue === "JOURNAL" && <JournalGeneral />}
      {vue === "CLIENTS" && <FichesClients />}
      {vue === "REMISES" && <RemisesParCaissiere />}
    </div>
  );
}
