import { useState, useEffect, useCallback } from "react";
import { Plus, X, Search, Printer, Truck, CheckCircle2, RotateCcw, AlertTriangle } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { BOUTIQUES, POINTURES, CLIENT_POINTURES, MODES_PAIEMENT, fmt } from "../constants.js";
import { Field, ErrorBanner, inputStyle, selectStyle } from "../components/Shared.jsx";
import { ReceiptModal } from "./VentesSection.jsx";

function uid() { return `tmp_${Date.now()}_${Math.floor(Math.random() * 10000)}`; }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function dateDecalee(jours) {
  const d = new Date();
  d.setDate(d.getDate() + jours);
  return d.toISOString().slice(0, 10);
}
function debutDuMoisISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function LivraisonSection() {
  const { user } = useAuth();
  const estAdmin = !!user?.role?.systeme;
  const [subTab, setSubTab] = useState("nouveau");
  const [articles, setArticles] = useState([]);
  const [clients, setClients] = useState([]);
  const [bonsEnCours, setBonsEnCours] = useState([]);
  const [bonsHistorique, setBonsHistorique] = useState([]);
  const [error, setError] = useState("");
  const [ticketAImprimer, setTicketAImprimer] = useState(null);
  const [bonAReconcilier, setBonAReconcilier] = useState(null);
  const [receiptVente, setReceiptVente] = useState(null);
  const [info, setInfo] = useState("");

  const boutiqueDefaut = estAdmin ? "" : (user?.boutique || "");

  useEffect(() => {
    api.articles.list().then(setArticles).catch((e) => setError(e.message));
    api.clients.list().then(setClients).catch((e) => setError(e.message));
  }, []);

  const [histDateDebut, setHistDateDebut] = useState("");
  const [histDateFin, setHistDateFin] = useState("");
  const [filtreBoutique, setFiltreBoutique] = useState(""); // "" = toutes, réservé à l'admin
  const [rechercheEnCours, setRechercheEnCours] = useState("");
  const bonsEnCoursFiltres = bonsEnCours.filter((b) => {
    if (!rechercheEnCours.trim()) return true;
    const q = rechercheEnCours.trim().toLowerCase();
    return (b.lieuLivraison || "").toLowerCase().includes(q) || b.clientNom.toLowerCase().includes(q) || (b.clientTelephone || "").includes(q);
  });

  const charger = useCallback(async () => {
    try {
      const boutiqueParam = estAdmin ? (filtreBoutique || undefined) : undefined;
      const [enCours, historique] = await Promise.all([
        api.bonsLivraison.lister({ statut: "EN_COURS", boutique: boutiqueParam }),
        api.bonsLivraison.lister({ dateDebut: histDateDebut || undefined, dateFin: histDateFin || undefined, boutique: boutiqueParam }),
      ]);
      setBonsEnCours(enCours);
      setBonsHistorique(historique.filter((b) => b.statut !== "EN_COURS"));
    } catch (e) { setError(e.message); }
  }, [histDateDebut, histDateFin, filtreBoutique, estAdmin]);
  useEffect(() => { charger(); }, [charger]);

  return (
    <div>
      <ErrorBanner error={error} onClose={() => setError("")} />
      {info && (
        <p className="text-sm mb-4 px-3 py-2 rounded-lg flex items-center justify-between" style={{ background: "#FBEAE7", color: "#B04A3B" }}>
          {info}
          <button onClick={() => setInfo("")} className="ml-3" style={{ color: "#B04A3B" }}><X size={14} /></button>
        </p>
      )}
      <div className="flex gap-2 mb-4 items-center flex-wrap">
        {[["nouveau", "Nouveau bon"], ["encours", `En cours (${bonsEnCours.length})`], ["historique", "Historique"]].map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)} className="px-4 py-2 rounded-full text-sm font-medium" style={subTab === id ? { background: "#2B2320", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52", border: "1px solid #DDD3C4" }}>{label}</button>
        ))}
        {estAdmin && (subTab === "encours" || subTab === "historique") && (
          <select value={filtreBoutique} onChange={(e) => setFiltreBoutique(e.target.value)} style={{ ...selectStyle, marginLeft: "8px" }}>
            <option value="">Les deux boutiques</option>
            {BOUTIQUES.map((b) => <option key={b} value={b}>{b} uniquement</option>)}
          </select>
        )}
      </div>

      {subTab === "nouveau" && (
        <NouveauBonForm
          articles={articles} boutiqueDefaut={boutiqueDefaut} clients={clients}
          onCree={(bon) => { setTicketAImprimer(bon); charger(); }}
          onClientCree={(client) => setClients((prev) => [...prev, client])}
          onError={setError}
        />
      )}

      {subTab === "encours" && (
        <div className="space-y-3">
          {bonsEnCours.length > 0 && (
            <div className="relative max-w-md mb-2">
              <input value={rechercheEnCours} onChange={(e) => setRechercheEnCours(e.target.value)} placeholder="Rechercher par lieu, nom ou téléphone…" style={{ ...selectStyle, paddingLeft: "32px", width: "100%" }} />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#6B5D52" />
            </div>
          )}
          {bonsEnCours.length === 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>Aucun bon de livraison en cours.</p>}
          {bonsEnCoursFiltres.length === 0 && bonsEnCours.length > 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>Aucune livraison ne correspond à cette recherche.</p>}
          {bonsEnCoursFiltres.map((b) => (
            <div key={b.id} className="rounded-xl p-4" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-medium text-sm">{b.numero} — {b.clientNom} {b.clientTelephone ? `(${b.clientTelephone})` : ""}</p>
                  {b.lieuLivraison && <p className="text-xs mt-0.5 font-medium" style={{ color: "#8C3B2E" }}>📍 {b.lieuLivraison}</p>}
                  <p className="text-xs mt-1" style={{ color: "#6B5D52" }}>{b.boutique} · livreur : {b.livreurNom || "—"} · parti le {new Date(b.dateCreation).toLocaleString("fr-FR")}</p>
                  <p className="text-xs mt-1" style={{ color: "#6B5D52" }}>{[...b.lignes.map((l) => `${l.article.designation}${l.pointure ? ` T${l.pointure}` : ""} x${l.quantite}`), ...(b.cartesLignes || []).map((c) => `Carte ${c.bonValeur.numero} (${fmt(c.bonValeur.montant)} F)`)].join(", ")}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setTicketAImprimer(b)} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: "1px solid #DDD3C4", color: "#6B5D52" }}>Réimprimer</button>
                  <button onClick={() => setBonAReconcilier(b)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Retour du livreur</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === "historique" && (
        <div className="space-y-3">
          <div className="rounded-xl p-4 mb-2" style={{ background: "#FAF7F2", border: "1px solid #EFE7D9" }}>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {[
                ["Aujourd'hui", () => { const j = todayISO(); setHistDateDebut(j); setHistDateFin(j); }],
                ["Hier", () => { const j = dateDecalee(-1); setHistDateDebut(j); setHistDateFin(j); }],
                ["7 derniers jours", () => { setHistDateDebut(dateDecalee(-6)); setHistDateFin(todayISO()); }],
                ["Ce mois-ci", () => { setHistDateDebut(debutDuMoisISO()); setHistDateFin(todayISO()); }],
                ["Tout", () => { setHistDateDebut(""); setHistDateFin(""); }],
              ].map(([label, action]) => (
                <button key={label} onClick={action} className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ border: "1px solid #DDD3C4", color: "#6B5D52" }}>{label}</button>
              ))}
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Du</label>
                <input type="date" value={histDateDebut} onChange={(e) => setHistDateDebut(e.target.value)} style={selectStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Au</label>
                <input type="date" value={histDateFin} onChange={(e) => setHistDateFin(e.target.value)} style={selectStyle} />
              </div>
            </div>
          </div>
          {bonsHistorique.length > 0 && (
            <div className="flex items-center gap-6 px-1 mb-1">
              <div>
                <p className="text-xs" style={{ color: "#6B5D52" }}>Livraisons clôturées sur cette période</p>
                <p className="font-display text-lg font-semibold">{bonsHistorique.length}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "#6B5D52" }}>Montant total généré</p>
                <p className="font-display text-lg font-semibold" style={{ color: "#8C3B2E" }}>{fmt(bonsHistorique.reduce((s, b) => s + (b.venteGeneree?.total || 0), 0))} F</p>
              </div>
            </div>
          )}
          {bonsHistorique.length === 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>Aucun bon clôturé sur cette période.</p>}
          {bonsHistorique.map((b) => (
            <div key={b.id} className="rounded-xl p-4" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-medium text-sm">{b.numero} — {b.clientNom}</p>
                  {b.lieuLivraison && <p className="text-xs" style={{ color: "#8C3B2E" }}>📍 {b.lieuLivraison}</p>}
                  <p className="text-xs" style={{ color: "#6B5D52" }}>
                    {b.boutique} · {b.statut === "ANNULE" ? "Annulé" : `Clôturé le ${new Date(b.dateCloture).toLocaleString("fr-FR")} par ${b.cloturePar?.prenom || ""}`}
                    {b.venteGeneree ? ` · Vente ${b.venteGeneree.numero} (${fmt(b.venteGeneree.total)} F)` : ""}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={b.statut === "ANNULE" ? { background: "#FBEAE7", color: "#B04A3B" } : { background: "#E9F0EA", color: "#3F6B4A" }}>
                  {b.statut === "ANNULE" ? "Annulé" : "Clôturé"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {ticketAImprimer && <BonLivraisonTicket bon={ticketAImprimer} onClose={() => setTicketAImprimer(null)} />}
      {bonAReconcilier && (
        <ReconciliationModal
          bon={bonAReconcilier} clients={clients}
          onClose={() => setBonAReconcilier(null)}
          onCloture={(res) => {
            setBonAReconcilier(null); charger();
            if (res.vente) setReceiptVente(res.vente);
            if (res.avanceARembourser > 0) setInfo(`⚠ Aucun article n'a finalement été vendu, mais une avance de ${fmt(res.avanceARembourser)} F avait été perçue au départ — pense à la rembourser à la cliente.`);
            else setInfo("");
          }}
          onError={setError}
        />
      )}
      {receiptVente && <ReceiptModal vente={receiptVente} onClose={() => setReceiptVente(null)} />}
    </div>
  );
}

// ------------------------------------------------------------
// NOUVEAU BON — départ du livreur : ce qui sort décrémente le stock tout de suite.
// ------------------------------------------------------------
function NouveauBonForm({ articles, boutiqueDefaut, clients, onCree, onError, onClientCree }) {
  const [boutique, setBoutique] = useState(boutiqueDefaut);
  const [clientId, setClientId] = useState("");
  const [clientNom, setClientNom] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [lieuLivraison, setLieuLivraison] = useState("");
  const [livreurNom, setLivreurNom] = useState("");
  const [notes, setNotes] = useState("");

  const [rechercheClient, setRechercheClient] = useState("");

  const [rechercheArticle, setRechercheArticle] = useState("");
  const [articleChoisi, setArticleChoisi] = useState(null);
  const [pointureChoisie, setPointureChoisie] = useState("");
  const [quantiteChoisie, setQuantiteChoisie] = useState("1");
  const [lignes, setLignes] = useState([]);
  const [rechercheCarte, setRechercheCarte] = useState("");
  const [cartesCadeaux, setCartesCadeaux] = useState([]); // { numero, montant }
  const [carteEnCours, setCarteEnCours] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [avance, setAvance] = useState("");
  const [avanceModePaiement, setAvanceModePaiement] = useState("especes");
  const [avanceOuvert, setAvanceOuvert] = useState(false);
  const [notesOuvert, setNotesOuvert] = useState(false);

  const resultatsClients = rechercheClient.trim()
    ? (clients || []).filter((c) => c.nomPrenoms.toLowerCase().includes(rechercheClient.trim().toLowerCase()) || (c.telephone || "").includes(rechercheClient.trim())).slice(0, 8)
    : [];
  const choisirClient = (c) => { setClientId(c.id); setClientNom(c.nomPrenoms); setClientTelephone(c.telephone || ""); setRechercheClient(""); };
  const retirerClient = () => { setClientId(""); setClientNom(""); setClientTelephone(""); };

  const resultatsRecherche = rechercheArticle.trim()
    ? (articles || []).filter((a) => a.actif !== false && (a.designation.toLowerCase().includes(rechercheArticle.trim().toLowerCase()) || a.reference.toLowerCase().includes(rechercheArticle.trim().toLowerCase()))).slice(0, 8)
    : [];

  const choisirArticle = (a) => { setArticleChoisi(a); setRechercheArticle(""); setPointureChoisie(""); setQuantiteChoisie("1"); };

  const ajouterLigne = () => {
    if (!articleChoisi) { onError("Choisis un article."); return; }
    if (articleChoisi.famille === "Chaussure" && !pointureChoisie) { onError("Choisis une pointure."); return; }
    const quantite = parseInt(quantiteChoisie, 10);
    if (!quantite || quantite <= 0) { onError("Indique une quantité valide."); return; }
    setLignes([...lignes, { id: uid(), articleId: articleChoisi.id, designation: articleChoisi.designation, pointure: articleChoisi.famille === "Chaussure" ? pointureChoisie : "", quantite, prixVente: articleChoisi.prixVente }]);
    setArticleChoisi(null); setPointureChoisie(""); setQuantiteChoisie("1");
  };
  const retirerLigne = (id) => setLignes(lignes.filter((l) => l.id !== id));

  const ajouterCarte = async () => {
    const numero = rechercheCarte.trim();
    if (!numero) return;
    if (!boutique) { onError("Choisis d'abord la boutique concernée."); return; }
    if (cartesCadeaux.some((c) => c.numero === numero)) { onError("Cette carte est déjà ajoutée."); return; }
    setCarteEnCours(true);
    try {
      const res = await api.denominationsCartesCadeaux.verifierCarte(numero, boutique);
      setCartesCadeaux([...cartesCadeaux, { numero, montant: res.montant }]);
      setRechercheCarte("");
    } catch (e) { onError(e.message); } finally { setCarteEnCours(false); }
  };
  const retirerCarte = (numero) => setCartesCadeaux(cartesCadeaux.filter((c) => c.numero !== numero));

  const valider = async () => {
    if (!boutique) { onError("Choisis la boutique concernée."); return; }
    if (!clientTelephone.trim()) { onError("Le numéro de téléphone de la cliente est obligatoire."); return; }
    if (!livreurNom.trim()) { onError("Le nom du livreur est obligatoire."); return; }
    if (lignes.length === 0 && cartesCadeaux.length === 0) { onError("Ajoute au moins un article ou une carte cadeau au bon de livraison."); return; }
    const avanceNum = Number(avance) || 0;
    if (avanceNum > 0 && !avanceModePaiement) { onError("Choisis le mode de paiement de l'avance."); return; }
    setEnvoiEnCours(true);
    try {
      const bon = await api.bonsLivraison.creer({
        boutique, clientNom: clientNom.trim() || "Cliente", clientTelephone: clientTelephone.trim(), clientId: clientId || undefined,
        lieuLivraison: lieuLivraison.trim() || undefined, livreurNom: livreurNom.trim(), notes: notes || undefined,
        avance: avanceNum, avanceModePaiement: avanceNum > 0 ? avanceModePaiement : undefined,
        lignes: lignes.map(({ articleId, pointure, quantite }) => ({ articleId, pointure, quantite })),
        cartesCadeaux: cartesCadeaux.map(({ numero }) => ({ numero })),
      });
      onCree(bon);
      retirerClient(); setLieuLivraison(""); setLivreurNom(""); setNotes(""); setLignes([]); setCartesCadeaux([]); setAvance(""); setAvanceModePaiement("especes"); setAvanceOuvert(false); setNotesOuvert(false);
    } catch (e) { onError(e.message); } finally { setEnvoiEnCours(false); }
  };

  const champ = { ...selectStyle, width: "100%" };
  const nbArticles = lignes.reduce((s, l) => s + l.quantite, 0);
  const peutValider = lignes.length > 0 || cartesCadeaux.length > 0;
  const avanceVisible = avanceOuvert || Number(avance) > 0;
  const notesVisible = notesOuvert || notes.trim() !== "";
  const lienStyle = { color: "#8C3B2E" };

  return (
    <div className="rounded-2xl p-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
      <p className="font-display text-lg font-semibold mb-1">Nouveau bon de livraison</p>
      <p className="text-xs mb-4" style={{ color: "#6B5D52" }}>Le stock est retiré dès l'enregistrement — c'est le départ du livreur qui est noté ici, pas encore une vente.</p>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* ---------- Colonne gauche : livraison + cliente ---------- */}
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Boutique</label>
              <select value={boutique} onChange={(e) => setBoutique(e.target.value)} style={champ}>
                <option value="">— Choisir —</option>
                {BOUTIQUES.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Livreur</label>
              <input value={livreurNom} onChange={(e) => setLivreurNom(e.target.value)} style={champ} placeholder="Nom du livreur" />
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: "#FAF7F2", border: "1px solid #EFE7D9" }}>
            <p className="text-sm font-medium mb-3">Cliente</p>

            <div className="relative">
              <input value={rechercheClient} onChange={(e) => setRechercheClient(e.target.value)} placeholder="Rechercher une fiche existante pour remplir automatiquement…" style={{ ...champ, paddingLeft: "32px" }} />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#6B5D52" />
              {resultatsClients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2", maxHeight: "220px", overflowY: "auto" }}>
                  {resultatsClients.map((c) => (
                    <button key={c.id} type="button" onClick={() => choisirClient(c)} className="w-full text-left px-3 py-2 text-sm" style={{ borderTop: "1px solid #EFE7D9" }}>
                      {c.nomPrenoms} <span style={{ color: "#6B5D52" }}>{c.telephone ? `· ${c.telephone}` : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {clientId && (
              <p className="text-xs mt-2 flex items-center gap-2" style={{ color: "#3F6B4A" }}>
                ✓ Rattachée à une fiche existante
                <button onClick={() => setClientId("")} style={{ color: "#B04A3B" }}><X size={12} /></button>
              </p>
            )}

            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Téléphone</label>
                <input value={clientTelephone} onChange={(e) => setClientTelephone(e.target.value)} style={champ} placeholder="Ex : 0708735901" />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Nom (optionnel)</label>
                <input value={clientNom} onChange={(e) => setClientNom(e.target.value)} style={champ} placeholder="Si connu" />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Lieu de livraison (quartier, adresse…)</label>
              <input value={lieuLivraison} onChange={(e) => setLieuLivraison(e.target.value)} style={champ} placeholder="Ex : Angré 8e Tranche, Cocody Riviera…" />
              <p className="text-xs mt-1" style={{ color: "#6B5D52" }}>Aide à retrouver la bonne livraison au retour du livreur.</p>
            </div>
          </div>
        </div>

        {/* ---------- Colonne droite : ce que le livreur emporte ---------- */}
        <div className="rounded-xl p-4" style={{ background: "#FAF7F2", border: "1px solid #EFE7D9" }}>
          <p className="text-sm font-medium mb-3">Ce que le livreur emporte</p>

          <p className="text-xs font-medium mb-1" style={{ color: "#6B5D52" }}>Articles</p>
          <div className="relative mb-3">
            <input value={rechercheArticle} onChange={(e) => { setRechercheArticle(e.target.value); setArticleChoisi(null); }} placeholder="Rechercher par désignation ou référence…" style={{ ...champ, paddingLeft: "32px" }} />
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#6B5D52" />
            {resultatsRecherche.length > 0 && (
              <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2", maxHeight: "220px", overflowY: "auto" }}>
                {resultatsRecherche.map((a) => (
                  <button key={a.id} type="button" onClick={() => choisirArticle(a)} className="w-full text-left px-3 py-2 text-sm" style={{ borderTop: "1px solid #EFE7D9" }}>
                    {a.designation} <span style={{ color: "#6B5D52" }}>({a.reference})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {articleChoisi && (
            <div className="mb-3 space-y-2">
              <div><p className="text-xs mb-0.5" style={{ color: "#6B5D52" }}>Article choisi</p><p className="text-sm font-medium">{articleChoisi.designation}</p></div>
              <div className="flex gap-3 items-end flex-wrap">
                {articleChoisi.famille === "Chaussure" && (
                  <div style={{ width: "110px" }}>
                    <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Pointure</label>
                    <select value={pointureChoisie} onChange={(e) => setPointureChoisie(e.target.value)} style={champ}>
                      <option value="">—</option>
                      {POINTURES.map((p) => <option key={p} value={p}>T{p}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ width: "100px" }}>
                  <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Quantité</label>
                  <input type="number" min="1" value={quantiteChoisie} onChange={(e) => setQuantiteChoisie(e.target.value)} style={champ} />
                </div>
                <button onClick={ajouterLigne} className="px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Ajouter</button>
              </div>
            </div>
          )}

          {lignes.length > 0 && (
            <div className="rounded-xl overflow-hidden mb-3" style={{ border: "1px solid #EAE1D2", background: "#FFFFFF" }}>
              <table className="w-full text-sm">
                <thead><tr style={{ background: "#F1E9DC", color: "#6B5D52" }}><th className="text-left px-3 py-2">Article</th><th className="text-left px-3 py-2">Pointure</th><th className="text-right px-3 py-2">Quantité</th><th></th></tr></thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.id} style={{ borderTop: "1px solid #EFE7D9" }}>
                      <td className="px-3 py-2">{l.designation}</td>
                      <td className="px-3 py-2">{l.pointure ? `T${l.pointure}` : "—"}</td>
                      <td className="text-right px-3 py-2">{l.quantite}</td>
                      <td className="text-right px-3 py-2"><button onClick={() => retirerLigne(l.id)} style={{ color: "#B04A3B" }}><X size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "1px solid #EAE1D2" }}>
                    <td colSpan={3} className="text-right px-3 py-2 text-sm font-medium">Valeur totale des articles emportés</td>
                    <td className="text-right px-3 py-2 text-sm font-semibold" style={{ color: "#8C3B2E" }}>{fmt(lignes.reduce((s, l) => s + l.prixVente * l.quantite, 0))} F</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="pt-3" style={{ borderTop: "1px solid #EFE7D9" }}>
            <p className="text-xs font-medium mb-1" style={{ color: "#6B5D52" }}>Cartes cadeaux (optionnel)</p>
            <div className="flex gap-2">
              <input value={rechercheCarte} onChange={(e) => setRechercheCarte(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ajouterCarte()} placeholder="Numéro de la carte…" style={{ ...champ, flex: 1, minWidth: 0 }} />
              <button onClick={ajouterCarte} disabled={carteEnCours} className="px-4 rounded-lg text-sm font-medium whitespace-nowrap" style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: carteEnCours ? 0.6 : 1 }}>{carteEnCours ? "..." : "Ajouter"}</button>
            </div>
            {cartesCadeaux.length > 0 && (
              <div className="rounded-xl overflow-hidden mt-2" style={{ border: "1px solid #EAE1D2", background: "#FFFFFF" }}>
                {cartesCadeaux.map((c) => (
                  <div key={c.numero} className="flex items-center justify-between px-3 py-2" style={{ borderTop: "1px solid #EFE7D9" }}>
                    <span className="text-sm">Carte {c.numero}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{fmt(c.montant)} F</span>
                      <button onClick={() => retirerCarte(c.numero)} style={{ color: "#B04A3B" }}><X size={14} /></button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2" style={{ background: "#F1E9DC" }}>
                  <span className="text-sm font-medium">Valeur totale des cartes emportées</span>
                  <span className="text-sm font-semibold" style={{ color: "#8C3B2E" }}>{fmt(cartesCadeaux.reduce((s, c) => s + c.montant, 0))} F</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Avance et notes : repliés tant qu'ils sont vides ---------- */}
      <div className="mt-4">
        {(!avanceVisible || !notesVisible) && (
          <div className="flex gap-5 flex-wrap">
            {!avanceVisible && <button type="button" onClick={() => setAvanceOuvert(true)} className="text-sm font-medium" style={lienStyle}>+ Avance déjà perçue de la cliente</button>}
            {!notesVisible && <button type="button" onClick={() => setNotesOuvert(true)} className="text-sm font-medium" style={lienStyle}>+ Ajouter une note</button>}
          </div>
        )}

        {(avanceVisible || notesVisible) && (
          <div className="grid lg:grid-cols-2 gap-4 items-start" style={{ marginTop: !avanceVisible || !notesVisible ? "12px" : 0 }}>
            {avanceVisible && (
              <div className="rounded-xl p-4" style={{ background: "#FAF7F2", border: "1px solid #EFE7D9" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">Avance déjà perçue de la cliente <span className="font-normal" style={{ color: "#6B5D52" }}>(optionnel)</span></p>
                  {Number(avance) === 0 && <button type="button" onClick={() => setAvanceOuvert(false)} className="text-xs" style={{ color: "#6B5D52" }}>Masquer</button>}
                </div>
                <p className="text-xs mb-3" style={{ color: "#6B5D52" }}>Elle apparaîtra sur le ticket et sera déduite du reste à payer au retour.</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Montant de l'avance</label>
                    <input type="number" min="0" value={avance} onChange={(e) => setAvance(e.target.value)} style={champ} placeholder="0" />
                  </div>
                  {Number(avance) > 0 && (
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Mode de paiement de l'avance</label>
                      <select value={avanceModePaiement} onChange={(e) => setAvanceModePaiement(e.target.value)} style={champ}>
                        {MODES_PAIEMENT.filter((m) => m.id !== "bon_achat" && m.id !== "avoir").map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                {Number(avance) > 0 && lignes.length > 0 && (
                  <p className="text-xs mt-3" style={{ color: "#3F6B4A" }}>
                    Reste à payer si la cliente garde tout : {fmt(Math.max(0, lignes.reduce((s, l) => s + l.prixVente * l.quantite, 0) - Number(avance)))} F
                  </p>
                )}
              </div>
            )}

            {notesVisible && (
              <div className="rounded-xl p-4" style={{ background: "#FAF7F2", border: "1px solid #EFE7D9" }}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">Notes <span className="font-normal" style={{ color: "#6B5D52" }}>(optionnel)</span></label>
                  {notes.trim() === "" && <button type="button" onClick={() => setNotesOuvert(false)} className="text-xs" style={{ color: "#6B5D52" }}>Masquer</button>}
                </div>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} style={champ} placeholder="Ex : livraison prévue avant 18h" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------- Barre fixe en bas : récapitulatif + bouton d'enregistrement ---------- */}
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 px-5 py-3 rounded-b-2xl flex items-center justify-between flex-wrap gap-3" style={{ background: "#FFFFFF", borderTop: "1px solid #EAE1D2", boxShadow: "0 -4px 12px rgba(43,35,32,0.06)" }}>
        <p className="text-sm" style={{ color: "#6B5D52" }}>
          <span className="font-medium" style={{ color: "#2B2320" }}>{nbArticles}</span> article{nbArticles > 1 ? "s" : ""}
          {" · "}<span className="font-medium" style={{ color: "#2B2320" }}>{cartesCadeaux.length}</span> carte{cartesCadeaux.length > 1 ? "s" : ""} cadeau
          {Number(avance) > 0 && <>{" · "}avance <span className="font-medium" style={{ color: "#2B2320" }}>{fmt(Number(avance))} F</span></>}
        </p>
        <button onClick={valider} disabled={envoiEnCours || !peutValider} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: envoiEnCours || !peutValider ? 0.6 : 1 }}>
          <Truck size={16} /> {envoiEnCours ? "Enregistrement..." : "Enregistrer le départ et imprimer le bon"}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// TICKET IMPRIMABLE — deux exemplaires : copie livreur (à signer) + copie boutique.
// ------------------------------------------------------------
function BonLivraisonTicket({ bon, onClose }) {
  const totalArticles = bon.lignes.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0) + (bon.cartesLignes || []).reduce((s, c) => s + c.bonValeur.montant, 0);
  const reste = Math.max(0, totalArticles - (bon.avance || 0));
  const corps = (mention) => (
    <div style={{ width: "280px", background: "#FFFFFF", padding: "16px", fontFamily: "monospace", fontSize: "12px", color: "#2B2320" }}>
      <p className="text-center font-bold mb-1">BON DE LIVRAISON</p>
      <p className="text-center mb-2">{bon.numero}</p>
      <p style={{ borderTop: "1px dashed #999", paddingTop: "6px" }}>{bon.boutique}</p>
      <p>Client : {bon.clientNom}</p>
      {bon.clientTelephone && <p>Tél : {bon.clientTelephone}</p>}
      {bon.lieuLivraison && <p>Lieu : {bon.lieuLivraison}</p>}
      <p>Livreur : {bon.livreurNom || "—"}</p>
      <p>Date : {new Date(bon.dateCreation).toLocaleString("fr-FR")}</p>
      <div style={{ borderTop: "1px dashed #999", marginTop: "6px", paddingTop: "6px" }}>
        {bon.lignes.map((l) => (
          <p key={l.id}>- {l.article?.designation || l.designation}{l.pointure ? ` T${l.pointure}` : ""} x{l.quantite} ({fmt(l.prixUnitaire)} F/u)</p>
        ))}
        {(bon.cartesLignes || []).map((c) => (
          <p key={c.id}>- Carte cadeau {c.bonValeur.numero} ({fmt(c.bonValeur.montant)} F)</p>
        ))}
      </div>
      <div style={{ borderTop: "1px dashed #999", marginTop: "6px", paddingTop: "6px" }}>
        <p>Valeur totale : {fmt(totalArticles)} F</p>
        {bon.avance > 0 && (
          <>
            <p>Avance perçue ({bon.avanceModePaiement}) : -{fmt(bon.avance)} F</p>
            <p style={{ fontWeight: "bold" }}>Reste à payer si tout est gardé : {fmt(reste)} F</p>
          </>
        )}
      </div>
      {bon.notes && <p style={{ borderTop: "1px dashed #999", marginTop: "6px", paddingTop: "6px" }}>Note : {bon.notes}</p>}
      <p className="text-center font-bold mt-4" style={{ borderTop: "2px solid #2B2320", paddingTop: "6px" }}>{mention}</p>
      {mention.includes("LIVREUR") && (
        <p className="mt-6" style={{ borderTop: "1px solid #999", paddingTop: "4px" }}>Signature du livreur : ____________________</p>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
      <div className="print-area rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: "#FFFDF9" }}>
        <div className="no-print flex items-center justify-between mb-4">
          <p className="font-display text-lg font-semibold">Bon {bon.numero}</p>
          <button onClick={onClose} style={{ color: "#6B5D52" }}><X size={18} /></button>
        </div>
        <div>
          {corps("COPIE LIVREUR — À SIGNER")}
          <div style={{ borderTop: "2px dashed #999", margin: "16px 0" }} />
          {corps("COPIE BOUTIQUE")}
        </div>
        <button onClick={() => window.print()} className="no-print w-full mt-5 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>
          <Printer size={15} /> Imprimer les 2 exemplaires
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// RÉCONCILIATION — retour du livreur : chaque ligne devient Vendu / Retourné / Perdu.
// ------------------------------------------------------------
function ReconciliationModal({ bon, clients, onClose, onCloture, onError }) {
  const [statuts, setStatuts] = useState(Object.fromEntries(bon.lignes.map((l) => [l.id, "VENDU"])));
  const [statutsCartes, setStatutsCartes] = useState(Object.fromEntries((bon.cartesLignes || []).map((c) => [c.id, "VENDU"])));
  const [clientId, setClientId] = useState(bon.clientId || "");
  const [typeVente, setTypeVente] = useState("Comptant");
  const [paiements, setPaiements] = useState([{ id: uid(), mode: "especes", montant: "" }]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const lignesVendues = bon.lignes.filter((l) => statuts[l.id] === "VENDU");
  const cartesVendues = (bon.cartesLignes || []).filter((c) => statutsCartes[c.id] === "VENDU");
  const totalVendu = lignesVendues.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0) + cartesVendues.reduce((s, c) => s + c.bonValeur.montant, 0);
  const totalPayeSaisi = paiements.reduce((s, p) => s + (Number(p.montant) || 0), 0);
  const totalPaye = totalPayeSaisi + (bon.avance || 0);
  const resteAPercevoir = Math.max(0, totalVendu - (bon.avance || 0));

  const ajouterPaiement = () => setPaiements([...paiements, { id: uid(), mode: "especes", montant: "" }]);
  const majPaiement = (id, champ, val) => setPaiements(paiements.map((p) => (p.id === id ? { ...p, [champ]: val } : p)));
  const retirerPaiement = (id) => setPaiements(paiements.filter((p) => p.id !== id));

  const cloturer = async () => {
    if (lignesVendues.length > 0 || cartesVendues.length > 0) {
      if (typeVente === "Comptant" && totalPaye < totalVendu) { onError(`Le total payé (avance comprise) est inférieur au total des articles et cartes vendus. Il manque ${fmt(totalVendu - totalPaye)} F.`); return; }
      if (typeVente === "Credit" && totalPaye > totalVendu) { onError("Le montant payé (avance comprise) ne peut pas dépasser le total pour une vente à crédit."); return; }
    }
    setEnvoiEnCours(true);
    try {
      const res = await api.bonsLivraison.cloturer(bon.id, {
        clientId: clientId || undefined, typeVente,
        paiements: (lignesVendues.length > 0 || cartesVendues.length > 0) ? paiements.filter((p) => Number(p.montant) > 0).map((p) => ({ mode: p.mode, montant: Number(p.montant) })) : [],
        lignes: bon.lignes.map((l) => ({ ligneId: l.id, statut: statuts[l.id] })),
        cartes: (bon.cartesLignes || []).map((c) => ({ ligneCarteId: c.id, statut: statutsCartes[c.id] })),
      });
      onCloture(res);
    } catch (e) { onError(e.message); } finally { setEnvoiEnCours(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
      <div className="rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ background: "#FFFDF9" }}>
        <div className="flex items-center justify-between mb-1">
          <p className="font-display text-lg font-semibold">Retour du livreur — {bon.numero}</p>
          <button onClick={onClose} style={{ color: "#6B5D52" }}><X size={18} /></button>
        </div>
        <p className="text-xs mb-1" style={{ color: "#6B5D52" }}>{bon.clientNom}{bon.clientTelephone ? ` · ${bon.clientTelephone}` : ""} · {bon.boutique}</p>
        {bon.lieuLivraison && <p className="text-xs mb-4 font-medium" style={{ color: "#8C3B2E" }}>📍 {bon.lieuLivraison}</p>}

        <div className="space-y-2 mb-5">
          {bon.lignes.map((l) => (
            <div key={l.id} className="rounded-lg p-3 flex items-center justify-between flex-wrap gap-2" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
              <div>
                <p className="text-sm font-medium">{l.article.designation}{l.pointure ? ` T${l.pointure}` : ""} x{l.quantite}</p>
                <p className="text-xs" style={{ color: "#6B5D52" }}>{fmt(l.prixUnitaire)} F / unité</p>
              </div>
              <div className="flex gap-1.5">
                {[["VENDU", "Vendu", "#3F6B4A", "#E9F0EA"], ["RETOURNE", "Rendu", "#6B5D52", "#F1E9DC"], ["PERDU", "Perdu/cassé", "#B04A3B", "#FBEAE7"]].map(([val, label, fg, bg]) => (
                  <button key={val} onClick={() => setStatuts({ ...statuts, [l.id]: val })} className="text-xs px-2.5 py-1.5 rounded-full font-medium" style={statuts[l.id] === val ? { background: fg, color: "#FBF3EC" } : { background: bg, color: fg }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {(bon.cartesLignes || []).length > 0 && (
          <div className="space-y-2 mb-5">
            {bon.cartesLignes.map((c) => (
              <div key={c.id} className="rounded-lg p-3 flex items-center justify-between flex-wrap gap-2" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
                <div>
                  <p className="text-sm font-medium">Carte cadeau {c.bonValeur.numero}</p>
                  <p className="text-xs" style={{ color: "#6B5D52" }}>{fmt(c.bonValeur.montant)} F</p>
                </div>
                <div className="flex gap-1.5">
                  {[["VENDU", "Vendue", "#3F6B4A", "#E9F0EA"], ["RETOURNE", "Rendue", "#6B5D52", "#F1E9DC"], ["PERDUE", "Perdue", "#B04A3B", "#FBEAE7"]].map(([val, label, fg, bg]) => (
                    <button key={val} onClick={() => setStatutsCartes({ ...statutsCartes, [c.id]: val })} className="text-xs px-2.5 py-1.5 rounded-full font-medium" style={statutsCartes[c.id] === val ? { background: fg, color: "#FBF3EC" } : { background: bg, color: fg }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {(lignesVendues.length > 0 || cartesVendues.length > 0) && (
          <div className="rounded-xl p-4 mb-4" style={{ background: "#F1E9DC" }}>
            <p className="text-sm font-semibold mb-1">Encaissement — {fmt(totalVendu)} F au total</p>
            {bon.avance > 0 && (
              <p className="text-xs mb-3 px-2 py-1.5 rounded-lg" style={{ background: "#E9F0EA", color: "#3F6B4A" }}>
                Avance déjà perçue au départ : {fmt(bon.avance)} F ({bon.avanceModePaiement}) — déjà comptée automatiquement. Il reste à percevoir aujourd'hui : <strong>{fmt(resteAPercevoir)} F</strong>.
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Type de vente</label>
                <select value={typeVente} onChange={(e) => setTypeVente(e.target.value)} style={selectStyle}>
                  <option value="Comptant">Comptant</option>
                  <option value="Credit">Crédit</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Client (pour la vente)</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={selectStyle}>
                  <option value="">— Aucune fiche —</option>
                  {(clients || []).map((c) => <option key={c.id} value={c.id}>{c.nomPrenoms}</option>)}
                </select>
              </div>
            </div>
            {paiements.map((p) => (
              <div key={p.id} className="flex items-center gap-2 mb-2">
                <select value={p.mode} onChange={(e) => majPaiement(p.id, "mode", e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                  {MODES_PAIEMENT.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <input type="number" value={p.montant} onChange={(e) => majPaiement(p.id, "montant", e.target.value)} placeholder="Montant" style={{ ...selectStyle, width: "140px" }} />
                {paiements.length > 1 && <button onClick={() => retirerPaiement(p.id)} style={{ color: "#B04A3B" }}><X size={14} /></button>}
              </div>
            ))}
            <button onClick={ajouterPaiement} className="text-xs" style={{ color: "#8C3B2E" }}>+ Ajouter un mode de paiement</button>
            <p className="text-xs mt-2" style={{ color: totalPaye < totalVendu ? "#B04A3B" : "#3F6B4A" }}>
              Payé : {fmt(totalPaye)} F {typeVente === "Comptant" && totalPaye < totalVendu ? `— reste ${fmt(totalVendu - totalPaye)} F` : ""}
            </p>
          </div>
        )}

        <button onClick={cloturer} disabled={envoiEnCours} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: envoiEnCours ? 0.6 : 1 }}>
          <CheckCircle2 size={16} /> {envoiEnCours ? "Enregistrement..." : "Clôturer le bon de livraison"}
        </button>
      </div>
    </div>
  );
}
