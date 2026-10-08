import { useState, useEffect, useCallback } from "react";
import { Gift, Crown, Plus, Trash2, Pencil, Users, Bell, Wallet, List } from "lucide-react";
import { api } from "../api.js";
import { fmt } from "../constants.js";
import { ErrorBanner } from "../components/Shared.jsx";

const inputStyle = { border: "1px solid #DDD3C4", borderRadius: 8, padding: "8px 10px", fontSize: 14 };

function Onglets({ vue, setVue }) {
  const items = [["BONUS", "Paliers de bonus", Gift], ["STATUT", "Paliers de statut", Crown], ["CLIENTES", "Clientes avec bonus disponible", Users], ["CHANGEMENTS", "Changements de statut", Bell], ["ACCORDES", "Bonus accordés", Wallet], ["PARSTATUT", "Clientes par statut", List]];
  return (
    <div className="flex gap-2 mb-5">
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

function PaliersBonus() {
  const [paliers, setPaliers] = useState(null);
  const [error, setError] = useState("");
  const [edition, setEdition] = useState(null); // { id?, seuilBas, seuilHaut, montantBonus }

  const load = useCallback(async () => {
    try { setPaliers(await api.fidelite.paliersBonus()); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const enregistrer = async () => {
    try {
      const data = { seuilBas: Number(edition.seuilBas), seuilHaut: edition.seuilHaut === "" ? null : Number(edition.seuilHaut), montantBonus: Number(edition.montantBonus) };
      if (edition.id) await api.fidelite.majPalierBonus(edition.id, data);
      else await api.fidelite.creerPalierBonus(data);
      setEdition(null);
      load();
    } catch (e) { setError(e.message); }
  };
  const supprimer = async (id) => {
    try { await api.fidelite.supprimerPalierBonus(id); load(); } catch (e) { setError(e.message); }
  };
  const toggleActif = async (p) => {
    try { await api.fidelite.majPalierBonus(p.id, { actif: !p.actif }); load(); } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "#6B5D52" }}>
        Basé sur le cumul <strong>courant</strong> d'une cliente (celui qui repart à zéro dès qu'un bonus est utilisé). Un seuil haut vide veut dire "et au-delà".
      </p>
      {error && <ErrorBanner error={error} />}
      {paliers === null ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement...</p>
      ) : (
        <div className="space-y-2 mb-4">
          {paliers.map((p) => (
            <div key={p.id} className="rounded-xl p-3 flex items-center justify-between gap-3 text-sm" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2", opacity: p.actif ? 1 : 0.5 }}>
              <div>
                De {fmt(p.seuilBas)} F {p.seuilHaut != null ? `à ${fmt(p.seuilHaut)} F` : "et au-delà"}
                <span className="ml-2 font-semibold" style={{ color: "#8C3B2E" }}>→ {fmt(p.montantBonus)} F</span>
                {!p.actif && <span className="ml-2 text-xs" style={{ color: "#6B5D52" }}>(désactivé)</span>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => toggleActif(p)} className="text-xs px-2 py-1 rounded" style={{ border: "1px solid #DDD3C4" }}>{p.actif ? "Désactiver" : "Activer"}</button>
                <button onClick={() => setEdition({ id: p.id, seuilBas: p.seuilBas, seuilHaut: p.seuilHaut ?? "", montantBonus: p.montantBonus })} className="p-1.5 rounded" style={{ border: "1px solid #DDD3C4" }}><Pencil size={14} /></button>
                <button onClick={() => supprimer(p.id)} className="p-1.5 rounded" style={{ border: "1px solid #DDD3C4", color: "#B04A3B" }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {edition ? (
        <div className="rounded-xl p-4 flex flex-wrap items-end gap-3" style={{ background: "#FFFDF9", border: "1px solid #EAE1D2" }}>
          <div><label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Seuil bas (F)</label><input type="number" value={edition.seuilBas} onChange={(e) => setEdition({ ...edition, seuilBas: e.target.value })} style={inputStyle} className="w-32" /></div>
          <div><label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Seuil haut (F, vide = illimité)</label><input type="number" value={edition.seuilHaut} onChange={(e) => setEdition({ ...edition, seuilHaut: e.target.value })} style={inputStyle} className="w-40" /></div>
          <div><label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Montant du bonus (F)</label><input type="number" value={edition.montantBonus} onChange={(e) => setEdition({ ...edition, montantBonus: e.target.value })} style={inputStyle} className="w-32" /></div>
          <button onClick={enregistrer} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Enregistrer</button>
          <button onClick={() => setEdition(null)} className="px-4 py-2 rounded-lg text-sm" style={{ border: "1px solid #DDD3C4" }}>Annuler</button>
        </div>
      ) : (
        <button onClick={() => setEdition({ seuilBas: "", seuilHaut: "", montantBonus: "" })} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "#8C3B2E" }}>
          <Plus size={16} /> Ajouter un palier de bonus
        </button>
      )}
    </div>
  );
}

function PaliersStatut() {
  const [paliers, setPaliers] = useState(null);
  const [error, setError] = useState("");
  const [edition, setEdition] = useState(null); // { id?, nom, seuilBas, seuilHaut }

  const load = useCallback(async () => {
    try { setPaliers(await api.fidelite.paliersStatut()); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const enregistrer = async () => {
    try {
      const data = { nom: edition.nom, seuilBas: Number(edition.seuilBas), seuilHaut: edition.seuilHaut === "" ? null : Number(edition.seuilHaut) };
      if (edition.id) await api.fidelite.majPalierStatut(edition.id, data);
      else await api.fidelite.creerPalierStatut(data);
      setEdition(null);
      load();
    } catch (e) { setError(e.message); }
  };
  const supprimer = async (id) => {
    try { await api.fidelite.supprimerPalierStatut(id); load(); } catch (e) { setError(e.message); }
  };
  const toggleActif = async (p) => {
    try { await api.fidelite.majPalierStatut(p.id, { actif: !p.actif }); load(); } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "#6B5D52" }}>
        Basé sur le cumul <strong>total à vie</strong> d'une cliente (jamais remis à zéro). Purement honorifique — aucune réduction automatique associée.
      </p>
      {error && <ErrorBanner error={error} />}
      {paliers === null ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement...</p>
      ) : (
        <div className="space-y-2 mb-4">
          {paliers.map((p) => (
            <div key={p.id} className="rounded-xl p-3 flex items-center justify-between gap-3 text-sm" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2", opacity: p.actif ? 1 : 0.5 }}>
              <div>
                <span className="font-semibold">{p.nom}</span>
                <span className="ml-2" style={{ color: "#6B5D52" }}>
                  De {fmt(p.seuilBas)} F {p.seuilHaut != null ? `à ${fmt(p.seuilHaut)} F` : "et au-delà"}
                </span>
                {!p.actif && <span className="ml-2 text-xs" style={{ color: "#6B5D52" }}>(désactivé)</span>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => toggleActif(p)} className="text-xs px-2 py-1 rounded" style={{ border: "1px solid #DDD3C4" }}>{p.actif ? "Désactiver" : "Activer"}</button>
                <button onClick={() => setEdition({ id: p.id, nom: p.nom, seuilBas: p.seuilBas, seuilHaut: p.seuilHaut ?? "" })} className="p-1.5 rounded" style={{ border: "1px solid #DDD3C4" }}><Pencil size={14} /></button>
                <button onClick={() => supprimer(p.id)} className="p-1.5 rounded" style={{ border: "1px solid #DDD3C4", color: "#B04A3B" }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {edition ? (
        <div className="rounded-xl p-4 flex flex-wrap items-end gap-3" style={{ background: "#FFFDF9", border: "1px solid #EAE1D2" }}>
          <div><label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Nom</label><input type="text" value={edition.nom} onChange={(e) => setEdition({ ...edition, nom: e.target.value })} style={inputStyle} className="w-48" placeholder="Cendrillon ..." /></div>
          <div><label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Seuil bas (F)</label><input type="number" value={edition.seuilBas} onChange={(e) => setEdition({ ...edition, seuilBas: e.target.value })} style={inputStyle} className="w-32" /></div>
          <div><label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Seuil haut (F, vide = illimité)</label><input type="number" value={edition.seuilHaut} onChange={(e) => setEdition({ ...edition, seuilHaut: e.target.value })} style={inputStyle} className="w-40" /></div>
          <button onClick={enregistrer} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Enregistrer</button>
          <button onClick={() => setEdition(null)} className="px-4 py-2 rounded-lg text-sm" style={{ border: "1px solid #DDD3C4" }}>Annuler</button>
        </div>
      ) : (
        <button onClick={() => setEdition({ nom: "", seuilBas: "", seuilHaut: "" })} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "#8C3B2E" }}>
          <Plus size={16} /> Ajouter un statut
        </button>
      )}
    </div>
  );
}

function ClientesBonusDisponible() {
  const [clients, setClients] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.fidelite.clientsBonusDisponible().then(setClients).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "#6B5D52" }}>
        Toutes les clientes ayant actuellement un bonus prêt à être déduit à leur prochain achat — utile pour vérifier et suivre le programme, pas pour un usage quotidien.
      </p>
      {error && <ErrorBanner error={error} />}
      {clients === null ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement...</p>
      ) : clients.length === 0 ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Aucune cliente n'a de bonus disponible pour l'instant.</p>
      ) : (
        <>
          <p className="text-sm font-medium mb-3">{clients.length} cliente(s) avec un bonus disponible</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 600 }}>
              <thead>
                <tr style={{ color: "#6B5D52", borderBottom: "1px solid #EAE1D2" }}>
                  <th className="text-left py-2">Cliente</th>
                  <th className="text-left py-2">Téléphone</th>
                  <th className="text-right py-2">Cumul courant</th>
                  <th className="text-right py-2">Bonus disponible</th>
                  <th className="text-right py-2">Volume total</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid #EFE7D9" }}>
                    <td className="py-2">{c.nomPrenoms}</td>
                    <td className="py-2" style={{ color: "#6B5D52" }}>{c.telephone || "—"}</td>
                    <td className="text-right py-2 font-mono whitespace-nowrap">{fmt(c.cumulFideliteCourant)} F</td>
                    <td className="text-right py-2 font-mono font-semibold whitespace-nowrap" style={{ color: "#3F6B4A" }}>{fmt(c.bonusDisponible)} F</td>
                    <td className="text-right py-2 font-mono whitespace-nowrap" style={{ color: "#6B5D52" }}>{fmt(c.cumulFideliteTotal)} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function ChangementsStatut() {
  const [liste, setListe] = useState(null);
  const [error, setError] = useState("");
  const [enCours, setEnCours] = useState(null);

  const load = useCallback(async () => {
    try { setListe(await api.fidelite.changementsStatut()); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const marquerVu = async (c) => {
    setEnCours(c.id);
    try { await api.fidelite.marquerChangementStatutVu(c.id); setListe((l) => l.filter((x) => x.id !== c.id)); }
    catch (e) { setError(e.message); } finally { setEnCours(null); }
  };

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "#6B5D52" }}>
        Toutes les clientes ayant changé de statut Cendrillon, pas encore marquées vues. Une occasion de les reconnaître — à toi de voir s'il y a un geste commercial à faire.
      </p>
      {error && <ErrorBanner error={error} />}
      {liste === null ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement...</p>
      ) : liste.length === 0 ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Aucun changement de statut en attente.</p>
      ) : (
        <div className="space-y-2">
          {liste.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: "#FBF3E3" }}>
              <div>
                <p className="text-sm font-medium">{c.client?.nomPrenoms || "Cliente inconnue"}</p>
                <p className="text-xs" style={{ color: "#6B5D52" }}>
                  {c.ancienStatut ? `${c.ancienStatut} → ` : ""}<strong>{c.nouveauStatut}</strong>
                  {c.client?.telephone ? ` · ${c.client.telephone}` : ""}
                </p>
              </div>
              <button onClick={() => marquerVu(c)} disabled={enCours === c.id} className="text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap" style={{ background: "#A8823D", color: "#2B2320" }}>
                Vu
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BonusAccordes() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  const load = useCallback(async () => {
    try { setData(await api.fidelite.bonusAccordes({ dateDebut, dateFin })); } catch (e) { setError(e.message); }
  }, [dateDebut, dateFin]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "#6B5D52" }}>
        Tout ce que le programme Cendrillon a reversé aux clientes sur la période choisie — utile pour ajuster tes paliers en connaissance de cause.
      </p>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div><label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Du</label><input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid #DDD3C4" }} /></div>
        <div><label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Au</label><input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid #DDD3C4" }} /></div>
      </div>
      {error && <ErrorBanner error={error} />}
      {data === null ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement...</p>
      ) : (
        <>
          <div className="rounded-xl p-4 mb-4" style={{ background: "#FBF3E3", border: "1px solid #EAE1D2" }}>
            <p className="text-sm" style={{ color: "#6B5D52" }}>Total accordé sur la période</p>
            <p className="font-display text-2xl font-semibold" style={{ color: "#A8823D" }}>{fmt(data.total)} F <span className="text-sm font-normal" style={{ color: "#6B5D52" }}>({data.nombre} bonus)</span></p>
          </div>
          {data.bonus.length === 0 ? (
            <p className="text-sm" style={{ color: "#6B5D52" }}>Aucun bonus accordé sur cette période.</p>
          ) : (
            <div className="space-y-1.5">
              {data.bonus.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg px-4 py-3 text-sm" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
                  <div>
                    <span className="font-medium">{b.client?.nomPrenoms || "Cliente inconnue"}</span>
                    <span className="ml-2" style={{ color: "#6B5D52" }}>vente {b.vente?.numero} · {b.vente?.boutique} · {new Date(b.createdAt).toLocaleDateString("fr-FR")}</span>
                  </div>
                  <span className="font-mono font-semibold" style={{ color: "#3F6B4A" }}>-{fmt(b.montant)} F</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClientesParStatut() {
  const [repartition, setRepartition] = useState(null);
  const [statutChoisi, setStatutChoisi] = useState(null);
  const [clients, setClients] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api.fidelite.clientsParStatut().then(setRepartition).catch((e) => setError(e.message)); }, []);

  const ouvrir = async (statut) => {
    setStatutChoisi(statut);
    setClients(null);
    try { setClients(await api.fidelite.clientsParStatut(statut)); } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "#6B5D52" }}>Choisis un statut pour voir la liste des clientes concernées.</p>
      {error && <ErrorBanner error={error} />}
      {repartition === null ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement...</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-5">
          {repartition.map((r) => (
            <button key={r.statut} onClick={() => ouvrir(r.statut)} className="px-4 py-2 rounded-full text-sm font-medium"
              style={statutChoisi === r.statut ? { background: "#2B2320", color: "#FBF3EC" } : { border: "1px solid #DDD3C4", color: "#6B5D52" }}>
              {r.statut} ({r.nombre})
            </button>
          ))}
        </div>
      )}
      {statutChoisi && (
        clients === null ? (
          <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement...</p>
        ) : clients.length === 0 ? (
          <p className="text-sm" style={{ color: "#6B5D52" }}>Aucune cliente dans ce statut pour l'instant.</p>
        ) : (
          <div className="space-y-1.5">
            {clients.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg px-4 py-3 text-sm" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
                <div>
                  <span className="font-medium">{c.nomPrenoms}</span>
                  <span className="ml-2" style={{ color: "#6B5D52" }}>{c.telephone || "téléphone non renseigné"}</span>
                </div>
                <span className="font-mono" style={{ color: "#6B5D52" }}>{fmt(c.cumulFideliteTotal)} F</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default function FideliteSection() {
  const [vue, setVue] = useState("BONUS");
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-1">Programme de fidélité — Cendrillon</h1>
      <p className="text-sm mb-5" style={{ color: "#6B5D52" }}>Réservé à l'administrateur — les deux grilles ci-dessous sont entièrement à ta main.</p>
      <Onglets vue={vue} setVue={setVue} />
      {vue === "BONUS" && <PaliersBonus />}
      {vue === "STATUT" && <PaliersStatut />}
      {vue === "CLIENTES" && <ClientesBonusDisponible />}
      {vue === "CHANGEMENTS" && <ChangementsStatut />}
      {vue === "ACCORDES" && <BonusAccordes />}
      {vue === "PARSTATUT" && <ClientesParStatut />}
    </div>
  );
}
