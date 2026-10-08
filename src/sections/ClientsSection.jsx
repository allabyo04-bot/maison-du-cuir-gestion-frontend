import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Cake, Search, X, SlidersHorizontal, Receipt, Download, Crown } from "lucide-react";
import { api } from "../api.js";
import { CIVILITES, JOURS, MOIS, COMMUNES, CLIENT_POINTURES, PAYS_LIST, PAYS_INDICATIF, QUARTIERS_PAR_COMMUNE, BOUTIQUES, FIDELITE_ACTIF, fmt } from "../constants.js";
import { Field, ConfirmModal, ErrorBanner, inputStyle, selectStyle } from "../components/Shared.jsx";

export default function ClientsSection() {
  const [subTab, setSubTab] = useState("fiche");
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalClient, setModalClient] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [historiqueClient, setHistoriqueClient] = useState(null);
  const [search, setSearch] = useState("");
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [filtrePointure, setFiltrePointure] = useState("");
  const [filtreMois, setFiltreMois] = useState("");
  const [filtreVille, setFiltreVille] = useState("");
  const [filtreCommune, setFiltreCommune] = useState("");
  const [filtrePays, setFiltrePays] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setClients(await api.clients.list()); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNewClient = () => setModalClient({
    isNew: true, nomPrenoms: "", jourAnniv: "01", moisAnniv: "Janvier", civilite: "Monsieur",
    adresse: "", ville: "", commune: COMMUNES[0], quartier: "", telephone: "", whatsapp: "",
    pointure: "", pays: "Côte d'Ivoire", carteFidelite: "", dateDelivrance: new Date().toISOString().slice(0, 10), observation: "",
  });
  const openEditClient = (c) => setModalClient({ ...c, isNew: false, dateDelivrance: c.dateDelivrance ? c.dateDelivrance.slice(0, 10) : "" });

  const voirHistorique = async (c) => {
    try { setHistoriqueClient(await api.clients.historiqueAchats(c.id)); } catch (e) { setError(e.message); }
  };

  const chiffresSeuls = (s) => (s || "").replace(/\D/g, "");
  // La règle "10 chiffres" est spécifique à la Côte d'Ivoire (confirmée). D'autres pays ont
  // encore des numéros locaux à 8 chiffres (ou d'autres longueurs) — on reste large pour eux
  // plutôt que de bloquer à tort une cliente dont le numéro est en réalité correct.
  const nombreDeChiffresValide = (numero, pays) => {
    const n = chiffresSeuls(numero).length;
    if (pays === "Côte d'Ivoire") return n === 10;
    return n >= 8 && n <= 11;
  };

  const submitClient = async (form) => {
    if (!form.nomPrenoms.trim()) { setError("Le nom et prénoms du client sont obligatoires."); return; }
    if (!form.telephone?.trim()) { setError("Le numéro de téléphone du client est obligatoire."); return; }
    if (!nombreDeChiffresValide(form.telephone, form.pays)) {
      setError(`Le numéro de téléphone semble incorrect pour ${form.pays} (${chiffresSeuls(form.telephone).length} chiffres actuellement). Vérifie la saisie.`);
      return;
    }
    if (form.whatsapp?.trim() && !nombreDeChiffresValide(form.whatsapp, form.pays)) {
      setError(`Le numéro WhatsApp semble incorrect pour ${form.pays} (${chiffresSeuls(form.whatsapp).length} chiffres actuellement). Vérifie la saisie.`);
      return;
    }
    try {
      if (form.isNew) {
        const cree = await api.clients.create(form);
        localStorage.setItem("gc_dernier_client_id", cree.id);
      } else {
        await api.clients.update(form.id, form);
      }
      setModalClient(null); setError(""); load();
    } catch (e) { setError(e.message); }
  };

  const removeClient = async (c) => {
    try { await api.clients.remove(c.id); setConfirmDelete(null); load(); } catch (e) { setError(e.message); }
  };

  const reinitialiserFiltres = () => {
    setFiltrePointure(""); setFiltreMois(""); setFiltreVille(""); setFiltreCommune(""); setFiltrePays("");
  };
  const nbFiltresActifs = [filtrePointure, filtreMois, filtreVille, filtreCommune, filtrePays].filter(Boolean).length;

  const villesConnues = [...new Set(clients.map((c) => c.ville).filter(Boolean))].sort();

  const filtered = clients.filter((c) => {
    const matchSearch =
      c.nomPrenoms.toLowerCase().includes(search.toLowerCase()) ||
      (c.carteFidelite || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.telephone || "").includes(search);
    if (!matchSearch) return false;
    if (filtrePointure && c.pointure !== filtrePointure) return false;
    if (filtreMois && c.moisAnniv !== filtreMois) return false;
    if (filtreVille && (c.ville || "").toLowerCase() !== filtreVille.toLowerCase()) return false;
    if (filtreCommune && c.commune !== filtreCommune) return false;
    if (filtrePays && c.pays !== filtrePays) return false;
    return true;
  });

  const exporterClientsExcel = () => {
    // Astuce Excel : ="0778138742" force Excel à garder ce texte tel quel (avec le zéro de
    // tête), même en ouvrant le fichier directement, contrairement à une simple colonne
    // "texte" qu'Excel réinterprète parfois comme un nombre et vide le zéro initial.
    const protegerNumero = (n) => (n ? `="${String(n).trim()}"` : "");

    const lignes = [["Nom et prénoms", "Téléphone", "WhatsApp", "Ville", "Commune", "Pays", "Pointure", "Anniversaire", "Carte fidélité"]];
    filtered.forEach((c) => {
      lignes.push([c.nomPrenoms, protegerNumero(c.telephone), protegerNumero(c.whatsapp), c.ville || "", c.commune || "", c.pays || "", c.pointure || "", c.jourAnniv && c.moisAnniv ? `${c.jourAnniv} ${c.moisAnniv}` : "", c.carteFidelite || ""]);
    });
    const csv = lignes.map((ligne) => ligne.map((cell) => {
      const texte = String(cell);
      // Une cellule déjà au format ="..." ne doit pas être re-entourée de guillemets,
      // sinon Excel ne la lit plus comme une formule protégeant le zéro de tête.
      if (/^="[^"]*"$/.test(texte)) return texte;
      return `"${texte.replace(/"/g, '""')}"`;
    }).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients${nbFiltresActifs > 0 || search ? "-filtres" : ""}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <ErrorBanner error={error} onClose={() => setError("")} />
      <div className="flex gap-2 mb-6">
        {[["fiche", "Fiche clients"], ["anniversaires", "Anniversaires"], ["achats", "Historique par carte fidélité"]].map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)} className="px-4 py-2 rounded-full text-sm font-medium" style={subTab === id ? { background: "#2B2320", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52", border: "1px solid #DDD3C4" }}>{label}</button>
        ))}
      </div>

      {loading && <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement…</p>}

      {!loading && subTab === "fiche" && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher nom, téléphone ou carte…" style={{ ...selectStyle, paddingLeft: "32px", minWidth: "260px" }} />
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#6B5D52" />
              </div>
              <button onClick={() => setFiltresOuverts((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={filtresOuverts || nbFiltresActifs > 0 ? { background: "#8C3B2E", color: "#FBF3EC" } : { border: "1px solid #DDD3C4", color: "#6B5D52" }}>
                <SlidersHorizontal size={14} /> Filtres avancés{nbFiltresActifs > 0 ? ` (${nbFiltresActifs})` : ""}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exporterClientsExcel} disabled={filtered.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid #DDD3C4", color: "#6B5D52", opacity: filtered.length === 0 ? 0.5 : 1 }}>
                <Download size={16} /> Exporter ({filtered.length})
              </button>
              <button onClick={openNewClient} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>
                <Plus size={16} /> Nouveau client
              </button>
            </div>
          </div>

          {filtresOuverts && (
            <div className="rounded-xl p-4 mb-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
              <div className="grid sm:grid-cols-5 gap-3">
                <Field label="Pointure">
                  <select value={filtrePointure} onChange={(e) => setFiltrePointure(e.target.value)} style={selectStyle}>
                    <option value="">Toutes</option>{CLIENT_POINTURES.map((p) => <option key={p} value={p}>T{p}</option>)}
                  </select>
                </Field>
                <Field label="Mois anniversaire">
                  <select value={filtreMois} onChange={(e) => setFiltreMois(e.target.value)} style={selectStyle}>
                    <option value="">Tous</option>{MOIS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Ville">
                  <select value={filtreVille} onChange={(e) => setFiltreVille(e.target.value)} style={selectStyle}>
                    <option value="">Toutes</option>{villesConnues.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Commune">
                  <select value={filtreCommune} onChange={(e) => setFiltreCommune(e.target.value)} style={selectStyle}>
                    <option value="">Toutes</option>{COMMUNES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Pays">
                  <select value={filtrePays} onChange={(e) => setFiltrePays(e.target.value)} style={selectStyle}>
                    <option value="">Tous</option>{PAYS_LIST.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
              </div>
              {nbFiltresActifs > 0 && (
                <button onClick={reinitialiserFiltres} className="mt-3 text-xs font-medium" style={{ color: "#B04A3B" }}>Réinitialiser les filtres</button>
              )}
            </div>
          )}

          <p className="text-xs mb-4" style={{ color: "#6B5D52" }}>{filtered.length} client{filtered.length > 1 ? "s" : ""} {nbFiltresActifs > 0 || search ? "correspondant(s)" : "au total"}</p>

          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <div key={c.id} className="stitch card-hover rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium leading-tight">{c.nomPrenoms}</p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: "#6B5D52" }}>{c.code}</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "#F1E9DC", color: "#6B5D52" }}>{c.civilite}</span>
                </div>
                <div className="mt-3 text-xs space-y-1" style={{ color: "#6B5D52" }}>
                  <p>{c.telephone || "— pas de téléphone"}{c.whatsapp ? ` · WhatsApp ${c.whatsapp}` : ""}</p>
                  <p>{[c.ville, c.commune, c.quartier].filter(Boolean).join(", ") || "— pas d'adresse"}{c.pays ? ` · ${c.pays}` : ""}</p>
                  <p className="flex items-center gap-1"><Cake size={11} /> {c.jourAnniv} {c.moisAnniv}</p>
                  {c.pointure && <p>Pointure T{c.pointure}</p>}
                </div>
                {c.carteFidelite && <span className="inline-block mt-3 text-xs px-2.5 py-1 rounded-full font-mono" style={{ background: "#E9F0EA", color: "#3F6B4A" }}>Carte {c.carteFidelite}</span>}
                {c.observation?.includes("via un bon de livraison") && (
                  <span className="inline-block mt-3 ml-2 text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "#FBEAE7", color: "#B04A3B" }}>⚠ À compléter</span>
                )}
                <div className="flex items-center justify-end gap-3 mt-4 pt-4" style={{ borderTop: "1px solid #EFE7D9" }}>
                  <button onClick={() => voirHistorique(c)} title="Voir les achats" style={{ color: "#3F6B4A" }}><Receipt size={16} /></button>
                  <button onClick={() => openEditClient(c)} style={{ color: "#8C3B2E" }}><Pencil size={16} /></button>
                  <button onClick={() => setConfirmDelete(c)} style={{ color: "#B04A3B" }}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>Aucun client ne correspond à ces critères.</p>}
          </div>
        </div>
      )}

      {!loading && subTab === "anniversaires" && <AnniversairesReport clients={clients} />}
      {!loading && subTab === "achats" && <AchatsParCarteReport />}

      {modalClient && <ClientModal client={modalClient} onCancel={() => setModalClient(null)} onSubmit={submitClient} />}
      {confirmDelete && <ConfirmModal title="Supprimer ce client ?" message={`${confirmDelete.nomPrenoms} sera retiré de la fiche clients.`} onCancel={() => setConfirmDelete(null)} onConfirm={() => removeClient(confirmDelete)} />}
      {historiqueClient && <HistoriqueAchatsModal client={historiqueClient} onClose={() => setHistoriqueClient(null)} />}
    </div>
  );
}

function AnniversairesReport({ clients }) {
  const [moisFiltre, setMoisFiltre] = useState("Tous");
  const resultats = clients.filter((c) => moisFiltre === "Tous" || c.moisAnniv === moisFiltre).sort((a, b) => parseInt(a.jourAnniv, 10) - parseInt(b.jourAnniv, 10));
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <p className="text-sm" style={{ color: "#6B5D52" }}>Filtrer par mois :</p>
        <select value={moisFiltre} onChange={(e) => setMoisFiltre(e.target.value)} style={selectStyle}>
          <option>Tous</option>{MOIS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {resultats.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
            <div className="flex items-center gap-2">
              <Cake size={15} color="#8C3B2E" />
              <div>
                <span className="text-sm font-medium">{c.nomPrenoms}</span>
                <p className="text-xs" style={{ color: "#6B5D52" }}>{c.telephone || "Téléphone non renseigné"}</p>
              </div>
            </div>
            <span className="text-sm font-mono" style={{ color: "#6B5D52" }}>{c.jourAnniv} {c.moisAnniv}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlocFidelite({ clientId }) {
  const [info, setInfo] = useState(null);
  useEffect(() => { api.fidelite.client(clientId).then(setInfo).catch(() => {}); }, [clientId]);
  if (!info) return null;

  return (
    <div className="rounded-xl p-5 mb-5" style={{ background: "#FFFDF9", border: "1px solid #EAE1D2" }}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <p className="text-xs font-mono uppercase tracking-wide flex items-center gap-1.5" style={{ color: "#A8823D" }}>
          <Crown size={14} /> Fidélité Cendrillon
        </p>
        {info.statut && <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ background: "#FBF3E3", color: "#A8823D" }}>{info.statut}</span>}
      </div>
      <div className="grid sm:grid-cols-2 gap-3 text-sm mb-3">
        <div>
          <span style={{ color: "#6B5D52" }}>Cumul pour le prochain bonus : </span>
          <span className="font-mono font-semibold whitespace-nowrap">{fmt(info.cumulFideliteCourant)} F</span>
        </div>
        <div>
          <span style={{ color: "#6B5D52" }}>Volume total (statut) : </span>
          <span className="font-mono whitespace-nowrap">{fmt(info.cumulFideliteTotal)} F</span>
        </div>
      </div>
      {info.bonusDisponible > 0 && (
        <p className="text-sm font-medium mb-3" style={{ color: "#3F6B4A" }}>
          🎁 Bonus disponible : {fmt(info.bonusDisponible)} F (dès son prochain achat d'au moins ce montant)
        </p>
      )}
      {info.historique && info.historique.length > 0 && (
        <div className="pt-3" style={{ borderTop: "1px solid #EFE7D9" }}>
          <p className="text-xs mb-2" style={{ color: "#6B5D52" }}>Bonus déjà utilisés</p>
          <div className="space-y-1">
            {info.historique.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-xs">
                <span style={{ color: "#6B5D52" }}>{new Date(h.createdAt).toLocaleDateString("fr-FR")} · vente {h.vente?.numero}</span>
                <span className="font-mono" style={{ color: "#3F6B4A" }}>-{fmt(h.montant)} F</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoriqueAchatsView({ client }) {
  const achats = client?.ventes || [];
  const totalCumule = achats.reduce((s, v) => s + v.total, 0);
  const parBoutique = BOUTIQUES.map((b) => ({ boutique: b, total: achats.filter((v) => v.boutique === b).reduce((s, v) => s + v.total, 0), nb: achats.filter((v) => v.boutique === b).length }));

  return (
    <div>
      {FIDELITE_ACTIF && <BlocFidelite clientId={client.id} />}
      <div className="rounded-xl p-5 mb-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div><p className="font-display text-lg font-semibold">{client.nomPrenoms}</p><p className="text-xs font-mono" style={{ color: "#6B5D52" }}>{client.carteFidelite ? `Carte ${client.carteFidelite} · ` : ""}{client.code}</p></div>
          <div className="text-right"><p className="text-xs font-mono uppercase tracking-wide" style={{ color: "#8C3B2E" }}>Total cumulé</p><p className="font-display text-xl font-semibold">{fmt(totalCumule)} F</p></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-4 pt-4" style={{ borderTop: "1px solid #EFE7D9" }}>
          {parBoutique.map((pb) => (
            <div key={pb.boutique} className="flex items-center justify-between text-sm">
              <span style={{ color: "#6B5D52" }}>{pb.boutique} ({pb.nb} achat{pb.nb > 1 ? "s" : ""})</span>
              <span className="font-mono">{fmt(pb.total)} F</span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {achats.map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-lg px-4 py-3 flex-wrap gap-2" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
            <div><p className="font-mono text-sm font-medium">{v.numero}</p><p className="text-xs" style={{ color: "#6B5D52" }}>{new Date(v.date).toLocaleString("fr-FR")} · {v.boutique} · {v.modeVente}</p></div>
            <p className="font-display font-semibold" style={{ color: "#8C3B2E" }}>{fmt(v.total)} F</p>
          </div>
        ))}
        {achats.length === 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>Aucun achat enregistré pour ce client.</p>}
      </div>
    </div>
  );
}

function HistoriqueAchatsModal({ client, onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
      <div className="rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ background: "#FFFDF9" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg font-semibold">Historique des achats</p>
          <button onClick={onClose} style={{ color: "#6B5D52" }}><X size={18} /></button>
        </div>
        <HistoriqueAchatsView client={client} />
      </div>
    </div>
  );
}

function AchatsParCarteReport() {
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState([]);
  const [client, setClient] = useState(null);
  const [error, setError] = useState("");
  const [cherche, setCherche] = useState(false);

  const rechercher = async () => {
    if (!recherche.trim()) return;
    setCherche(true);
    setError("");
    setClient(null);
    try {
      const trouves = await api.clients.rechercheMulti(recherche.trim());
      if (trouves.length === 0) { setResultats([]); setError("Aucun client ne correspond à cette recherche."); return; }
      if (trouves.length === 1) {
        setResultats([]);
        setClient(await api.clients.historiqueAchats(trouves[0].id));
        return;
      }
      setResultats(trouves);
    } catch (e) { setError(e.message); }
  };

  const choisir = async (c) => {
    setError("");
    try {
      setClient(await api.clients.historiqueAchats(c.id));
      setResultats([]);
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "#6B5D52" }}>Recherchez un client par son nom, son numéro de téléphone ou sa carte de fidélité pour voir l'historique de ses achats (total cumulé, répartition par boutique, liste des ventes).</p>
      <div className="flex items-center gap-2 mb-6">
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rechercher()} placeholder="Nom, téléphone ou n° de carte de fidélité" style={{ ...inputStyle, marginTop: 0, maxWidth: "320px" }} />
        <button onClick={rechercher} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}><Search size={15} /> Rechercher</button>
      </div>
      {cherche && error && <p className="text-sm mb-4" style={{ color: "#B04A3B" }}>{error}</p>}
      {resultats.length > 0 && (
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
          <p className="text-xs px-4 py-2" style={{ color: "#6B5D52", background: "#F1E9DC" }}>{resultats.length} client(s) trouvé(s) — choisis-en un :</p>
          {resultats.map((c) => (
            <button key={c.id} onClick={() => choisir(c)} className="w-full text-left px-4 py-3 text-sm" style={{ borderTop: "1px solid #EFE7D9" }}>
              <span className="font-medium">{c.nomPrenoms}</span>
              <span style={{ color: "#6B5D52" }}> · {c.telephone || "—"}{c.carteFidelite ? ` · Carte ${c.carteFidelite}` : ""}{c.ville ? ` · ${c.ville}` : ""}</span>
            </button>
          ))}
        </div>
      )}
      {client && <HistoriqueAchatsView client={client} />}
    </div>
  );
}

function ClientModal({ client, onCancel, onSubmit }) {
  const [form, setForm] = useState(client);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const quartiersConnus = QUARTIERS_PAR_COMMUNE[form.commune] || [];
  const [quartierLibre, setQuartierLibre] = useState(form.quartier && !quartiersConnus.includes(form.quartier));

  const handleCommuneChange = (commune) => {
    set("commune", commune);
    const suivante = QUARTIERS_PAR_COMMUNE[commune] || [];
    if (!suivante.includes(form.quartier)) { set("quartier", ""); setQuartierLibre(false); }
  };
  const handleQuartierSelect = (val) => {
    if (val === "__autre__") { setQuartierLibre(true); set("quartier", ""); }
    else { setQuartierLibre(false); set("quartier", val); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
      <div className="rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ background: "#FFFDF9" }}>
        <div className="flex items-center justify-between mb-1">
          <p className="font-display text-lg font-semibold">Fiche renseignement des clients</p>
          <button onClick={onCancel}><X size={18} color="#6B5D52" /></button>
        </div>
        {!form.isNew && <p className="text-xs font-mono mb-3" style={{ color: "#6B5D52" }}>{form.code}</p>}
        <Field label="Noms et Prénoms"><input value={form.nomPrenoms} onChange={(e) => set("nomPrenoms", e.target.value)} style={inputStyle} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Jour anniversaire"><select value={form.jourAnniv} onChange={(e) => set("jourAnniv", e.target.value)} style={inputStyle}>{JOURS.map((j) => <option key={j}>{j}</option>)}</select></Field>
          <Field label="Mois"><select value={form.moisAnniv} onChange={(e) => set("moisAnniv", e.target.value)} style={inputStyle}>{MOIS.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Civilité"><select value={form.civilite} onChange={(e) => set("civilite", e.target.value)} style={inputStyle}>{CIVILITES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <Field label="Adresse"><input value={form.adresse} onChange={(e) => set("adresse", e.target.value)} style={inputStyle} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ville"><input value={form.ville} onChange={(e) => set("ville", e.target.value)} style={inputStyle} placeholder="Ex : Abidjan, Cotonou, Paris…" /></Field>
          <Field label="Commune"><select value={form.commune} onChange={(e) => handleCommuneChange(e.target.value)} style={inputStyle}>{COMMUNES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <Field label="Quartier">
          {quartierLibre || quartiersConnus.length === 0 ? (
            <input value={form.quartier} onChange={(e) => set("quartier", e.target.value)} style={inputStyle} />
          ) : (
            <select value={form.quartier} onChange={(e) => handleQuartierSelect(e.target.value)} style={inputStyle}>
              <option value="">— Choisir —</option>{quartiersConnus.map((q) => <option key={q} value={q}>{q}</option>)}<option value="__autre__">Autre (préciser)</option>
            </select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone *"><input value={form.telephone} onChange={(e) => set("telephone", e.target.value)} style={inputStyle} /></Field>
          <Field label="Whatsapp"><input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} style={inputStyle} /></Field>
        </div>
        <p className="text-xs mb-3" style={{ color: "#6B5D52" }}>
          {PAYS_INDICATIF[form.pays]
            ? `Indicatif ${form.pays} : +${PAYS_INDICATIF[form.pays].code} — à saisir sans le "+", juste le numéro local ci-dessus.`
            : "Pays sans indicatif connu — le bouton WhatsApp du reçu ne pourra pas être proposé pour cette cliente."}
        </p>
        {form.pays === "Côte d'Ivoire" && form.telephone && (form.telephone.replace(/\D/g, "").length !== 10) && (
          <p className="text-xs mb-3 px-2 py-1.5 rounded-lg" style={{ background: "#FBEAE7", color: "#B04A3B" }}>
            ⚠ Ce numéro ne fait pas 10 chiffres — inhabituel pour la Côte d'Ivoire. Vérifie qu'il n'appartient pas à un autre pays (le champ "Pays" ci-dessous serait alors à changer).
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Taille/Pointure"><select value={form.pointure} onChange={(e) => set("pointure", e.target.value)} style={inputStyle}><option value="">—</option>{CLIENT_POINTURES.map((p) => <option key={p} value={p}>T{p}</option>)}</select></Field>
          <Field label="Pays"><select value={form.pays} onChange={(e) => set("pays", e.target.value)} style={inputStyle}>{PAYS_LIST.map((p) => <option key={p}>{p}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Carte de Fidélité"><input value={form.carteFidelite} onChange={(e) => set("carteFidelite", e.target.value)} style={inputStyle} /></Field>
          <Field label="Date de Délivrance"><input type="date" value={form.dateDelivrance} onChange={(e) => set("dateDelivrance", e.target.value)} style={inputStyle} /></Field>
        </div>
        <Field label="Observation"><input value={form.observation} onChange={(e) => set("observation", e.target.value)} style={inputStyle} /></Field>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm" style={{ color: "#6B5D52" }}>Fermer</button>
          <button onClick={() => onSubmit(form)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}