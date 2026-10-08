import { useState, useEffect, useCallback } from "react";
import { Plus, Receipt, Tag, Wallet, Pencil, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { BOUTIQUES, fmt } from "../constants.js";
import { ErrorBanner, selectStyle } from "../components/Shared.jsx";

const COULEUR = { carte: "#FFFFFF", bordure: "#EAE1D2", texte: "#2B2320", texteDoux: "#6B5D52", accent: "#8C3B2E" };
const BOUTIQUES_DEPENSE = [...BOUTIQUES, "Générale"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DepensesSection() {
  const { user } = useAuth();
  const estAdmin = !!user?.role?.systeme;
  const [tab, setTab] = useState("saisir");
  const [categories, setCategories] = useState([]);
  const [mesDepenses, setMesDepenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, dep] = await Promise.all([api.depenses.categories.list(), api.depenses.list()]);
      setCategories(cats);
      setMesDepenses(dep);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const TABS = [
    ["saisir", estAdmin ? "Saisir" : "Saisir une dépense", Wallet],
    ...(estAdmin ? [
      ["toutes", "Toutes les dépenses", Receipt],
      ["categories", "Catégories", Tag],
      ["budget", "Budget prévisionnel", Wallet],
    ] : []),
  ];

  return (
    <div>
      <ErrorBanner error={error} onClose={() => setError("")} />
      <div className="flex gap-2 mb-6">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium"
            style={tab === id ? { background: "#2B2320", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52", border: "1px solid #DDD3C4" }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm" style={{ color: COULEUR.texteDoux }}>Chargement…</p>}

      {!loading && tab === "saisir" && (
        <SaisieDepense categories={categories} mesDepenses={mesDepenses} estAdmin={estAdmin} onSaved={load} onError={setError} />
      )}
      {!loading && estAdmin && tab === "toutes" && (
        <ToutesLesDepenses categories={categories} onError={setError} />
      )}
      {!loading && estAdmin && tab === "categories" && (
        <GestionCategories categories={categories} onChanged={load} onError={setError} />
      )}
      {!loading && estAdmin && tab === "budget" && (
        <BudgetPrevisionnel categories={categories} onError={setError} />
      )}
    </div>
  );
}

function SaisieDepense({ categories, mesDepenses, estAdmin, onSaved, onError }) {
  const [categorieId, setCategorieId] = useState("");
  const [montant, setMontant] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [boutique, setBoutique] = useState(estAdmin ? "" : BOUTIQUES[0]);
  const [envoi, setEnvoi] = useState(false);
  const [saved, setSaved] = useState(false);

  const soumettre = async () => {
    if (!categorieId || !montant || Number(montant) <= 0) { onError("Catégorie et montant (positif) sont obligatoires."); return; }
    if (estAdmin && !boutique) { onError("Choisis la boutique concernée par cette dépense."); return; }
    setEnvoi(true);
    try {
      const data = { categorieId, montant: Number(montant), description, reference };
      if (estAdmin) data.boutique = boutique;
      await api.depenses.create(data);
      setCategorieId(""); setMontant(""); setDescription(""); setReference("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (e) { onError(e.message); } finally { setEnvoi(false); }
  };

  return (
    <div>
      <div className="rounded-2xl p-5 mb-6" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
        <p className="font-display text-lg font-semibold mb-4">Nouvelle dépense — {todayISO().split("-").reverse().join("/")}</p>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Catégorie</label>
            <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)} style={selectStyle}>
              <option value="">— Choisir —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Montant (F CFA)</label>
            <input value={montant} onChange={(e) => setMontant(e.target.value.replace(/\D/g, ""))} inputMode="numeric" style={selectStyle} />
          </div>
          {estAdmin && (
            <div>
              <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Boutique</label>
              <select value={boutique} onChange={(e) => setBoutique(e.target.value)} style={selectStyle}>
                <option value="">— Choisir —</option>
                {BOUTIQUES_DEPENSE.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Référence justificatif</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° facture, « reçu papier classé »…" style={selectStyle} />
          </div>
        </div>
        <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...selectStyle, width: "100%" }} />
<button onClick={soumettre} disabled={envoi} className="mt-4 px-5 py-2.5 rounded-lg text-sm font-medium"
          style={{ background: saved ? "#3F6B4A" : "#8C3B2E", color: "#FBF3EC", opacity: envoi ? 0.7 : 1 }}>
          {saved ? "Enregistré ✓" : envoi ? "Enregistrement..." : "Enregistrer la dépense"}
        </button>
      </div>

      <p className="text-xs font-mono uppercase tracking-wide mb-3" style={{ color: COULEUR.accent }}>Mes dépenses du jour</p>
      <div className="rounded-2xl overflow-hidden" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#F1E9DC", color: COULEUR.texteDoux }}>
              <th className="text-left px-4 py-2">Heure</th>
              <th className="text-left px-4 py-2">Catégorie</th>
              <th className="text-left px-4 py-2">Description</th>
              <th className="text-right px-4 py-2">Montant</th>
            </tr>
          </thead>
          <tbody>
            {mesDepenses.map((d) => (
              <tr key={d.id} style={{ borderTop: "1px solid #EFE7D9" }}>
                <td className="px-4 py-2">{new Date(d.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</td>
                <td className="px-4 py-2">{d.categorie?.nom}</td>
                <td className="px-4 py-2">{d.description || "—"}</td>
                <td className="text-right px-4 py-2">{fmt(d.montant)} F</td>
              </tr>
            ))}
            {mesDepenses.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center" style={{ color: COULEUR.texteDoux }}>Aucune dépense saisie aujourd'hui.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToutesLesDepenses({ categories, onError }) {
  const [depenses, setDepenses] = useState([]);
  const [boutique, setBoutique] = useState("");
  const [categorieId, setCategorieId] = useState("");
  const [dateDebut, setDateDebut] = useState(todayISO());
  const [dateFin, setDateFin] = useState(todayISO());
  const [chargement, setChargement] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const params = { dateDebut, dateFin };
      if (boutique) params.boutique = boutique;
      if (categorieId) params.categorieId = categorieId;
      setDepenses(await api.depenses.list(params));
    } catch (e) { onError(e.message); } finally { setChargement(false); }
  }, [boutique, categorieId, dateDebut, dateFin, onError]);
  useEffect(() => { charger(); }, [charger]);

  const total = depenses.reduce((s, d) => s + d.montant, 0);

  return (
    <div>
      <div className="flex items-end gap-3 flex-wrap mb-5 p-4 rounded-2xl" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
        <div>
          <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Du</label>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #DDD3C4" }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Au</label>
          <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #DDD3C4" }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Boutique</label>
          <select value={boutique} onChange={(e) => setBoutique(e.target.value)} style={selectStyle}>
            <option value="">Toutes</option>
            {BOUTIQUES_DEPENSE.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Catégorie</label>
          <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)} style={selectStyle}>
            <option value="">Toutes</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
      </div>

      {chargement && <p className="text-sm" style={{ color: COULEUR.texteDoux }}>Chargement…</p>}
      {!chargement && (
        <div className="rounded-2xl overflow-hidden" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#F1E9DC", color: COULEUR.texteDoux }}>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Boutique</th>
                <th className="text-left px-4 py-2">Catégorie</th>
                <th className="text-left px-4 py-2">Description</th>
                <th className="text-left px-4 py-2">Saisie par</th>
                <th className="text-right px-4 py-2">Montant</th>
              </tr>
            </thead>
            <tbody>
              {depenses.map((d) => (
                <tr key={d.id} style={{ borderTop: "1px solid #EFE7D9" }}>
                  <td className="px-4 py-2">{new Date(d.date).toLocaleString("fr-FR")}</td>
                  <td className="px-4 py-2">{d.boutique}</td>
                  <td className="px-4 py-2">{d.categorie?.nom}</td>
                  <td className="px-4 py-2">{d.description || "—"}</td>
                  <td className="px-4 py-2">{d.effectuePar?.prenom} {d.effectuePar?.nom}</td>
                  <td className="text-right px-4 py-2">{fmt(d.montant)} F</td>
                </tr>
              ))}
              {depenses.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center" style={{ color: COULEUR.texteDoux }}>Aucune dépense sur cette période.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #2B2320", fontWeight: 600 }}>
                <td className="px-4 py-2" colSpan={5}>Total ({depenses.length})</td>
                <td className="text-right px-4 py-2">{fmt(total)} F</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function GestionCategories({ categories, onChanged, onError }) {
  const [nouveau, setNouveau] = useState("");
  const [editionId, setEditionId] = useState(null);
  const [nomEdite, setNomEdite] = useState("");

  const ajouter = async () => {
    if (!nouveau.trim()) return;
    try { await api.depenses.categories.create(nouveau.trim()); setNouveau(""); onChanged(); } catch (e) { onError(e.message); }
  };
  const toggler = async (cat) => {
    try { await api.depenses.categories.update(cat.id, { actif: !cat.actif }); onChanged(); } catch (e) { onError(e.message); }
  };
  const commencerEdition = (cat) => { setEditionId(cat.id); setNomEdite(cat.nom); };
  const annulerEdition = () => { setEditionId(null); setNomEdite(""); };
  const enregistrerEdition = async (cat) => {
    if (!nomEdite.trim()) return;
    try { await api.depenses.categories.update(cat.id, { nom: nomEdite.trim() }); setEditionId(null); onChanged(); } catch (e) { onError(e.message); }
  };
  const supprimer = async (cat) => {
    if (!window.confirm(`Supprimer la catégorie "${cat.nom}" ? Cette action est irréversible.`)) return;
    try { await api.depenses.categories.remove(cat.id); onChanged(); } catch (e) { onError(e.message); }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <input value={nouveau} onChange={(e) => setNouveau(e.target.value)} placeholder="Nouvelle catégorie" className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #DDD3C4" }} onKeyDown={(e) => e.key === "Enter" && ajouter()} />
        <button onClick={ajouter} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}><Plus size={16} /> Ajouter</button>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {categories.map((c) => (
          <div key={c.id} className="rounded-lg px-4 py-3" style={{ background: COULEUR.carte, border: "1px solid #EAE1D2" }}>
            {editionId === c.id ? (
              <div className="flex items-center gap-2">
                <input value={nomEdite} onChange={(e) => setNomEdite(e.target.value)} autoFocus className="flex-1 px-2 py-1 rounded text-sm outline-none" style={{ border: "1px solid #DDD3C4" }} onKeyDown={(e) => e.key === "Enter" && enregistrerEdition(c)} />
                <button onClick={() => enregistrerEdition(c)} className="text-xs px-2 py-1 rounded" style={{ background: "#3F6B4A", color: "#F3F7F3" }}>OK</button>
                <button onClick={annulerEdition} className="text-xs px-2 py-1 rounded" style={{ color: "#6B5D52" }}>Annuler</button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{c.nom}</p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => toggler(c)} className="text-xs px-2 py-1 rounded-full" style={c.actif ? { background: "#E9F0EA", color: "#3F6B4A" } : { background: "#FBEAE7", color: "#B04A3B" }}>
                    {c.actif ? "Active" : "Désactivée"}
                  </button>
                  <button onClick={() => commencerEdition(c)} title="Renommer" style={{ color: "#6B5D52" }}><Pencil size={14} /></button>
                  <button onClick={() => supprimer(c)} title="Supprimer" style={{ color: "#B04A3B" }}><Trash2 size={14} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function statutBudget(prevu, realise) {
  if (prevu === 0) return { couleur: "#6B5D52", fond: "#F1E9DC", label: "—" };
  const ratio = realise / prevu;
  if (ratio >= 1) return { couleur: "#B04A3B", fond: "#FBEAE7", label: "Dépassement" };
  if (ratio >= 0.8) return { couleur: "#A8823D", fond: "#FDF3E3", label: "Proche limite" };
  return { couleur: "#3F6B4A", fond: "#E9F0EA", label: "Maîtrisé" };
}

function BudgetPrevisionnel({ onError }) {
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [boutique, setBoutique] = useState("");
  const [lignes, setLignes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [modif, setModif] = useState({});

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const params = boutique ? { boutique } : {};
      setLignes(await api.depenses.budget.get(annee, params));
    } catch (e) { onError(e.message); } finally { setChargement(false); }
  }, [annee, boutique, onError]);
  useEffect(() => { charger(); }, [charger]);

  const enregistrer = async (categorieId) => {
    const montant = Number(modif[categorieId]);
    if (isNaN(montant) || montant < 0) return;
    try {
      await api.depenses.budget.set({ categorieId, annee, montantPrevisionnel: montant });
      setModif((m) => { const c = { ...m }; delete c[categorieId]; return c; });
      charger();
    } catch (e) { onError(e.message); }
  };

  const totalPrevu = lignes.reduce((s, l) => s + l.montantPrevisionnel, 0);
  const totalRealise = lignes.reduce((s, l) => s + l.montantRealise, 0);
  const statutGlobal = statutBudget(totalPrevu, totalRealise);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <label className="text-sm" style={{ color: COULEUR.texteDoux }}>Année :</label>
        <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))} style={selectStyle}>
          {[annee - 1, annee, annee + 1].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <label className="text-sm ml-3" style={{ color: COULEUR.texteDoux }}>Vue :</label>
        <div className="flex gap-2">
          {[["", "Consolidé"], ...BOUTIQUES.map((b) => [b, b])].map(([val, label]) => (
            <button key={val || "consolide"} onClick={() => setBoutique(val)} className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={boutique === val ? { background: "#2B2320", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52", border: "1px solid #DDD3C4" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {chargement && <p className="text-sm" style={{ color: COULEUR.texteDoux }}>Chargement…</p>}
      {!chargement && (
        <>
          <div className="rounded-2xl p-4 mb-5 flex items-center justify-between" style={{ background: statutGlobal.fond, border: `1px solid ${statutGlobal.couleur}33` }}>
            <div>
              <p className="text-xs font-mono uppercase tracking-wide" style={{ color: statutGlobal.couleur }}>
                Statut global {boutique ? `— ${boutique}` : "— Consolidé (Angré + Koumassi)"}
              </p>
              <p className="font-display text-lg font-semibold" style={{ color: statutGlobal.couleur }}>{statutGlobal.label}</p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: COULEUR.texteDoux }}>Réalisé / Prévisionnel</p>
              <p className="font-display text-lg font-semibold">{fmt(totalRealise)} F / {fmt(totalPrevu)} F</p>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F1E9DC", color: COULEUR.texteDoux }}>
                  <th className="text-left px-4 py-2">Catégorie</th>
                  <th className="text-right px-4 py-2">Prévisionnel</th>
                  <th className="text-right px-4 py-2">Réalisé</th>
                  <th className="text-right px-4 py-2">Écart</th>
                  <th className="text-center px-4 py-2">Statut</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const ecart = l.montantPrevisionnel - l.montantRealise;
                  const statut = statutBudget(l.montantPrevisionnel, l.montantRealise);
                  return (
                    <tr key={l.categorieId} style={{ borderTop: "1px solid #EFE7D9" }}>
                      <td className="px-4 py-2">{l.categorie}</td>
                      <td className="text-right px-4 py-2">
                        <input
                          value={l.categorieId in modif ? modif[l.categorieId] : l.montantPrevisionnel}
                          onChange={(e) => setModif((m) => ({ ...m, [l.categorieId]: e.target.value.replace(/\D/g, "") }))}
                          disabled={!!boutique}
                          className="w-28 text-right px-2 py-1 rounded"
                          style={{ border: "1px solid #DDD3C4", opacity: boutique ? 0.5 : 1 }}
                        />
                      </td>
                      <td className="text-right px-4 py-2">{fmt(l.montantRealise)} F</td>
                      <td className="text-right px-4 py-2" style={{ color: ecart >= 0 ? "#3F6B4A" : "#B04A3B" }}>{fmt(ecart)} F</td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: statut.fond, color: statut.couleur }}>
                          {statut.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {!boutique && l.categorieId in modif && (
                          <button onClick={() => enregistrer(l.categorieId)} className="text-xs px-3 py-1 rounded-full" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Enregistrer</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #2B2320", fontWeight: 600 }}>
                  <td className="px-4 py-2">Total</td>
                  <td className="text-right px-4 py-2">{fmt(totalPrevu)} F</td>
                  <td className="text-right px-4 py-2">{fmt(totalRealise)} F</td>
                  <td className="text-right px-4 py-2" style={{ color: totalPrevu - totalRealise >= 0 ? "#3F6B4A" : "#B04A3B" }}>{fmt(totalPrevu - totalRealise)} F</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
          {boutique && (
            <p className="text-xs mt-3" style={{ color: COULEUR.texteDoux }}>
              Le montant prévisionnel reste global (annuel, toutes boutiques) — seul le réalisé est filtré sur {boutique}. Passe en vue "Consolidé" pour modifier le prévisionnel.
            </p>
          )}
        </>
      )}
    </div>
  );
}