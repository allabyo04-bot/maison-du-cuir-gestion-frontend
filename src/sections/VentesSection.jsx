import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, X, ShoppingCart, Printer, Wallet, Search, Minus, PauseCircle, PlayCircle, RotateCcw, Gift, Percent, Clock, CheckCircle2, XCircle, MessageCircle } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { BOUTIQUES, POINTURES, MODES_VENTE, MODES_PAIEMENT, INFOS_BOUTIQUE, MESSAGE_FIN_TICKET, PAYS_INDICATIF, FIDELITE_ACTIF, fmt } from "../constants.js";
import { Field, ErrorBanner, inputStyle } from "../components/Shared.jsx";

function uid() { return `tmp_${Date.now()}_${Math.floor(Math.random() * 10000)}`; }

// Interrupteur temporaire : le bouton "WhatsApp" sur le reçu est désactivé le temps que Djenie
// forme les caissières à son utilisation — repasser à true dès qu'elle donne le feu vert.
const WHATSAPP_RECU_ACTIF = true;

export default function VentesSection({ subTabInitial, onSubTabInitialConsomme } = {}) {
  const { user } = useAuth();
  const estAdmin = !!user?.role?.systeme;
  const [subTab, setSubTab] = useState(subTabInitial || "nouvelle");
  useEffect(() => {
    if (subTabInitial) {
      setSubTab(subTabInitial);
      onSubTabInitialConsomme?.();
    }
  }, [subTabInitial, onSubTabInitialConsomme]);
  const [articles, setArticles] = useState([]);
  const [brands, setBrands] = useState([]);
  const [clients, setClients] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [attentes, setAttentes] = useState([]);
  const [ventesCredit, setVentesCredit] = useState([]);
  const [vendeurs, setVendeurs] = useState([]);
  const [vendeurId, setVendeurId] = useState("");
  const [demandeRemise, setDemandeRemise] = useState(null);
  const [historiqueSearch, setHistoriqueSearch] = useState("");
  const [venteAAnnuler, setVenteAAnnuler] = useState(null);
  const [motifAnnulation, setMotifAnnulation] = useState("");
  const [annulationChargement, setAnnulationChargement] = useState(false);
  const [remiseFormOuvert, setRemiseFormOuvert] = useState(false);
  const [remiseType, setRemiseType] = useState("MONTANT");
  const [remiseValeur, setRemiseValeur] = useState("");
  const [remiseChargement, setRemiseChargement] = useState(false);
  const [nbRemisesEnAttente, setNbRemisesEnAttente] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);

  const [boutique, setBoutique] = useState(estAdmin ? "" : (user?.boutique || BOUTIQUES[0]));
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [fideliteClient, setFideliteClient] = useState(null);
  const [modeVente, setModeVente] = useState(MODES_VENTE[0]);
  const [typeVente, setTypeVente] = useState("Comptant");
  const [lignes, setLignes] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [cartesCadeauxPanier, setCartesCadeauxPanier] = useState([]);
  const [denominationsCartes, setDenominationsCartes] = useState([]);
  const [carteFormOuvert, setCarteFormOuvert] = useState(false);
  const [carteNumeroForm, setCarteNumeroForm] = useState("");

  const [selArticle, setSelArticle] = useState("");
  const [articleSearch, setArticleSearch] = useState("");
  const [selPointure, setSelPointure] = useState("");
  const [selQty, setSelQty] = useState(1);

  const brandName = (id) => brands.find((b) => b.id === id)?.nom || "—";

  const load = useCallback(async () => {
    if (!boutique) { setLoading(false); return; }
    setLoading(true);
    try {
      const [a, b, c, v, at, vc, vd] = await Promise.all([
        api.articles.list(), api.brands.list(), api.clients.list(),
        api.ventes.list({ boutique }), api.ventesAttente.list(boutique), api.ventes.creditListe({ boutique }),
        api.vendeurs.list(boutique),
      ]);
      setArticles(a); setBrands(b); setClients(c); setVentes(v); setAttentes(at); setVentesCredit(vc);
      setVendeurs(vd);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [boutique]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.denominationsCartesCadeaux.lister().then(setDenominationsCartes).catch(() => {});
  }, []);

  useEffect(() => { setVendeurId(""); }, [boutique]);

  useEffect(() => {
    const dernierClientId = localStorage.getItem("gc_dernier_client_id");
    if (dernierClientId && clients.some((c) => c.id === dernierClientId)) {
      setClientId(dernierClientId);
      localStorage.removeItem("gc_dernier_client_id");
    }
  }, [clients]);

  useEffect(() => {
    if (!demandeRemise || demandeRemise.statut !== "EN_ATTENTE") return;
    const interval = setInterval(async () => {
      try {
        const maj = await api.remises.get(demandeRemise.id);
        if (maj.statut !== "EN_ATTENTE") setDemandeRemise(maj);
      } catch { /* erreur reseau ponctuelle */ }
    }, 4000);
    return () => clearInterval(interval);
  }, [demandeRemise]);

  useEffect(() => {
    if (!estAdmin) return;
    const rafraichir = async () => {
      try { setNbRemisesEnAttente((await api.remises.list("EN_ATTENTE")).length); } catch { /* ignore */ }
    };
    rafraichir();
    const interval = setInterval(rafraichir, 5000);
    return () => clearInterval(interval);
  }, [estAdmin]);

  const currentArticle = articles.find((a) => a.id === selArticle);
  const disponibilite = (article, b, pointure) => {
    if (!article) return 0;
    const item = article.stocks?.find((s) => s.boutique === b && s.pointure === (pointure || ""));
    return item?.quantite || 0;
  };
  const articleADuStock = (article, b) => {
    if (article.famille === "Chaussure") return POINTURES.some((p) => disponibilite(article, b, p) > 0);
    return disponibilite(article, b) > 0;
  };

  const total = lignes.reduce((s, l) => s + l.sousTotal, 0);

  useEffect(() => {
    if (!FIDELITE_ACTIF || !clientId || typeVente !== "Comptant") { setFideliteClient(null); return; }
    api.fidelite.client(clientId).then(setFideliteClient).catch(() => setFideliteClient(null));
  }, [clientId, typeVente]);
  const bonusApplicable = fideliteClient?.bonusDisponible > 0 && total >= fideliteClient.bonusDisponible;

  useEffect(() => {
    if (demandeRemise && demandeRemise.totalVente !== total) {
      setDemandeRemise(null);
      setError("Le panier a change depuis la demande de remise : elle a ete annulee. Refais une demande si besoin.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const montantRemiseApplique = demandeRemise && demandeRemise.statut !== "REFUSEE" ? demandeRemise.montantRemise : 0;
  const montantBonusApplique = bonusApplicable ? fideliteClient.bonusDisponible : 0;
  const totalCartesCadeauxPanier = cartesCadeauxPanier.reduce((s, c) => s + c.montant, 0);
  const totalNet = total - montantRemiseApplique - montantBonusApplique + totalCartesCadeauxPanier;
  const totalPaye = paiements.reduce((s, p) => s + (Number(p.montant) || 0), 0);
  const reste = totalNet - totalPaye;

  const addLigne = () => {
    if (!currentArticle) { setError("Choisis un article."); return; }
    if (currentArticle.famille === "Chaussure" && !selPointure) { setError("Choisis une pointure."); return; }
    const qty = Math.max(1, parseInt(selQty, 10) || 1);
    const dispo = disponibilite(currentArticle, boutique, selPointure);
    const dejaDansPanier = lignes.filter((l) => l.articleId === currentArticle.id && l.pointure === (selPointure || null)).reduce((s, l) => s + l.quantite, 0);
    if (qty + dejaDansPanier > dispo) { setError(`Stock insuffisant : ${dispo} disponible(s).`); return; }
    setError("");
    setLignes([...lignes, {
      id: uid(), articleId: currentArticle.id, designation: currentArticle.designation,
      marque: brandName(currentArticle.marqueId), famille: currentArticle.famille,
      pointure: selPointure || null, quantite: qty, prixUnitaire: Number(currentArticle.prixVente),
      sousTotal: qty * Number(currentArticle.prixVente),
    }]);
    setSelArticle(""); setSelPointure(""); setSelQty(1);
  };
  const removeLigne = (id) => setLignes(lignes.filter((l) => l.id !== id));

  const addPaiement = (mode) => setPaiements([...paiements, { id: uid(), mode, montant: (mode === "bon_achat" || mode === "avoir") ? "" : (reste > 0 ? reste : ""), carteNumero: "" }]);
  const updatePaiement = (id, patch) => setPaiements(paiements.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  // Une fois le numero de carte/avoir tape (au blur du champ), on va chercher sa vraie valeur —
  // jamais le total de la facture, meme si la carte vaut moins que ce qui reste a payer.
  const verifierEtRemplirCarte = async (p) => {
    if (!p.carteNumero?.trim()) return;
    try {
      const bon = await api.bonsValeur.verifier(p.carteNumero.trim());
      const resteActualise = totalNet - paiements.filter((x) => x.id !== p.id).reduce((s, x) => s + (Number(x.montant) || 0), 0);
      updatePaiement(p.id, { montant: Math.min(bon.montant, Math.max(0, resteActualise)) });
    } catch (e) {
      // Numero invalide ou deja utilise — on laisse le montant tel quel, validerVente() donnera
      // le vrai message d'erreur au moment de valider si le numero est toujours mauvais.
    }
  };
  const removePaiement = (id) => setPaiements(paiements.filter((p) => p.id !== id));

  const [verificationCarteEnCours, setVerificationCarteEnCours] = useState(false);
  const ajouterCarteCadeauPanier = async () => {
    const numero = carteNumeroForm.trim();
    if (!numero) { setError("Indique le numéro imprimé sur la carte."); return; }
    if (cartesCadeauxPanier.some((c) => c.numero === numero)) { setError("Ce numéro de carte est déjà dans le panier."); return; }
    setVerificationCarteEnCours(true);
    try {
      const res = await api.denominationsCartesCadeaux.verifierCarte(numero, boutique);
      setCartesCadeauxPanier([...cartesCadeauxPanier, { id: uid(), montant: res.montant, numero }]);
      setCarteNumeroForm(""); setCarteFormOuvert(false); setError("");
    } catch (e) { setError(e.message); } finally { setVerificationCarteEnCours(false); }
  };
  const retirerCarteCadeauPanier = (id) => setCartesCadeauxPanier(cartesCadeauxPanier.filter((c) => c.id !== id));

  const resetVente = () => {
    setLignes([]); setPaiements([]); setClientId(""); setClientSearch(""); setModeVente(MODES_VENTE[0]);
    setVendeurId(""); setDemandeRemise(null); setRemiseFormOuvert(false); setRemiseValeur("");
    setCartesCadeauxPanier([]); setCarteFormOuvert(false); setCarteNumeroForm("");
  };

  // Le client se desiste avant paiement : on vide le panier en cours sans rien
  // enregistrer (ni en attente, ni en base). Simple confirmation pour eviter
  // un clic accidentel qui ferait perdre une vente en cours de saisie.
  const annulerVenteEnCours = () => {
    if (lignes.length === 0 && cartesCadeauxPanier.length === 0) return;
    const confirme = window.confirm("Annuler cette vente ? Le panier sera vide et rien ne sera enregistre.");
    if (!confirme) return;
    resetVente();
    setError("");
  };

  const demanderRemise = async () => {
    if (!remiseValeur || Number(remiseValeur) <= 0) { setError("Indique une valeur de remise valide."); return; }
    if (remiseType === "POURCENTAGE" && Number(remiseValeur) > 100) { setError("Un pourcentage ne peut pas depasser 100."); return; }
    setRemiseChargement(true);
    try {
      const clientSel = clients.find((c) => c.id === clientId);
      const demande = await api.remises.create({
        totalVente: total, type: remiseType, valeur: Number(remiseValeur),
        clientNom: clientSel ? clientSel.nomPrenoms : undefined,
      });
      setDemandeRemise(demande);
      setRemiseFormOuvert(false);
      setRemiseValeur("");
      setError("");
    } catch (e) { setError(e.message); } finally { setRemiseChargement(false); }
  };

  const validerVente = async () => {
    if (lignes.length === 0 && cartesCadeauxPanier.length === 0) { setError("Ajoute au moins un article ou une carte cadeau a la vente."); return; }
    if (modeVente === "Boutique" && !vendeurId) { setError("Choisis le vendeur qui a realise cette vente."); return; }
    if (typeVente === "Credit" && !clientId) { setError("Un client est obligatoire pour une vente a credit."); return; }
    if (typeVente === "Comptant" && totalPaye < totalNet) { setError("Le total paye est inferieur au total de la vente."); return; }
    try {
      const vente = await api.ventes.create({
        boutique, vendeurId, modeVente, typeVente, clientId: clientId || null,
        demandeRemiseId: demandeRemise && demandeRemise.statut !== "REFUSEE" ? demandeRemise.id : undefined,
        lignes: lignes.map(({ articleId, pointure, quantite }) => ({ articleId, pointure, quantite })),
        cartesCadeauxAEmettre: cartesCadeauxPanier.map(({ numero }) => ({ numero })),
        paiements: paiements.map((p) => ({ mode: p.mode, montant: Number(p.montant), carteNumero: (p.mode === "bon_achat" || p.mode === "avoir") ? p.carteNumero : undefined })),
      });
      setReceipt(vente);
      resetVente();
      setError("");
      load();
    } catch (e) { setError(e.message); }
  };

  const mettreEnAttente = async () => {
    if (lignes.length === 0) { setError("Le panier est vide."); return; }
    if (modeVente === "Boutique" && !vendeurId) { setError("Choisis le vendeur qui a realise cette vente."); return; }
    try {
      const clientSel = clients.find((c) => c.id === clientId);
      await api.ventesAttente.create({
        boutique, vendeurId, clientId: clientId || null, modeVente,
        label: clientSel ? clientSel.nomPrenoms : undefined,
        panier: lignes, paiements, cartesCadeaux: cartesCadeauxPanier,
      });
      resetVente();
      setSubTab("attente");
      load();
    } catch (e) { setError(e.message); }
  };

  const reprendreAttente = async (ticket) => {
    setLignes(ticket.panier || []);
    setPaiements(ticket.paiements || []);
    setCartesCadeauxPanier(ticket.cartesCadeaux || []);
    setClientId(ticket.clientId || "");
    setModeVente(ticket.modeVente || MODES_VENTE[0]);
    setVendeurId(ticket.vendeurId || "");
    try { await api.ventesAttente.remove(ticket.id); } catch { /* deja supprime, tant pis */ }
    setSubTab("nouvelle");
    load();
  };

  const annulerAttente = async (ticket) => {
    try { await api.ventesAttente.remove(ticket.id); load(); } catch (e) { setError(e.message); }
  };

  const annulerVente = async () => {
    if (!motifAnnulation.trim()) { setError("Le motif d'annulation est obligatoire."); return; }
    setAnnulationChargement(true);
    try {
      await api.ventes.annuler(venteAAnnuler.id, { motif: motifAnnulation.trim() });
      setVenteAAnnuler(null);
      setMotifAnnulation("");
      setError("");
      load();
    } catch (e) { setError(e.message); } finally { setAnnulationChargement(false); }
  };

  return (
    <div>
      <ErrorBanner error={error} onClose={() => setError("")} />

      {estAdmin && !boutique ? (
        <div className="rounded-xl p-6 text-center" style={{ background: "#F1E9DC", color: "#6B5D52" }}>
          <p className="font-display text-lg font-semibold mb-1">Choisis une boutique</p>
          <p className="text-sm mb-4">Sélectionnez une boutique pour commencer une vente ou consulter l'activité.</p>
          <div className="flex items-center justify-center gap-3">
            {BOUTIQUES.map((b) => (
              <button key={b} onClick={() => setBoutique(b)} className="px-5 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>{b}</button>
            ))}
          </div>
        </div>
      ) : (
      <div className="flex gap-6 items-start">
        <div className="flex flex-col gap-2 no-print shrink-0" style={{ width: "200px" }}>
          {[["nouvelle", "Nouvelle vente"], ["attente", `En attente (${attentes.length})`], ["credit", `Ventes a credit (${ventesCredit.length})`], ["creances", "Créances historiques"], ["historique", "Historique"], ["retours", "Retours / Echanges"], ["cartes", "Cartes cadeaux"], ["avoirs", "Avoirs"],
            ...(estAdmin ? [["remises-admin", `Demandes de remise${nbRemisesEnAttente > 0 ? ` (${nbRemisesEnAttente})` : ""}`]] : [])].map(([id, label]) => (
            <button key={id} onClick={() => setSubTab(id)} className="px-4 py-2 rounded-lg text-sm font-medium text-left" style={subTab === id ? { background: "#8C3B2E", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52", border: "1px solid #DDD3C4" }}>{label}</button>
          ))}
        </div>

        <div className="flex-1 min-w-0">
        {subTab === "nouvelle" && (        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <div className="rounded-xl p-5 mb-4" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Boutique">
                  {user?.role?.systeme ? (
                    <select value={boutique} onChange={(e) => setBoutique(e.target.value)} style={inputStyle}>
                      <option value="">— Choisir une boutique —</option>
                      {BOUTIQUES.map((b) => <option key={b}>{b}</option>)}
                    </select>
                  ) : (
                    <div style={{ ...inputStyle, background: "#F1E9DC", color: "#6B5D52" }}>{boutique}</div>
                  )}
                </Field>
                {modeVente === "Boutique" ? (
                  <Field label="Vendeur">
                    <select value={vendeurId} onChange={(e) => setVendeurId(e.target.value)} style={inputStyle}>
                      <option value="">— Choisir —</option>
                      {vendeurs.filter((v) => v.actif !== false).map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
                    </select>
                  </Field>
                ) : (
                  <Field label="Vendeur">
                    <div style={{ ...inputStyle, background: "#F1E9DC", color: "#6B5D52" }}>Non applicable ({modeVente})</div>
                  </Field>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Mode de vente"><select value={modeVente} onChange={(e) => setModeVente(e.target.value)} style={inputStyle}>{MODES_VENTE.map((m) => <option key={m}>{m}</option>)}</select></Field>
<Field label="Type de vente">
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={() => setTypeVente("Comptant")} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium" style={typeVente === "Comptant" ? { background: "#8C3B2E", color: "#FBF3EC" } : { border: "1px solid #DDD3C4", color: "#6B5D52" }}>Comptant</button>
                    <button type="button" onClick={() => setTypeVente("Credit")} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium" style={typeVente === "Credit" ? { background: "#8C3B2E", color: "#FBF3EC" } : { border: "1px solid #DDD3C4", color: "#6B5D52" }}>Credit</button>
                  </div>
                </Field>
                <Field label="Client (nom, n° carte ou téléphone)">
                  {clientId ? (
                    <div className="flex items-center justify-between mt-1 px-3 py-2 rounded-lg" style={{ background: "#F1E9DC" }}>
                      <span className="text-sm">{clients.find((c) => c.id === clientId)?.nomPrenoms}</span>
                      <button onClick={() => { setClientId(""); setClientSearch(""); }} style={{ color: "#B04A3B" }}><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="relative mt-1">
                      <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} style={{ ...inputStyle, marginTop: 0, paddingLeft: "30px" }} placeholder="Rechercher…" />
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#6B5D52" />
                      {clientSearch.trim() && (
                        <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden max-h-40 overflow-y-auto" style={{ background: "#FFFFFF", border: "1px solid #DDD3C4" }}>
                          {clients.filter((c) => c.nomPrenoms.toLowerCase().includes(clientSearch.toLowerCase()) || (c.carteFidelite || "").toLowerCase().includes(clientSearch.toLowerCase()) || (c.telephone || "").includes(clientSearch.trim())).slice(0, 6).map((c) => (
                            <button key={c.id} onClick={() => { setClientId(c.id); setClientSearch(""); }} className="w-full text-left px-3 py-2 text-sm" style={{ background: "#FFFFFF" }}>
                              {c.nomPrenoms} {c.carteFidelite ? <span className="font-mono text-xs" style={{ color: "#6B5D52" }}>· {c.carteFidelite}</span> : null} {c.telephone ? <span className="font-mono text-xs" style={{ color: "#6B5D52" }}>· {c.telephone}</span> : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Field>
              </div>
              {FIDELITE_ACTIF && fideliteClient && (fideliteClient.bonusDisponible > 0 || (fideliteClient.prochainPalierDistance != null && fideliteClient.prochainPalierDistance <= 50000)) && (
                <div className="mt-3 px-3 py-2 rounded-lg text-sm" style={bonusApplicable ? { background: "#E9F0EA", color: "#3F6B4A" } : { background: "#FBF3E3", color: "#A8823D" }}>
                  {bonusApplicable ? (
                    <>🎁 Bonus fidélité de <strong>{fmt(fideliteClient.bonusDisponible)} F</strong> — sera déduit automatiquement à la validation.</>
                  ) : fideliteClient.bonusDisponible > 0 ? (
                    <>🎁 Cette cliente a un bonus de {fmt(fideliteClient.bonusDisponible)} F, mais le panier actuel ({fmt(total)} F) n'atteint pas ce montant — il reste disponible pour un prochain achat.</>
                  ) : fideliteClient.prochainPalierDistance != null && fideliteClient.prochainPalierDistance <= 50000 ? (
                    <>👑 Cendrillon : il ne manque que {fmt(fideliteClient.prochainPalierDistance)} F à cette cliente pour débloquer son prochain bonus.</>
                  ) : null}
                </div>
              )}
            </div>

            <div className="rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
              <p className="font-display font-semibold mb-3">Ajouter un article</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Article">
                  {selArticle ? (
                    <div className="flex items-center justify-between mt-1 px-3 py-2 rounded-lg" style={{ background: "#F1E9DC" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{currentArticle?.designation} · {brandName(currentArticle?.marqueId)}</span>
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full" style={{ background: "#E9F0EA", color: "#3F6B4A" }}>
                          {currentArticle?.famille === "Chaussure"
                            ? POINTURES.reduce((s, p) => s + disponibilite(currentArticle, boutique, p), 0)
                            : disponibilite(currentArticle, boutique)} en stock
                        </span>
                      </div>
                      <button onClick={() => { setSelArticle(""); setArticleSearch(""); setSelPointure(""); }} style={{ color: "#B04A3B" }}><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="relative mt-1">
                      <input value={articleSearch} onChange={(e) => setArticleSearch(e.target.value)} style={{ ...inputStyle, marginTop: 0, paddingLeft: "30px" }} placeholder="Rechercher un article…" />
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#6B5D52" />
                      {articleSearch.trim() && (
                        <div className="absolute z-10 w-full bottom-full mb-1 rounded-lg overflow-hidden max-h-48 overflow-y-auto" style={{ background: "#FFFFFF", border: "1px solid #DDD3C4", boxShadow: "0 -4px 12px rgba(0,0,0,0.1)" }}>
                          {articles.filter((a) => a.actif !== false && articleADuStock(a, boutique) && (a.designation.toLowerCase().includes(articleSearch.toLowerCase()) || brandName(a.marqueId).toLowerCase().includes(articleSearch.toLowerCase()))).slice(0, 20).map((a) => (
                            <button key={a.id} onClick={() => { setSelArticle(a.id); setArticleSearch(""); setSelPointure(""); }} className="w-full text-left px-3 py-2 text-sm" style={{ background: "#FFFFFF" }}>
                              {a.designation} · {brandName(a.marqueId)}
                            </button>
                          ))}
                          {articles.filter((a) => a.actif !== false && articleADuStock(a, boutique) && (a.designation.toLowerCase().includes(articleSearch.toLowerCase()) || brandName(a.marqueId).toLowerCase().includes(articleSearch.toLowerCase()))).length === 0 && (
                            <div className="px-3 py-2 text-sm" style={{ color: "#6B5D52" }}>Aucun article trouvé.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Field>
                {currentArticle?.famille === "Chaussure" ? (
                  <Field label="Pointure">
                    <select value={selPointure} onChange={(e) => setSelPointure(e.target.value)} style={inputStyle}>
                      <option value="">— Choisir —</option>
                      {POINTURES.filter((p) => disponibilite(currentArticle, boutique, p) > 0).map((p) => { const dispo = disponibilite(currentArticle, boutique, p); return <option key={p} value={p}>T{p} ({dispo} dispo.)</option>; })}
                    </select>
                  </Field>
                 ) : (
                  <Field label="Disponible"><div style={{ ...inputStyle, background: "#F1E9DC", color: "#6B5D52" }}>{currentArticle ? `${disponibilite(currentArticle, boutique)} en stock` : "—"}</div></Field>
                )}
                <Field label="Quantite"><input type="number" min="1" value={selQty} onChange={(e) => setSelQty(e.target.value)} style={inputStyle} /></Field>
              </div>
              <button onClick={addLigne} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}><Plus size={16} /> Ajouter au panier</button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
              <p className="font-display font-semibold mb-3 flex items-center gap-2"><ShoppingCart size={16} /> Panier</p>
              {lignes.length === 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>Aucun article ajoute.</p>}
              <div className="space-y-2">
                {lignes.map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-sm pb-2" style={{ borderBottom: "1px solid #EFE7D9" }}>
                    <div><p className="font-medium">{l.designation}{l.pointure ? ` · T${l.pointure}` : ""}</p><p className="text-xs font-mono" style={{ color: "#6B5D52" }}>{l.quantite} × {fmt(l.prixUnitaire)} F</p></div>
                    <div className="flex items-center gap-3"><p className="font-mono">{fmt(l.sousTotal)} F</p><button onClick={() => removeLigne(l.id)} style={{ color: "#B04A3B" }}><Trash2 size={14} /></button></div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: "1px solid #EAE1D2" }}>
                <p className="font-display font-semibold">Total</p><p className="font-display text-xl font-semibold" style={{ color: "#8C3B2E" }}>{fmt(total)} F</p>
              </div>

              <div className="mt-3 pt-3" style={{ borderTop: "1px solid #EFE7D9" }}>
                {!demandeRemise && !remiseFormOuvert && (
                  <button onClick={() => setRemiseFormOuvert(true)} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#8C3B2E" }}>
                    <Percent size={13} /> Demander une remise
                  </button>
                )}
                {!demandeRemise && remiseFormOuvert && (
                  <div className="rounded-lg p-3" style={{ background: "#F1E9DC" }}>
                    <div className="flex gap-2 mb-2">
                      <button type="button" onClick={() => setRemiseType("MONTANT")} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium" style={remiseType === "MONTANT" ? { background: "#8C3B2E", color: "#FBF3EC" } : { border: "1px solid #DDD3C4", color: "#6B5D52" }}>Montant (F)</button>
                      <button type="button" onClick={() => setRemiseType("POURCENTAGE")} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium" style={remiseType === "POURCENTAGE" ? { background: "#8C3B2E", color: "#FBF3EC" } : { border: "1px solid #DDD3C4", color: "#6B5D52" }}>Pourcentage (%)</button>
                    </div>
                    <input type="number" min="0" value={remiseValeur} onChange={(e) => setRemiseValeur(e.target.value)} placeholder={remiseType === "MONTANT" ? "Ex : 5000" : "Ex : 10"} style={{ ...inputStyle, marginTop: 0 }} />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => { setRemiseFormOuvert(false); setRemiseValeur(""); }} className="flex-1 px-3 py-1.5 rounded-lg text-xs" style={{ color: "#6B5D52" }}>Annuler</button>
                      <button onClick={demanderRemise} disabled={remiseChargement} className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>{remiseChargement ? "Envoi..." : "Envoyer a Djenie"}</button>
                    </div>
                  </div>
                )}
                {demandeRemise?.statut === "EN_ATTENTE" && (
                  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "#F1E9DC", color: "#6B5D52" }}>
                    <Clock size={13} /> Remise en attente de validation par Djenie ({demandeRemise.numero}) — tu peux deja encaisser au tarif reduit, elle validera apres coup
                  </div>
                )}
                {demandeRemise?.statut === "APPROUVEE" && (
                  <div className="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "#E9F0EA", color: "#3F6B4A" }}>
                    <span className="flex items-center gap-1.5"><CheckCircle2 size={13} /> Remise approuvee : - {fmt(demandeRemise.montantRemise)} F</span>
                    <button onClick={() => setDemandeRemise(null)} style={{ color: "#B04A3B" }}><X size={13} /></button>
                  </div>
                )}
                {demandeRemise?.statut === "REFUSEE" && (
                  <div className="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "#FBEAE7", color: "#8C3B2E" }}>
                    <span className="flex items-center gap-1.5"><XCircle size={13} /> Remise refusee par Djenie</span>
                    <button onClick={() => setDemandeRemise(null)} style={{ color: "#8C3B2E" }}><X size={13} /></button>
                  </div>
                )}
                {montantBonusApplique > 0 && (
                  <div className="flex items-center justify-between mt-2 text-sm font-semibold" style={{ color: "#3F6B4A" }}>
                    <span>🎁 BONUS FIDÉLITÉ</span><span>- {fmt(montantBonusApplique)} F</span>
                  </div>
                )}
                {(montantRemiseApplique > 0 || montantBonusApplique > 0 || totalCartesCadeauxPanier > 0) && (
                  <div className="flex items-center justify-between mt-2 text-sm font-semibold">
                    <span style={{ color: "#6B5D52" }}>Net a payer</span><span style={{ color: "#3F6B4A" }}>{fmt(totalNet)} F</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3" style={{ borderTop: "1px solid #EFE7D9" }}>
                {cartesCadeauxPanier.length > 0 && (
                  <p className="text-xs mb-2 font-medium" style={{ color: "#8C3B2E" }}>Carte(s) cadeau vendue(s) dans cette vente :</p>
                )}
                {cartesCadeauxPanier.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg mb-2" style={{ background: "#F1E9DC", color: "#6B5D52" }}>
                    <span className="flex items-center gap-1.5"><Gift size={13} /> Carte cadeau {fmt(c.montant)} F — n° {c.numero}</span>
                    <button onClick={() => retirerCarteCadeauPanier(c.id)} style={{ color: "#B04A3B" }}><X size={13} /></button>
                  </div>
                ))}
                {!carteFormOuvert && (
                  <button onClick={() => setCarteFormOuvert(true)} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#8C3B2E" }}>
                    <Gift size={13} /> Vendre une carte cadeau (nouvelle)
                  </button>
                )}
                {carteFormOuvert && (
                  <div className="rounded-lg p-3" style={{ background: "#F1E9DC" }}>
                    <input value={carteNumeroForm} onChange={(e) => setCarteNumeroForm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ajouterCarteCadeauPanier()} placeholder="Numéro imprimé sur la carte" style={{ ...inputStyle, marginTop: 0 }} autoFocus />
                    <p className="text-xs mt-1" style={{ color: "#6B5D52" }}>Le montant est retrouvé automatiquement selon le numéro — pas besoin de le choisir.</p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => { setCarteFormOuvert(false); setCarteNumeroForm(""); }} className="flex-1 px-3 py-1.5 rounded-lg text-xs" style={{ color: "#6B5D52" }}>Annuler</button>
                      <button onClick={ajouterCarteCadeauPanier} disabled={verificationCarteEnCours} className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: verificationCarteEnCours ? 0.6 : 1 }}>{verificationCarteEnCours ? "Vérification..." : "Ajouter au panier"}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl p-5 mt-4" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
              <p className="font-display font-semibold mb-3 flex items-center gap-2"><Wallet size={16} /> Paiement (mixte possible)</p>
              <p className="text-xs mb-3" style={{ color: "#6B5D52" }}>
                Une cliente a plusieurs cartes cadeaux ? Clique sur "Carte cadeau" une fois par carte — chacune aura son propre numéro à renseigner.
              </p>
              <div className="flex gap-2 mb-3 flex-wrap">
                {MODES_PAIEMENT.map(({ id, label }) => (
                  <button key={id} onClick={() => addPaiement(id)} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ border: "1px solid #DDD3C4", color: "#6B5D52" }}>{label}</button>
                ))}
              </div>
              <div className="space-y-2">
                {paiements.map((p) => {
                  const mode = MODES_PAIEMENT.find((m) => m.id === p.mode);
                  return (
                    <div key={p.id}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-28 shrink-0" style={{ color: "#6B5D52" }}>{mode?.label}</span>
                        <input type="number" min="0" value={p.montant} onChange={(e) => updatePaiement(p.id, { montant: e.target.value })} style={{ ...inputStyle, marginTop: 0 }} />
                        <button onClick={() => removePaiement(p.id)} style={{ color: "#B04A3B" }}><Minus size={14} /></button>
                      </div>
                      {(p.mode === "bon_achat" || p.mode === "avoir") && (
                        <input value={p.carteNumero} onChange={(e) => updatePaiement(p.id, { carteNumero: e.target.value })} onBlur={() => verifierEtRemplirCarte(p)} placeholder={p.mode === "avoir" ? "Numero de l'avoir" : "Numero de la carte cadeau"} style={{ ...inputStyle, marginTop: "6px" }} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-3 text-sm"><span style={{ color: "#6B5D52" }}>Paye</span><span className="font-mono">{fmt(totalPaye)} F</span></div>
              <div className="flex items-center justify-between text-sm"><span style={{ color: reste > 0 ? "#B04A3B" : "#3F6B4A" }}>{reste > 0 ? "Reste a payer" : "Monnaie a rendre"}</span><span className="font-mono" style={{ color: reste > 0 ? "#B04A3B" : "#3F6B4A" }}>{fmt(Math.abs(reste))} F</span></div>
              <div className="flex gap-2 mt-4">
                <button onClick={annulerVenteEnCours} disabled={lignes.length === 0} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium" style={{ border: "1px solid #B04A3B", color: "#B04A3B" }}><XCircle size={16} /> Annuler</button>
                <button onClick={mettreEnAttente} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium" style={{ border: "1px solid #DDD3C4", color: "#6B5D52" }}><PauseCircle size={16} /> Mettre en attente</button>
                <button onClick={validerVente} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium" style={{ background: "#3F6B4A", color: "#F3F7F3" }}>Valider la vente</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === "attente" && (
        <div className="space-y-3">
          {attentes.length === 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>Aucune vente en attente pour {boutique}.</p>}
          {attentes.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl p-4 flex-wrap gap-2" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
              <div>
                <p className="font-medium text-sm">{t.label}</p>
                <p className="text-xs" style={{ color: "#6B5D52" }}>{new Date(t.createdAt).toLocaleTimeString("fr-FR")} · {(t.panier || []).length} article(s)</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => reprendreAttente(t)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}><PlayCircle size={14} /> Reprendre</button>
                <button onClick={() => annulerAttente(t)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: "#B04A3B" }}>Annuler</button>
              </div>
            </div>
          ))}
        </div>
      )}

     {subTab === "historique" && (
        <div>
          {!estAdmin && (
            <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: "#F1E9DC", color: "#6B5D52" }}>
              Tu consultes les ventes d'aujourd'hui ({new Date().toLocaleDateString("fr-FR")}). Seule Djenie peut consulter et annuler les jours précédents.
            </p>
          )}
          <div className="relative mb-4 max-w-md">
            <input value={historiqueSearch} onChange={(e) => setHistoriqueSearch(e.target.value)} placeholder="Rechercher par n° de reçu ou nom du client…" style={{ ...inputStyle, marginTop: 0, paddingLeft: "32px" }} />
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#6B5D52" />
          </div>
          <div className="space-y-3">
            {ventes.filter((v) => {
              if (!historiqueSearch.trim()) return true;
              const q = historiqueSearch.trim().toLowerCase();
              return v.numero.toLowerCase().includes(q) || (v.client?.nomPrenoms || "").toLowerCase().includes(q);
            }).map((v) => (
              <div key={v.id} className="rounded-xl p-4 flex items-center justify-between flex-wrap gap-2 cursor-pointer card-hover" style={{ background: v.statut === "Annulee" ? "#FBEAE7" : "#FFFFFF", border: "1px solid #EAE1D2", opacity: v.statut === "Annulee" ? 0.7 : 1 }} onClick={() => setReceipt(v)}>
                <div>
                  <p className="font-mono text-sm font-medium">
                    {v.numero}{v.client ? ` · ${v.client.nomPrenoms}` : ""}
                    {v.statut === "Annulee" && <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>ANNULÉE</span>}
                  </p>
                  <p className="text-xs" style={{ color: "#6B5D52" }}>{new Date(v.date).toLocaleString("fr-FR")} · {v.boutique} · Vendeur : {v.vendeur?.nom} · {v.modeVente}{v.montantRemise > 0 ? " · Remise appliquée" : ""}</p>
                  {v.statut === "Annulee" && <p className="text-xs mt-1" style={{ color: "#8C3B2E" }}>Motif : {v.motifAnnulation} · par {v.annuleePar?.prenom} {v.annuleePar?.nom}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-display font-semibold" style={{ color: "#8C3B2E", textDecoration: v.statut === "Annulee" ? "line-through" : "none" }}>{fmt(v.total)} F</p>
                  {v.statut !== "Annulee" && (
                    <button onClick={(e) => { e.stopPropagation(); setVenteAAnnuler(v); setMotifAnnulation(""); setError(""); }} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ border: "1px solid #DDD3C4", color: "#B04A3B" }}>Annuler</button>
                  )}
                  <span className="text-xs hidden sm:inline" style={{ color: "#A89A87" }}>Voir le détail →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "retours" && <RetoursSection ventes={ventes} articles={articles} boutique={boutique} onDone={load} />}
      {subTab === "cartes" && <CartesCadeauxSection boutique={boutique} estAdmin={estAdmin} />}
      {subTab === "avoirs" && <AvoirsSection />}
      {subTab === "credit" && <CreditSection estAdmin={estAdmin} onDone={load} />}
      {subTab === "creances" && <CreancesHistoriquesSection boutique={boutique} clients={clients} estAdmin={estAdmin} onDone={load} />}
      {subTab === "remises-admin" && estAdmin && <RemisesAdminSection onTraite={() => setNbRemisesEnAttente((n) => Math.max(0, n - 1))} />}
        </div>
      </div>
      )}

      {receipt && <ReceiptModal vente={receipt} onClose={() => setReceipt(null)} />}

      {venteAAnnuler && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
          <div className="rounded-xl p-6 max-w-sm w-full" style={{ background: "#FFFDF9" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-semibold">Annuler {venteAAnnuler.numero}</p>
              <button onClick={() => setVenteAAnnuler(null)}><X size={18} color="#6B5D52" /></button>
            </div>
            <p className="text-sm mb-3" style={{ color: "#6B5D52" }}>
              Cette vente sera marquée annulée, le stock sera remis, et le total sera exclu du chiffre d'affaires du jour. Cette action est tracée avec ton nom.
            </p>
            <Field label="Motif de l'annulation">
              <textarea value={motifAnnulation} onChange={(e) => setMotifAnnulation(e.target.value)} style={{ ...inputStyle, minHeight: "70px" }} placeholder="Ex : erreur de saisie, client absent, mauvais article…" />
            </Field>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setVenteAAnnuler(null)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium" style={{ border: "1px solid #DDD3C4", color: "#6B5D52" }}>Retour</button>
              <button onClick={annulerVente} disabled={annulationChargement} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium" style={{ background: "#B04A3B", color: "#FBF3EC" }}>{annulationChargement ? "Annulation..." : "Confirmer l'annulation"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReceiptModal({ vente, onClose }) {
  const infos = INFOS_BOUTIQUE[vente.boutique] || {};
const totalPayeRecu = vente.paiements.reduce((s, p) => s + p.montant, 0);
  const [fideliteRecu, setFideliteRecu] = useState(null);
  useEffect(() => {
    if (!FIDELITE_ACTIF || !vente.client?.id) return;
    api.fidelite.client(vente.client.id).then(setFideliteRecu).catch(() => {});
  }, [vente.client?.id]);

  const numeroWhatsApp = (numero, pays) => {
    if (!numero) return null;
    const chiffres = String(numero).replace(/\D/g, "");
    if (!chiffres) return null;
    const conf = PAYS_INDICATIF[pays];
    if (!conf) return null; // pays inconnu/non renseigné ("Autre") — indicatif inconnu, on ne devine pas
    if (chiffres.startsWith(conf.code)) return chiffres; // déjà au format international
    // Zéro de tête : conservé uniquement pour la Côte d'Ivoire (confirmé) — retiré pour les
    // autres pays par défaut (convention la plus courante, à vérifier au cas par cas si besoin).
    const local = chiffres.startsWith("0") && !conf.garderZero ? chiffres.slice(1) : chiffres;
    return conf.code + local;
  };
  const numeroClient = vente.client && (vente.client.whatsapp || vente.client.telephone);
  const numeroWA = numeroWhatsApp(numeroClient, vente.client?.pays || "Côte d'Ivoire");

  const envoyerSurWhatsApp = () => {
    const message = [
      "Merci pour votre achat de ce jour chez La Maison du Cuir by Anaïs !",
      "Nous espérons que votre nouvelle paire vous plaît. Au plaisir de vous revoir très bientôt, chère cliente !",
    ].join("\n");
    window.open(`https://wa.me/${numeroWA}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
      <div className="print-area rounded-xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto" style={{ background: "#FFFDF9", fontFamily: "'IBM Plex Mono', monospace" }}>
        <div className="flex items-center justify-between mb-4 no-print"><p className="font-display font-semibold">Recu de vente</p><button onClick={onClose}><X size={18} color="#6B5D52" /></button></div>

        <div className="text-center mb-3">
          <p className="font-display font-bold text-sm leading-tight">{infos.nom}</p>
          <p className="font-display font-bold text-sm leading-tight">{infos.ligne2}</p>
          <p className="text-xs mt-1" style={{ color: "#6B5D52" }}>{infos.adresse}</p>
          <p className="text-xs" style={{ color: "#6B5D52" }}>{infos.telephone}</p>
        </div>
        <div style={{ borderTop: "1px dashed #DDD3C4" }} className="my-2" />

        <p className="text-center font-display text-lg font-semibold">{vente.numero}</p>
        <p className="text-center text-xs mb-4" style={{ color: "#6B5D52" }}>{new Date(vente.date).toLocaleString("fr-FR")} · {vente.boutique}</p>
        <div className="text-xs mb-2" style={{ color: "#6B5D52" }}>Vendeur : {vente.vendeur?.nom}</div>
        <div className="text-xs mb-2" style={{ color: "#6B5D52" }}>Caissier : {vente.caissier?.prenom} {vente.caissier?.nom}</div>
        <div className="text-xs mb-2" style={{ color: "#6B5D52" }}>Mode : {vente.modeVente}</div>
        {vente.client && <div className="text-xs mb-3" style={{ color: "#6B5D52" }}>Client : {vente.client.nomPrenoms}</div>}
        <div style={{ borderTop: "1px dashed #DDD3C4", borderBottom: "1px dashed #DDD3C4" }} className="py-3 space-y-1.5">
          {vente.lignes.map((l) => <div key={l.id} className="flex justify-between gap-2 text-xs"><span>{l.designation}{l.pointure ? ` T${l.pointure}` : ""} ×{l.quantite}</span><span className="whitespace-nowrap">{fmt(l.sousTotal)} F</span></div>)}
          {vente.cartesCadeauxEmises?.map((c) => <div key={c.id} className="flex justify-between gap-2 text-xs"><span>Carte cadeau n° {c.numero}</span><span className="whitespace-nowrap">{fmt(c.montant)} F</span></div>)}
        </div>
        {(vente.montantRemise > 0 || vente.montantBonusFidelite > 0) ? (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between gap-2 text-xs" style={{ color: "#6B5D52" }}><span>Sous-total</span><span className="whitespace-nowrap">{fmt(vente.total + vente.montantRemise + (vente.montantBonusFidelite || 0))} F</span></div>
            {vente.montantRemise > 0 && (
              <div className="flex justify-between gap-2 text-xs font-medium" style={{ color: "#3F6B4A" }}><span>Remise accordee</span><span className="whitespace-nowrap">- {fmt(vente.montantRemise)} F</span></div>
            )}
            {vente.montantBonusFidelite > 0 && (
              <div className="flex justify-between gap-2 text-xs font-medium" style={{ color: "#3F6B4A" }}><span>BONUS FIDÉLITÉ</span><span className="whitespace-nowrap">- {fmt(vente.montantBonusFidelite)} F</span></div>
            )}
            <div className="flex justify-between gap-2 font-semibold text-sm"><span>NET A PAYER</span><span className="whitespace-nowrap">{fmt(vente.total)} F</span></div>
          </div>
        ) : (
          <div className="flex justify-between gap-2 font-semibold mt-3 text-sm"><span>TOTAL</span><span className="whitespace-nowrap">{fmt(vente.total)} F</span></div>
        )}
        {FIDELITE_ACTIF && fideliteRecu && (
          <div className="mt-3 pt-2 text-xs" style={{ borderTop: "1px dashed #DDD3C4", color: "#A8823D" }}>
            {fideliteRecu.statut && <div className="font-semibold">👑 STATUT : {fideliteRecu.statut.toUpperCase()}</div>}
            <div>Cumul fidélité en cours : {fmt(fideliteRecu.cumulFideliteCourant)} F</div>
            {fideliteRecu.bonusDisponible > 0 ? (
              <div>Bonus disponible : {fmt(fideliteRecu.bonusDisponible)} F dès ton prochain achat</div>
            ) : fideliteRecu.prochainPalierDistance != null ? (
              <div>Plus que {fmt(fideliteRecu.prochainPalierDistance)} F avant ton prochain bonus</div>
            ) : null}
          </div>
        )}
{vente.typeVente === "Credit" && (
          <div className="mt-1 space-y-1">
            <div className="flex justify-between gap-2 text-xs" style={{ color: "#6B5D52" }}><span>Paye</span><span className="whitespace-nowrap">{fmt(totalPayeRecu)} F</span></div>
            <div className="flex justify-between gap-2 text-xs font-semibold" style={{ color: "#B04A3B" }}><span>Reste a payer</span><span className="whitespace-nowrap">{fmt(vente.total - totalPayeRecu)} F</span></div>
          </div>
        )}
        <div className="mt-2 space-y-1">
          {vente.paiements.map((p) => <div key={p.id} className="flex justify-between gap-2 text-xs" style={{ color: "#6B5D52" }}><span>{MODES_PAIEMENT.find((m) => m.id === p.mode)?.label}</span><span className="whitespace-nowrap">{fmt(p.montant)} F</span></div>)}
          {vente.monnaieRendue > 0 && <div className="flex justify-between gap-2 text-xs font-medium" style={{ color: "#3F6B4A" }}><span>Monnaie rendue</span><span className="whitespace-nowrap">{fmt(vente.monnaieRendue)} F</span></div>}
        </div>

        <div style={{ borderTop: "1px dashed #DDD3C4" }} className="mt-3 pt-3">
          <p className="text-xs text-center whitespace-pre-line leading-relaxed" style={{ color: "#6B5D52" }}>{MESSAGE_FIN_TICKET}</p>
        </div>

        <div className="no-print flex gap-2 mt-5">
          <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", fontFamily: "'Inter', sans-serif" }}><Printer size={15} /> Imprimer</button>
          {WHATSAPP_RECU_ACTIF && numeroWA && (
            <button onClick={envoyerSurWhatsApp} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#25D366", color: "#FFFFFF", fontFamily: "'Inter', sans-serif" }}>
              <MessageCircle size={15} /> WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RemisesAdminSection({ onTraite }) {
  const [vue, setVue] = useState("EN_ATTENTE"); // "EN_ATTENTE" | "REFUSEE"
  const [demandes, setDemandes] = useState([]);
  const [error, setError] = useState("");
  const [traitementId, setTraitementId] = useState(null);

  const load = useCallback(async () => {
    try { setDemandes(await api.remises.list(vue)); } catch (e) { setError(e.message); }
  }, [vue]);
  useEffect(() => {
    load();
    // L'actualisation automatique n'a d'intérêt que sur les demandes en attente — la liste des
    // refusées ne bouge pas toute seule.
    if (vue !== "EN_ATTENTE") return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load, vue]);

  const traiter = async (demande, statut) => {
    setTraitementId(demande.id);
    try {
      await api.remises.traiter(demande.id, statut);
      setDemandes((d) => d.filter((x) => x.id !== demande.id));
      onTraite?.();
    } catch (e) { setError(e.message); } finally { setTraitementId(null); }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {[["EN_ATTENTE", "En attente"], ["APPROUVEE", "Approuvées"], ["REFUSEE", "Refusées"]].map(([id, label]) => (
          <button key={id} onClick={() => setVue(id)} className="px-4 py-2 rounded-full text-sm font-medium"
            style={vue === id ? { background: "#2B2320", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52", border: "1px solid #DDD3C4" }}>
            {label}
          </button>
        ))}
      </div>
      {vue === "EN_ATTENTE" && <p className="text-sm mb-4" style={{ color: "#6B5D52" }}>Cette liste se met a jour automatiquement toutes les 5 secondes.</p>}
      {vue === "APPROUVEE" && <p className="text-sm mb-4" style={{ color: "#6B5D52" }}>Corrections de CA déjà appliquées — le CA du jour de la vente a été ajusté à la baisse (pas celui du jour d'approbation). Pense à reporter chaque ajustement dans ta comptabilité sur la bonne date.</p>}
      {vue === "REFUSEE" && <p className="text-sm mb-4" style={{ color: "#6B5D52" }}>Historique des remises refusées — utile pour retrouver un écart en caisse resté à régulariser manuellement.</p>}
      {error && <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ background: "#FBEAE7", color: "#8C3B2E" }}>{error}</p>}
      {demandes.length === 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>{vue === "EN_ATTENTE" ? "Aucune demande en attente pour le moment." : vue === "APPROUVEE" ? "Aucune remise approuvée pour l'instant." : "Aucune remise refusée."}</p>}
      <div className="space-y-3">
        {demandes.map((d) => (
          <div key={d.id} className="rounded-xl p-4 flex items-center justify-between flex-wrap gap-3" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
            <div>
              <p className="font-mono text-sm font-medium">{d.numero} · {d.boutique}</p>
              <p className="text-xs" style={{ color: "#6B5D52" }}>
                Demandee par {d.demandePar?.prenom} {d.demandePar?.nom}{d.clientNom ? ` · Client : ${d.clientNom}` : ""}
              </p>
              <p className="text-xs mt-1" style={{ color: "#6B5D52" }}>
                Panier {fmt(d.totalVente)} F · Remise demandee : {d.type === "POURCENTAGE" ? `${d.valeur}%` : `${fmt(d.valeur)} F`} → <strong style={{ color: "#8C3B2E" }}>-{fmt(d.montantRemise)} F</strong>
              </p>
              {vue === "REFUSEE" && (
                <p className="text-xs mt-1" style={{ color: "#B04A3B" }}>
                  Refusée le {new Date(d.dateTraitement).toLocaleString("fr-FR")} par {d.traitePar?.prenom} {d.traitePar?.nom} — le CA de la vente est resté au plein tarif, l'écart en caisse (le cas échéant) reste à régulariser manuellement
                </p>
              )}
              {vue === "APPROUVEE" && (
                <p className="text-xs mt-1" style={{ color: "#3F6B4A" }}>
                  Approuvée le {new Date(d.dateTraitement).toLocaleString("fr-FR")} par {d.traitePar?.prenom} {d.traitePar?.nom} — le CA a été corrigé sur le jour de la vente ci-dessous, pas sur celui-ci
                </p>
              )}
              {d.vente ? (
                <p className="text-xs mt-1" style={{ color: "#3F6B4A" }}>
                  Vente {d.vente.numero} du {new Date(d.vente.date).toLocaleDateString("fr-FR")}{vue === "EN_ATTENTE" ? " — après approbation, vérifier le CA de ce jour-là dans États → Par date (pas \"aujourd'hui\" si la vente date d'un autre jour)" : ""}
                </p>
              ) : d.retour ? (
                <p className="text-xs mt-1" style={{ color: "#3F6B4A" }}>
                  Supplément d'échange sur la vente {d.retour.vente?.numero || "—"} du {new Date(d.retour.date).toLocaleDateString("fr-FR")}{vue === "EN_ATTENTE" ? " — le montant réduit a déjà été encaissé, approuver ou refuser sert ici uniquement de trace pour toi" : ""}
                </p>
              ) : (
                <p className="text-xs mt-1" style={{ color: "#6B5D52", fontStyle: "italic" }}>
                  Ancienne demande sans vente rattachée — approuver ou refuser n'aura aucun impact sur le CA
                </p>
              )}
            </div>
            {vue === "EN_ATTENTE" && (
              <div className="flex gap-2">
                <button onClick={() => traiter(d, "REFUSEE")} disabled={traitementId === d.id} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ border: "1px solid #DDD3C4", color: "#B04A3B" }}>Refuser</button>
                <button onClick={() => traiter(d, "APPROUVEE")} disabled={traitementId === d.id} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#3F6B4A", color: "#F3F7F3" }}>Approuver</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RetoursSection({ ventes, articles, boutique, onDone }) {
  const [numero, setNumero] = useState("");
  const [venteChoisie, setVenteChoisie] = useState(null);
  const [ligneChoisie, setLigneChoisie] = useState("");
  const [type, setType] = useState("Retour");
  const [quantite, setQuantite] = useState(1);
  const [modeEchange, setModeEchange] = useState("pointure"); // "pointure" | "article"
  const [remiseFormOuvert, setRemiseFormOuvert] = useState(false);
  const [remiseType, setRemiseType] = useState("MONTANT");
  const [remiseValeur, setRemiseValeur] = useState("");
  const [remiseChargement, setRemiseChargement] = useState(false);
  const [demandeRemiseEchange, setDemandeRemiseEchange] = useState(null);
  const [nouvellePointure, setNouvellePointure] = useState("");
  const [rechercheNouvelArticle, setRechercheNouvelArticle] = useState("");
  const [nouvelArticle, setNouvelArticle] = useState(null);
  const [motif, setMotif] = useState("");
  const [montantRembourse, setMontantRembourse] = useState("");
  const [dateValiditeAvoir, setDateValiditeAvoir] = useState("");
  const [paiementsSupplement, setPaiementsSupplement] = useState([{ id: uid(), mode: "especes", montant: "" }]);
  const [error, setError] = useState("");
  const [succes, setSucces] = useState("");
  const [recuOperation, setRecuOperation] = useState(null);
  const [recuAImprimer, setRecuAImprimer] = useState(null);

  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const rechercherVente = async () => {
    if (!numero.trim()) return;
    setRechercheEnCours(true);
    setError(""); setVenteChoisie(null); setRecuOperation(null);
    try {
      const v = await api.ventes.rechercheParNumero(numero.trim());
      setVenteChoisie(v);
    } catch (e) { setError(e.message); } finally { setRechercheEnCours(false); }
  };

  // Recherche alternative par nom ou téléphone, pour une cliente qui n'a pas gardé son reçu —
  // affiche tout son historique d'achats, puis on choisit la bonne vente dedans.
  const [modeRecherche, setModeRecherche] = useState("numero"); // "numero" | "client"
  const [rechercheClient, setRechercheClient] = useState("");
  const [clientsTrouves, setClientsTrouves] = useState([]);
  const [clientChoisi, setClientChoisi] = useState(null);
  const [ventesClient, setVentesClient] = useState([]);
  const rechercherClient = async () => {
    if (!rechercheClient.trim()) return;
    setRechercheEnCours(true);
    setError(""); setVenteChoisie(null); setRecuOperation(null); setClientChoisi(null); setVentesClient([]);
    try {
      const trouves = await api.clients.rechercheMulti(rechercheClient.trim());
      if (trouves.length === 0) { setClientsTrouves([]); setError("Aucune cliente ne correspond à cette recherche."); return; }
      if (trouves.length === 1) { await choisirClientHistorique(trouves[0]); return; }
      setClientsTrouves(trouves);
    } catch (e) { setError(e.message); } finally { setRechercheEnCours(false); }
  };
  const choisirClientHistorique = async (c) => {
    setRechercheEnCours(true);
    try {
      const complet = await api.clients.historiqueAchats(c.id);
      setClientChoisi(complet);
      setVentesClient(complet.ventes.filter((v) => v.statut !== "Annulee"));
      setClientsTrouves([]);
    } catch (e) { setError(e.message); } finally { setRechercheEnCours(false); }
  };
  const ligne = venteChoisie?.lignes.find((l) => l.id === ligneChoisie);

  useEffect(() => {
    if (type === "Retour" && ligne) {
      setMontantRembourse(String(ligne.prixUnitaire * Math.max(1, parseInt(quantite, 10) || 1)));
    }
  }, [type, ligne, quantite]);

  const resultatsArticles = rechercheNouvelArticle.trim()
    ? (articles || []).filter((a) => a.actif !== false && (a.designation.toLowerCase().includes(rechercheNouvelArticle.trim().toLowerCase()) || a.reference.toLowerCase().includes(rechercheNouvelArticle.trim().toLowerCase()))).slice(0, 8)
    : [];

  const qte = Math.max(1, parseInt(quantite, 10) || 1);
  const difference = modeEchange === "article" && nouvelArticle && ligne ? (nouvelArticle.prixVente - ligne.prixUnitaire) * qte : 0;
  const montantRemiseAppliqueEchange = demandeRemiseEchange && demandeRemiseEchange.statut !== "REFUSEE" ? demandeRemiseEchange.montantRemise : 0;
  const supplementApresRemise = Math.max(0, difference - montantRemiseAppliqueEchange);

  const demanderRemiseEchange = async () => {
    if (!remiseValeur || Number(remiseValeur) <= 0) { setError("Indique une valeur de remise valide."); return; }
    if (remiseType === "POURCENTAGE" && Number(remiseValeur) > 100) { setError("Un pourcentage ne peut pas dépasser 100."); return; }
    setRemiseChargement(true);
    try {
      const demande = await api.remises.create({
        totalVente: difference, type: remiseType, valeur: Number(remiseValeur),
        clientNom: venteChoisie?.client?.nomPrenoms || clientChoisi?.nomPrenoms || undefined,
      });
      setDemandeRemiseEchange(demande);
      setRemiseFormOuvert(false); setRemiseValeur(""); setError("");
    } catch (e) { setError(e.message); } finally { setRemiseChargement(false); }
  };

  // Un avoir est valable 21 jours par défaut — pré-rempli, mais modifiable au cas par cas.
  useEffect(() => {
    const doitAvoirUneDate = (type === "Retour" && ligne) || (type === "Echange" && modeEchange === "article" && difference < 0);
    if (doitAvoirUneDate && !dateValiditeAvoir) {
      const d = new Date(); d.setDate(d.getDate() + 21);
      setDateValiditeAvoir(d.toISOString().slice(0, 10));
    }
  }, [type, ligne, modeEchange, difference]);

  const ajouterPaiementSupplement = () => setPaiementsSupplement([...paiementsSupplement, { id: uid(), mode: "especes", montant: "" }]);
  const majPaiementSupplement = (id, champ, val) => setPaiementsSupplement(paiementsSupplement.map((p) => (p.id === id ? { ...p, [champ]: val } : p)));
  const retirerPaiementSupplement = (id) => setPaiementsSupplement(paiementsSupplement.filter((p) => p.id !== id));
  const totalPaiementSupplement = paiementsSupplement.reduce((s, p) => s + (Number(p.montant) || 0), 0);

  const resetTout = () => {
    setVenteChoisie(null); setLigneChoisie(""); setNumero(""); setMotif(""); setQuantite(1);
    setModeEchange("pointure"); setNouvellePointure(""); setRechercheNouvelArticle(""); setNouvelArticle(null);
    setMontantRembourse(""); setDateValiditeAvoir(""); setPaiementsSupplement([{ id: uid(), mode: "especes", montant: "" }]);
    setRechercheClient(""); setClientsTrouves([]); setClientChoisi(null); setVentesClient([]);
    setRemiseFormOuvert(false); setRemiseValeur(""); setDemandeRemiseEchange(null);
  };

  const submit = async () => {
    if (!venteChoisie || !ligneChoisie) { setError("Choisis la vente et la ligne concernee."); return; }
    if (type === "Retour") {
      if (!venteChoisie.clientId) { setError("Un client doit etre associe a cette vente pour generer un avoir. Ajoute d'abord le client sur la vente."); return; }
      if (!montantRembourse) { setError("Le montant de l'avoir est obligatoire."); return; }
      if (!dateValiditeAvoir) { setError("La date de validite de l'avoir est obligatoire."); return; }
    }
    if (type === "Echange") {
      if (!nouvellePointure) { setError("Choisis la pointure du nouvel article."); return; }
      if (modeEchange === "article") {
        if (!nouvelArticle) { setError("Choisis le nouvel article."); return; }
        if (difference > 0 && totalPaiementSupplement !== supplementApresRemise) { setError(`Le supplément dû est de ${fmt(supplementApresRemise)} F — le paiement doit couvrir exactement ce montant.`); return; }
        if (difference < 0) {
          if (!venteChoisie.clientId) { setError("Un client doit etre associe a cette vente pour generer un avoir."); return; }
          if (!dateValiditeAvoir) { setError("La date de validite de l'avoir (pour la difference en sa faveur) est obligatoire."); return; }
        }
      }
    }
    const clientNomAvantReset = venteChoisie.client?.nomPrenoms || clientChoisi?.nomPrenoms || "Client de passage";
    const venteOrigineNumero = venteChoisie.numero;
    try {
      const retourCree = await api.retours.create({
        venteId: venteChoisie.id, ligneVenteId: ligneChoisie, type, quantite: Number(quantite),
        nouvellePointure: type === "Echange" ? nouvellePointure : undefined,
        nouvelArticleId: type === "Echange" && modeEchange === "article" ? nouvelArticle.id : undefined,
        paiements: type === "Echange" && modeEchange === "article" && difference > 0
          ? paiementsSupplement.filter((p) => Number(p.montant) > 0).map((p) => ({ mode: p.mode, montant: Number(p.montant) })) : undefined,
        demandeRemiseId: type === "Echange" && modeEchange === "article" && difference > 0 && demandeRemiseEchange && demandeRemiseEchange.statut !== "REFUSEE" ? demandeRemiseEchange.id : undefined,
        motif, boutique,
        montantRembourse: type === "Retour" ? Number(montantRembourse) : undefined,
        dateValiditeAvoir: type === "Retour" ? dateValiditeAvoir : (type === "Echange" && difference < 0 ? dateValiditeAvoir : undefined),
      });
      setRecuOperation({ retour: retourCree, venteOrigineNumero, clientNom: clientNomAvantReset, boutique });
      setSucces(""); setError("");
      resetTout();
      onDone();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="max-w-lg">
      {recuOperation && (
        <div className="mb-4 px-4 py-3 rounded-lg" style={{ background: "#E9F0EA", color: "#3F6B4A" }}>
          <p className="font-semibold mb-1">{recuOperation.retour.type === "Retour" ? "Retour enregistré" : "Échange enregistré"}</p>
          {recuOperation.retour.bonValeurGenere && (
            <>
              <p className="text-sm">Avoir généré n° <span className="font-mono font-semibold">{recuOperation.retour.bonValeurGenere.numero}</span> — <span className="font-semibold">{fmt(recuOperation.retour.bonValeurGenere.montant)} F</span></p>
              <p className="text-sm">Valable jusqu'au : <span className="font-semibold">{new Date(recuOperation.retour.bonValeurGenere.dateValidite).toLocaleDateString("fr-FR")}</span></p>
            </>
          )}
          {recuOperation.retour.supplementPaye > 0 && (
            <p className="text-sm">Supplément payé par la cliente : <span className="font-semibold">{fmt(recuOperation.retour.supplementPaye)} F</span></p>
          )}
          <button onClick={() => setRecuAImprimer(recuOperation)} className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#3F6B4A", color: "#F3F7F3" }}><Printer size={14} /> Imprimer le reçu</button>
        </div>
      )}
      {succes && <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ background: "#E9F0EA", color: "#3F6B4A" }}>{succes}</p>}
      {error && <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ background: "#FBEAE7", color: "#8C3B2E" }}>{error}</p>}

      <div className="flex gap-2 mb-3">
        {[["numero", "Par numéro de reçu"], ["client", "Par nom ou téléphone"]].map(([id, label]) => (
          <button key={id} onClick={() => { setModeRecherche(id); setError(""); setVenteChoisie(null); setRecuOperation(null); setClientsTrouves([]); setClientChoisi(null); setVentesClient([]); }} className="text-xs px-3 py-1.5 rounded-full font-medium" style={modeRecherche === id ? { background: "#8C3B2E", color: "#FBF3EC" } : { border: "1px solid #DDD3C4", color: "#6B5D52" }}>{label}</button>
        ))}
      </div>

      {modeRecherche === "numero" ? (
        <>
          <Field label="Numero de recu">
            <div className="flex gap-2">
              <input value={numero} onChange={(e) => { setNumero(e.target.value); setVenteChoisie(null); setRecuOperation(null); }} onKeyDown={(e) => e.key === "Enter" && rechercherVente()} style={inputStyle} placeholder="REC-000123" />
              <button onClick={rechercherVente} disabled={rechercheEnCours} className="px-4 rounded-lg text-sm font-medium whitespace-nowrap" style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: rechercheEnCours ? 0.6 : 1 }}>{rechercheEnCours ? "..." : "Rechercher"}</button>
            </div>
          </Field>
          <p className="text-xs -mt-2 mb-3" style={{ color: "#6B5D52" }}>Fonctionne pour un reçu de n'importe quel jour — tape le numéro complet.</p>
        </>
      ) : (
        <>
          <Field label="Nom ou téléphone de la cliente">
            <div className="flex gap-2">
              <input value={rechercheClient} onChange={(e) => setRechercheClient(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rechercherClient()} style={inputStyle} placeholder="Ex : Konan Awa, ou 0708735901" />
              <button onClick={rechercherClient} disabled={rechercheEnCours} className="px-4 rounded-lg text-sm font-medium whitespace-nowrap" style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: rechercheEnCours ? 0.6 : 1 }}>{rechercheEnCours ? "..." : "Rechercher"}</button>
            </div>
          </Field>
          <p className="text-xs -mt-2 mb-3" style={{ color: "#6B5D52" }}>Utile quand la cliente n'a pas gardé son reçu — affiche tout son historique d'achats.</p>

          {clientsTrouves.length > 0 && (
            <div className="rounded-lg overflow-hidden mb-3" style={{ border: "1px solid #DDD3C4" }}>
              <p className="text-xs px-3 py-2" style={{ background: "#F1E9DC", color: "#6B5D52" }}>{clientsTrouves.length} cliente(s) trouvée(s) — choisis-en une :</p>
              {clientsTrouves.map((c) => (
                <button key={c.id} onClick={() => choisirClientHistorique(c)} className="w-full text-left px-3 py-2 text-sm" style={{ background: "#FFFFFF", borderTop: "1px solid #EFE7D9" }}>
                  {c.nomPrenoms} <span style={{ color: "#6B5D52" }}>{c.telephone ? `· ${c.telephone}` : ""}</span>
                </button>
              ))}
            </div>
          )}

          {clientChoisi && !venteChoisie && (
            <div className="rounded-lg overflow-hidden mb-3" style={{ border: "1px solid #DDD3C4" }}>
              <div className="flex items-center justify-between px-3 py-2" style={{ background: "#F1E9DC" }}>
                <p className="text-xs font-medium">{clientChoisi.nomPrenoms} — {ventesClient.length} achat(s)</p>
                <button onClick={() => { setClientChoisi(null); setVentesClient([]); }} style={{ color: "#B04A3B" }}><X size={14} /></button>
              </div>
              {ventesClient.length === 0 && <p className="text-sm px-3 py-2" style={{ color: "#6B5D52" }}>Aucun achat trouvé pour cette cliente.</p>}
              {ventesClient.map((v) => (
                <button key={v.id} onClick={() => setVenteChoisie(v)} className="w-full text-left px-3 py-2 text-sm" style={{ background: "#FFFFFF", borderTop: "1px solid #EFE7D9" }}>
                  {v.numero} · {new Date(v.date).toLocaleDateString("fr-FR")} — {fmt(v.total)} F ({v.boutique})
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {venteChoisie && modeRecherche === "client" && (
        <p className="text-xs mb-3 flex items-center gap-2" style={{ color: "#6B5D52" }}>
          Vente sélectionnée : <strong>{venteChoisie.numero}</strong>
          <button onClick={() => setVenteChoisie(null)} style={{ color: "#B04A3B" }}>changer</button>
        </p>
      )}

      {venteChoisie && (
        <>
          <Field label="Article concerne">
            <select value={ligneChoisie} onChange={(e) => setLigneChoisie(e.target.value)} style={inputStyle}>
              <option value="">— Choisir —</option>
              {venteChoisie.lignes.map((l) => <option key={l.id} value={l.id}>{l.designation}{l.pointure ? ` T${l.pointure}` : ""} (×{l.quantite})</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}><option>Retour</option><option>Echange</option></select></Field>
            <Field label="Quantite"><input type="number" min="1" max={ligne?.quantite || 1} value={quantite} onChange={(e) => setQuantite(e.target.value)} style={inputStyle} /></Field>
          </div>

          {type === "Echange" && (
            <>
              <div className="flex gap-2 my-2">
                {[["pointure", "Meme article, autre pointure"], ["article", "Article different"]].map(([id, label]) => (
                  <button key={id} onClick={() => { setModeEchange(id); setNouvelArticle(null); setNouvellePointure(""); }} className="text-xs px-3 py-1.5 rounded-full font-medium" style={modeEchange === id ? { background: "#8C3B2E", color: "#FBF3EC" } : { border: "1px solid #DDD3C4", color: "#6B5D52" }}>{label}</button>
                ))}
              </div>

              {modeEchange === "article" && (
                <div className="rounded-lg p-3 mb-2" style={{ background: "#F1E9DC" }}>
                  {!nouvelArticle ? (
                    <div className="relative">
                      <input value={rechercheNouvelArticle} onChange={(e) => setRechercheNouvelArticle(e.target.value)} placeholder="Rechercher le nouvel article…" style={{ ...inputStyle, marginTop: 0 }} />
                      {resultatsArticles.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2", maxHeight: "200px", overflowY: "auto" }}>
                          {resultatsArticles.map((a) => (
                            <button key={a.id} onClick={() => { setNouvelArticle(a); setRechercheNouvelArticle(""); setNouvellePointure(""); }} className="w-full text-left px-3 py-2 text-sm" style={{ borderTop: "1px solid #EFE7D9" }}>
                              {a.designation} <span style={{ color: "#6B5D52" }}>({a.reference}) — {fmt(a.prixVente)} F</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-sm">
                      <span>{nouvelArticle.designation} — {fmt(nouvelArticle.prixVente)} F</span>
                      <button onClick={() => { setNouvelArticle(null); setNouvellePointure(""); }} style={{ color: "#B04A3B" }}><X size={14} /></button>
                    </div>
                  )}
                </div>
              )}

              <Field label={modeEchange === "article" ? "Pointure du nouvel article" : "Nouvelle pointure"}>
                <select value={nouvellePointure} onChange={(e) => setNouvellePointure(e.target.value)} style={inputStyle}>
                  <option value="">— Choisir —</option>{POINTURES.map((p) => <option key={p} value={p}>T{p}</option>)}
                </select>
              </Field>

              {modeEchange === "article" && nouvelArticle && ligne && (
                <div className="rounded-lg p-3 mb-2" style={{ background: difference === 0 ? "#F1E9DC" : difference > 0 ? "#FBEAE7" : "#E9F0EA" }}>
                  <p className="text-sm font-medium" style={{ color: difference === 0 ? "#6B5D52" : difference > 0 ? "#B04A3B" : "#3F6B4A" }}>
                    {difference === 0 && "Même prix — aucun complément à gérer."}
                    {difference > 0 && `Le nouvel article coûte ${fmt(difference)} F de plus — à faire payer (jamais remboursé en espèces).`}
                    {difference < 0 && `La cliente a ${fmt(-difference)} F en sa faveur — un avoir sera généré (jamais remboursé en espèces).`}
                  </p>

                  {difference > 0 && (
                    <div className="mt-3">
                      {!demandeRemiseEchange && !remiseFormOuvert && (
                        <button onClick={() => setRemiseFormOuvert(true)} className="flex items-center gap-1.5 text-xs font-medium mb-3" style={{ color: "#8C3B2E" }}>
                          <Percent size={13} /> Appliquer une remise sur ce supplément
                        </button>
                      )}
                      {!demandeRemiseEchange && remiseFormOuvert && (
                        <div className="rounded-lg p-3 mb-3" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
                          <div className="flex gap-2 mb-2">
                            <button type="button" onClick={() => setRemiseType("MONTANT")} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium" style={remiseType === "MONTANT" ? { background: "#8C3B2E", color: "#FBF3EC" } : { border: "1px solid #DDD3C4", color: "#6B5D52" }}>Montant (F)</button>
                            <button type="button" onClick={() => setRemiseType("POURCENTAGE")} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium" style={remiseType === "POURCENTAGE" ? { background: "#8C3B2E", color: "#FBF3EC" } : { border: "1px solid #DDD3C4", color: "#6B5D52" }}>Pourcentage (%)</button>
                          </div>
                          <input type="number" min="0" value={remiseValeur} onChange={(e) => setRemiseValeur(e.target.value)} placeholder={remiseType === "MONTANT" ? "Ex : 5000" : "Ex : 10"} style={{ ...inputStyle, marginTop: 0 }} />
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => { setRemiseFormOuvert(false); setRemiseValeur(""); }} className="flex-1 px-3 py-1.5 rounded-lg text-xs" style={{ color: "#6B5D52" }}>Annuler</button>
                            <button onClick={demanderRemiseEchange} disabled={remiseChargement} className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>{remiseChargement ? "Envoi..." : "Envoyer à Djenie"}</button>
                          </div>
                        </div>
                      )}
                      {demandeRemiseEchange?.statut === "EN_ATTENTE" && (
                        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-3" style={{ background: "#FFFFFF", color: "#6B5D52" }}>
                          <Clock size={13} /> Remise en attente de validation par Djenie ({demandeRemiseEchange.numero}) — la cliente peut déjà payer le montant réduit
                        </div>
                      )}
                      {demandeRemiseEchange?.statut === "APPROUVEE" && (
                        <div className="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg mb-3" style={{ background: "#E9F0EA", color: "#3F6B4A" }}>
                          <span className="flex items-center gap-1.5"><CheckCircle2 size={13} /> Remise approuvée : - {fmt(demandeRemiseEchange.montantRemise)} F</span>
                          <button onClick={() => setDemandeRemiseEchange(null)} style={{ color: "#B04A3B" }}><X size={13} /></button>
                        </div>
                      )}
                      {demandeRemiseEchange?.statut === "REFUSEE" && (
                        <div className="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg mb-3" style={{ background: "#FBEAE7", color: "#8C3B2E" }}>
                          <span className="flex items-center gap-1.5"><XCircle size={13} /> Remise refusée par Djenie</span>
                          <button onClick={() => setDemandeRemiseEchange(null)} style={{ color: "#8C3B2E" }}><X size={13} /></button>
                        </div>
                      )}
                      {paiementsSupplement.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 mb-2">
                          <select value={p.mode} onChange={(e) => majPaiementSupplement(p.id, "mode", e.target.value)} style={{ ...inputStyle, marginTop: 0, flex: 1 }}>
                            {MODES_PAIEMENT.filter((m) => m.id !== "bon_achat" && m.id !== "avoir").map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                          </select>
                          <input type="number" value={p.montant} onChange={(e) => majPaiementSupplement(p.id, "montant", e.target.value)} placeholder="Montant" style={{ ...inputStyle, marginTop: 0, width: "120px" }} />
                          {paiementsSupplement.length > 1 && <button onClick={() => retirerPaiementSupplement(p.id)} style={{ color: "#B04A3B" }}><X size={14} /></button>}
                        </div>
                      ))}
                      <button onClick={ajouterPaiementSupplement} className="text-xs" style={{ color: "#8C3B2E" }}>+ Ajouter un mode de paiement</button>
                      <p className="text-xs mt-2" style={{ color: totalPaiementSupplement === supplementApresRemise ? "#3F6B4A" : "#B04A3B" }}>Payé : {fmt(totalPaiementSupplement)} F / {fmt(supplementApresRemise)} F attendu</p>
                    </div>
                  )}
                  {difference < 0 && (
                    <Field label="Date de validite de l'avoir"><input type="date" value={dateValiditeAvoir} onChange={(e) => setDateValiditeAvoir(e.target.value)} style={inputStyle} /></Field>
                  )}
                </div>
              )}
            </>
          )}

          {type === "Retour" && (
            <div className="rounded-lg p-3 mt-1 mb-1" style={{ background: "#F1E9DC" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "#6B5D52" }}>Un avoir sera genere automatiquement pour la cliente — aucun remboursement en especes.</p>
              {!venteChoisie.clientId && (
                <p className="text-xs mb-2" style={{ color: "#B04A3B" }}>Cette vente n'a pas de client associe : l'avoir ne pourra pas etre cree.</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Montant de l'avoir (F CFA)"><input type="number" min="0" value={montantRembourse} onChange={(e) => setMontantRembourse(e.target.value)} style={inputStyle} /></Field>
                <Field label="Date de validite de l'avoir"><input type="date" value={dateValiditeAvoir} onChange={(e) => setDateValiditeAvoir(e.target.value)} style={inputStyle} /></Field>
              </div>
              <p className="text-xs mt-2" style={{ color: "#6B5D52" }}>Montant pre-rempli selon le prix de l'article — modifiable si besoin.</p>
            </div>
          )}
          <Field label="Motif (optionnel)"><input value={motif} onChange={(e) => setMotif(e.target.value)} style={inputStyle} /></Field>
          <button onClick={submit} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}><RotateCcw size={15} /> Enregistrer {type === "Retour" ? "le retour" : "l'échange"}</button>
        </>
      )}

      {recuAImprimer && <RetourEchangeReceiptModal recu={recuAImprimer} onClose={() => setRecuAImprimer(null)} />}
    </div>
  );
}

function AvoirReceiptModal({ avoir, boutique, clientNom, onClose }) {
  const infos = INFOS_BOUTIQUE[boutique] || {};
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
      <div className="print-area rounded-xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto" style={{ background: "#FFFDF9", fontFamily: "'IBM Plex Mono', monospace" }}>
        <div className="flex items-center justify-between mb-4 no-print"><p className="font-display font-semibold">Bon d'avoir</p><button onClick={onClose}><X size={18} color="#6B5D52" /></button></div>

        <div className="text-center mb-3">
          <p className="font-display font-bold text-sm leading-tight">{infos.nom}</p>
          <p className="font-display font-bold text-sm leading-tight">{infos.ligne2}</p>
          <p className="text-xs mt-1" style={{ color: "#6B5D52" }}>{infos.adresse}</p>
          <p className="text-xs" style={{ color: "#6B5D52" }}>{infos.telephone}</p>
        </div>
        <div style={{ borderTop: "1px dashed #DDD3C4" }} className="my-2" />

        <p className="text-center font-display text-lg font-semibold">BON D'AVOIR</p>
        <p className="text-center font-mono text-base font-semibold mt-1">{avoir.numero}</p>
        <p className="text-center text-xs mb-4" style={{ color: "#6B5D52" }}>Emis le {new Date(avoir.createdAt || Date.now()).toLocaleDateString("fr-FR")}</p>

        <div style={{ borderTop: "1px dashed #DDD3C4", borderBottom: "1px dashed #DDD3C4" }} className="py-3 space-y-2">
          <div className="flex justify-between text-sm"><span style={{ color: "#6B5D52" }}>Client</span><span className="font-medium">{clientNom || "—"}</span></div>
          <div className="flex justify-between text-sm"><span style={{ color: "#6B5D52" }}>Montant</span><span className="font-semibold">{fmt(avoir.montant)} F</span></div>
          <div className="flex justify-between text-sm"><span style={{ color: "#6B5D52" }}>Valable jusqu'au</span><span className="font-medium">{new Date(avoir.dateValidite).toLocaleDateString("fr-FR")}</span></div>
        </div>

        <div className="mt-3 pt-3">
          <p className="text-xs text-center whitespace-pre-line leading-relaxed" style={{ color: "#6B5D52" }}>
            Ce bon est valable chez La Maison du Cuir by Anaïs, en une seule fois, jusqu'a sa date de validite. Il doit etre presente en caisse — numero obligatoire pour l'utiliser.
          </p>
        </div>

        <button onClick={() => window.print()} className="no-print w-full mt-5 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", fontFamily: "'Inter', sans-serif" }}><Printer size={15} /> Imprimer</button>
      </div>
    </div>
  );
}

// Reçu unique couvrant les trois cas : échange simple (même article, autre pointure), échange
// vers un article différent (avec supplément ou avoir selon l'écart de prix), et retour classique.
function RetourEchangeReceiptModal({ recu, onClose }) {
  const { retour, venteOrigineNumero, clientNom, boutique } = recu;
  const infos = INFOS_BOUTIQUE[boutique] || {};
  const estEchange = retour.type === "Echange";
  const nouvelArticleDesignation = retour.nouvelArticle ? retour.nouvelArticle.designation : retour.ligneVente?.designation;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
      <div className="print-area rounded-xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto" style={{ background: "#FFFDF9", fontFamily: "'IBM Plex Mono', monospace" }}>
        <div className="flex items-center justify-between mb-4 no-print"><p className="font-display font-semibold">Reçu {estEchange ? "d'échange" : "de retour"}</p><button onClick={onClose}><X size={18} color="#6B5D52" /></button></div>

        <div className="text-center mb-3">
          <p className="font-display font-bold text-sm leading-tight">{infos.nom}</p>
          <p className="font-display font-bold text-sm leading-tight">{infos.ligne2}</p>
          <p className="text-xs mt-1" style={{ color: "#6B5D52" }}>{infos.adresse}</p>
          <p className="text-xs" style={{ color: "#6B5D52" }}>{infos.telephone}</p>
        </div>
        <div style={{ borderTop: "1px dashed #DDD3C4" }} className="my-2" />

        <p className="text-center font-display text-lg font-semibold">{estEchange ? "REÇU D'ÉCHANGE" : "REÇU DE RETOUR"}</p>
        <p className="text-center text-xs mb-1" style={{ color: "#6B5D52" }}>Vente d'origine : {venteOrigineNumero}</p>
        <p className="text-center text-xs mb-4" style={{ color: "#6B5D52" }}>{new Date(retour.date).toLocaleString("fr-FR")}</p>

        <div style={{ borderTop: "1px dashed #DDD3C4" }} className="py-2 space-y-2">
          <div className="flex justify-between text-sm"><span style={{ color: "#6B5D52" }}>Client</span><span className="font-medium">{clientNom || "—"}</span></div>
        </div>

        <div style={{ borderTop: "1px dashed #DDD3C4" }} className="py-3">
          <p className="text-xs font-semibold mb-1" style={{ color: "#6B5D52" }}>Article rendu</p>
          <p className="text-sm">{retour.ligneVente?.designation}{retour.ligneVente?.pointure ? ` T${retour.ligneVente.pointure}` : ""} × {retour.quantite}</p>
        </div>

        {estEchange && (
          <div style={{ borderTop: "1px dashed #DDD3C4" }} className="py-3">
            <p className="text-xs font-semibold mb-1" style={{ color: "#6B5D52" }}>Article reçu en échange</p>
            <p className="text-sm">{nouvelArticleDesignation}{retour.nouvellePointure ? ` T${retour.nouvellePointure}` : ""} × {retour.quantite}</p>
          </div>
        )}

        {retour.supplementPaye > 0 && (
          <div style={{ borderTop: "1px dashed #DDD3C4" }} className="py-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: "#6B5D52" }}>Supplément payé</span>
              <span className="font-semibold">{fmt(retour.supplementPaye)} F</span>
            </div>
            {retour.demandeRemise && (
              <p className="text-xs mt-1" style={{ color: "#6B5D52" }}>
                Remise appliquée ({retour.demandeRemise.numero}) — {retour.demandeRemise.statut === "APPROUVEE" ? "approuvée" : retour.demandeRemise.statut === "REFUSEE" ? "refusée" : "en attente de validation par Djenie"}
              </p>
            )}
          </div>
        )}

        {retour.bonValeurGenere && (
          <div style={{ borderTop: "1px dashed #DDD3C4", borderBottom: "1px dashed #DDD3C4" }} className="py-3 space-y-1">
            <p className="text-xs font-semibold" style={{ color: "#6B5D52" }}>Avoir généré</p>
            <div className="flex justify-between text-sm"><span style={{ color: "#6B5D52" }}>Numéro</span><span className="font-mono font-semibold">{retour.bonValeurGenere.numero}</span></div>
            <div className="flex justify-between text-sm"><span style={{ color: "#6B5D52" }}>Montant</span><span className="font-semibold">{fmt(retour.bonValeurGenere.montant)} F</span></div>
            <div className="flex justify-between text-sm"><span style={{ color: "#6B5D52" }}>Valable jusqu'au</span><span className="font-medium">{new Date(retour.bonValeurGenere.dateValidite).toLocaleDateString("fr-FR")}</span></div>
            <p className="text-xs font-semibold mt-1" style={{ color: "#B04A3B" }}>Passé ce délai, l'avoir est définitivement perdu.</p>
          </div>
        )}

        {retour.motif && (
          <p className="text-xs mt-3" style={{ color: "#6B5D52" }}>Motif : {retour.motif}</p>
        )}

        <p className="text-xs text-center mt-4" style={{ color: "#6B5D52" }}>Traité par {retour.traitePar?.prenom || "—"}</p>

        <button onClick={() => window.print()} className="no-print w-full mt-5 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", fontFamily: "'Inter', sans-serif" }}><Printer size={15} /> Imprimer</button>
      </div>
    </div>
  );
}

function CartesCadeauxSection({ boutique, estAdmin }) {
  const [cartes, setCartes] = useState([]);
  const [numero, setNumero] = useState("");
  const [montant, setMontant] = useState("");
  const [dateValidite, setDateValidite] = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [historique, setHistorique] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [denominations, setDenominations] = useState([]);
  const [nouvelleDenomination, setNouvelleDenomination] = useState("");
  const [stockageOuvertId, setStockageOuvertId] = useState(null);
  const [stockageBoutique, setStockageBoutique] = useState(BOUTIQUES[0]);
  const [stockageNumeros, setStockageNumeros] = useState("");
  const [stockageEnCours, setStockageEnCours] = useState(false);

  const load = useCallback(async () => { try { setCartes(await api.bonsValeur.list("CADEAU")); } catch (e) { setError(e.message); } }, []);
  useEffect(() => { load(); }, [load]);

  const chargerDenominations = useCallback(async () => {
    if (!estAdmin) return;
    try { setDenominations(await api.denominationsCartesCadeaux.lister(true)); } catch (e) { setError(e.message); }
  }, [estAdmin]);
  useEffect(() => { chargerDenominations(); }, [chargerDenominations]);

  const ajouterDenomination = async () => {
    if (!nouvelleDenomination || Number(nouvelleDenomination) <= 0) { setError("Indique un montant valide."); return; }
    try { await api.denominationsCartesCadeaux.creer(Number(nouvelleDenomination)); setNouvelleDenomination(""); chargerDenominations(); } catch (e) { setError(e.message); }
  };
  const toggleDenomination = async (d) => {
    try { await api.denominationsCartesCadeaux.activer(d.id, !d.actif); chargerDenominations(); } catch (e) { setError(e.message); }
  };
  const supprimerDenomination = async (d) => {
    if (!window.confirm(`Supprimer définitivement le montant ${fmt(d.montant)} F ?`)) return;
    try { await api.denominationsCartesCadeaux.supprimer(d.id); chargerDenominations(); } catch (e) { setError(e.message); }
  };
  const ouvrirStockage = (d) => { setStockageOuvertId(d.id); setStockageBoutique(BOUTIQUES[0]); setStockageNumeros(""); setInfo(""); };
  const enregistrerStockage = async (d) => {
    if (!stockageNumeros.trim()) { setError("Colle la liste des numéros reçus (un par ligne)."); return; }
    setStockageEnCours(true);
    try {
      const res = await api.denominationsCartesCadeaux.stockerNumeros(d.id, stockageBoutique, stockageNumeros);
      let msg = `${res.creees} carte(s) ajoutée(s) en stock à ${stockageBoutique}.`;
      if (res.dejaExistants.length > 0) msg += ` ${res.dejaExistants.length} numéro(s) déjà connu(s) ignoré(s) : ${res.dejaExistants.join(", ")}.`;
      setInfo(msg); setError("");
      setStockageNumeros(""); setStockageOuvertId(null);
      chargerDenominations();
    } catch (e) { setError(e.message); } finally { setStockageEnCours(false); }
  };

  const creer = async () => {
    if (!montant) { setError("Le montant est obligatoire."); return; }
    try {
      await api.bonsValeur.create({ numero: numero.trim() || undefined, montant: Number(montant), dateValidite: dateValidite || undefined, boutique, modePaiement: historique ? undefined : modePaiement, historique });
      setNumero(""); setMontant(""); setDateValidite(""); setHistorique(false); setError(""); load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      {error && <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ background: "#FBEAE7", color: "#8C3B2E" }}>{error}</p>}

      {estAdmin && (
        <div className="rounded-xl p-5 mb-6 max-w-lg" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
          <p className="font-display font-semibold mb-1">Montants des cartes cadeaux</p>
          <p className="text-xs mb-3" style={{ color: "#6B5D52" }}>Les montants imprimés sur tes cartes physiques. Chaque carte a un numéro déjà imprimé par le fournisseur — colle la liste de numéros reçus à chaque arrivage, par boutique.</p>
          {info && <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#E9F0EA", color: "#3F6B4A" }}>{info}</p>}
          <div className="space-y-2 mb-3">
            {denominations.map((d) => (
              <div key={d.id} className="rounded-lg px-3 py-2" style={{ background: "#F1E9DC" }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button onClick={() => toggleDenomination(d)} className="text-xs px-2 py-1 rounded-full font-medium" style={d.actif ? { background: "#8C3B2E", color: "#FBF3EC" } : { background: "#DDD3C4", color: "#6B5D52", textDecoration: "line-through" }} title={d.actif ? "Cliquer pour désactiver" : "Cliquer pour réactiver"}>
                    {fmt(d.montant)} F
                  </button>
                  <div className="flex items-center gap-3 text-xs" style={{ color: "#6B5D52" }}>
                    {(d.parBoutique || []).map((pb) => (
                      <span key={pb.boutique} style={{ color: pb.enStock <= 5 ? "#B04A3B" : "#6B5D52" }}>
                        {pb.boutique} : {pb.enStock} en stock{pb.enStock <= 5 ? " ⚠" : ""}
                      </span>
                    ))}
                  </div>
                  <button onClick={() => ouvrirStockage(d)} className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: "#2B2320", color: "#FBF3EC" }}>Réceptionner un lot</button>
                  <button onClick={() => supprimerDenomination(d)} className="text-xs px-2 py-1 rounded-lg" style={{ border: "1px solid #B04A3B", color: "#B04A3B" }}>Supprimer</button>
                </div>
                {stockageOuvertId === d.id && (
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid #DDD3C4" }}>
                    <select value={stockageBoutique} onChange={(e) => setStockageBoutique(e.target.value)} style={{ ...inputStyle, marginTop: 0, marginBottom: "8px" }}>
                      {BOUTIQUES.map((b) => <option key={b}>{b}</option>)}
                    </select>
                    <textarea value={stockageNumeros} onChange={(e) => setStockageNumeros(e.target.value)} rows={4} placeholder={"Colle ici la liste des numéros reçus, un par ligne :\nCG-0101\nCG-0102\nCG-0103"} style={{ ...inputStyle, marginTop: 0, fontFamily: "monospace", fontSize: "13px" }} />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setStockageOuvertId(null)} className="flex-1 px-3 py-1.5 rounded-lg text-xs" style={{ color: "#6B5D52" }}>Annuler</button>
                      <button onClick={() => enregistrerStockage(d)} disabled={stockageEnCours} className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: stockageEnCours ? 0.6 : 1 }}>{stockageEnCours ? "Enregistrement..." : "Ajouter au stock"}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={nouvelleDenomination} onChange={(e) => setNouvelleDenomination(e.target.value.replace(/\D/g, ""))} placeholder="Nouveau montant, ex : 200000" style={{ ...inputStyle, marginTop: 0 }} />
            <button onClick={ajouterDenomination} className="px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap" style={{ background: "#2B2320", color: "#FBF3EC" }}>Créer</button>
          </div>
        </div>
      )}

      {estAdmin && (
      <div className="rounded-xl p-5 mb-6 max-w-md" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
        <p className="font-display font-semibold mb-3 flex items-center gap-2"><Gift size={16} /> Nouvelle carte cadeau (création directe, cas particulier)</p>
        <p className="text-xs mb-3" style={{ color: "#6B5D52" }}>Pour un cas exceptionnel uniquement (ex : carte promotionnelle) — pour une vraie carte physique reçue du fournisseur, utilise plutôt "Réceptionner un lot" ci-dessus.</p>
        <label className="flex items-center gap-2 mb-3 text-sm" style={{ color: "#6B5D52" }}>
          <input type="checkbox" checked={historique} onChange={(e) => setHistorique(e.target.checked)} />
          Carte ancienne, vendue avant ce logiciel (aucun encaissement aujourd'hui)
        </label>
        <Field label="Numero (laisser vide pour generer automatiquement)"><input value={numero} onChange={(e) => setNumero(e.target.value)} style={inputStyle} placeholder="Ex : CG-0001" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (F CFA)"><input value={montant} onChange={(e) => setMontant(e.target.value.replace(/\D/g, ""))} style={inputStyle} /></Field>
          <Field label="Validite (optionnel)"><input type="date" value={dateValidite} onChange={(e) => setDateValidite(e.target.value)} style={inputStyle} /></Field>
        </div>
        {!historique && (
          <Field label="Mode de paiement reçu">
            <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)} style={inputStyle}>
              {MODES_PAIEMENT.filter((m) => m.id !== "bon_achat" && m.id !== "avoir").map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
        )}
        <p className="text-xs mt-2" style={{ color: "#6B5D52" }}>
          {historique
            ? "Carte enregistrée sans impact sur la caisse — ni encaissement, ni sortie de stock comptée aujourd'hui."
            : <>Boutique : <strong>{boutique}</strong> — ce montant sera compté dans le chiffre d'affaires du jour.</>}
        </p>
        <button onClick={creer} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}><Plus size={16} /> Creer la carte</button>
      </div>
      )}

      <CartesCadeauxListeSection estAdmin={estAdmin} cartes={cartes} onCorrige={load} />
    </div>
  );
}

function CartesCadeauxListeSection({ estAdmin, cartes, onCorrige }) {
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous"); // "tous" | "disponible" | "utilisee" | "historique"
  const [filtreMontant, setFiltreMontant] = useState("");

  const corriger = async (c) => {
    try { await api.bonsValeur.marquerHistorique(c.id); onCorrige(); } catch (e) { alert(e.message); }
  };
  const supprimer = async (c) => {
    try { await api.bonsValeur.remove(c.id); onCorrige(); } catch (e) { alert(e.message); }
  };

  const montantsDisponibles = [...new Set(cartes.map((c) => c.montant))].sort((a, b) => a - b);

  const cartesFiltrees = cartes.filter((c) => {
    if (recherche.trim() && !c.numero.toLowerCase().includes(recherche.trim().toLowerCase())) return false;
    if (filtreMontant && c.montant !== Number(filtreMontant)) return false;
    if (filtreStatut === "disponible" && c.utilisee) return false;
    if (filtreStatut === "utilisee" && !c.utilisee) return false;
    if (filtreStatut === "historique" && c.modePaiement) return false;
    return true;
  });

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <div className="relative max-w-xs flex-1" style={{ minWidth: "200px" }}>
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher par numéro…" style={{ ...inputStyle, marginTop: 0, paddingLeft: "30px", width: "100%" }} />
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#6B5D52" />
        </div>
        <select value={filtreMontant} onChange={(e) => setFiltreMontant(e.target.value)} style={{ ...inputStyle, marginTop: 0, width: "auto" }}>
          <option value="">Tous les montants</option>
          {montantsDisponibles.map((m) => <option key={m} value={m}>{fmt(m)} F</option>)}
        </select>
      </div>
      <div className="flex gap-2 mb-4">
        {[["tous", "Toutes"], ["disponible", "Disponibles"], ["utilisee", "Utilisées"], ["historique", "Historiques"]].map(([id, label]) => (
          <button key={id} onClick={() => setFiltreStatut(id)} className="text-xs px-3 py-1.5 rounded-full font-medium" style={filtreStatut === id ? { background: "#8C3B2E", color: "#FBF3EC" } : { border: "1px solid #DDD3C4", color: "#6B5D52" }}>{label}</button>
        ))}
      </div>
      <div className="space-y-2">
        {cartesFiltrees.length === 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>Aucune carte ne correspond à cette recherche.</p>}
        {cartesFiltrees.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
            <div>
              <p className="font-mono text-sm font-medium">{c.numero}</p>
              <p className="text-xs" style={{ color: "#6B5D52" }}>
                {c.client ? `${c.client.nomPrenoms}${c.client.telephone ? ` · ${c.client.telephone}` : " · téléphone non renseigné"}` : "Client inconnu"}
              </p>
              <p className="text-xs" style={{ color: "#6B5D52" }}>{c.dateValidite ? `Expire le ${new Date(c.dateValidite).toLocaleDateString("fr-FR")}` : "Sans expiration"}{!c.modePaiement ? " · Historique" : ""}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-mono text-sm">{fmt(c.montant)} F</p>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: c.utilisee ? "#FBEAE7" : "#E9F0EA", color: c.utilisee ? "#B04A3B" : "#3F6B4A" }}>{c.utilisee ? "Utilisee" : "Disponible"}</span>
              </div>
              {estAdmin && c.modePaiement && (
                <button onClick={() => { if (window.confirm(`Marquer ${c.numero} comme carte historique ? Elle sera retirée du chiffre d'affaires du jour où elle a été créée.`)) corriger(c); }} className="text-xs px-2 py-1 rounded-lg" style={{ border: "1px solid #DDD3C4", color: "#6B5D52" }}>Marquer historique</button>
              )}
              {estAdmin && !c.utilisee && !c.origineVenteId && (
                <button onClick={() => { if (window.confirm(`Supprimer définitivement la carte ${c.numero} ? Cette action est irréversible.`)) supprimer(c); }} className="text-xs px-2 py-1 rounded-lg" style={{ border: "1px solid #B04A3B", color: "#B04A3B" }}>Supprimer</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AvoirsSection() {
  const [avoirs, setAvoirs] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => { try { setAvoirs(await api.bonsValeur.list("AVOIR")); } catch (e) { setError(e.message); } }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {error && <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ background: "#FBEAE7", color: "#8C3B2E" }}>{error}</p>}
      <p className="text-sm mb-4" style={{ color: "#6B5D52" }}>Les avoirs sont generes automatiquement lors d'un retour — cette liste est en lecture seule.</p>
      <div className="space-y-2">
        {avoirs.length === 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>Aucun avoir pour le moment.</p>}
        {avoirs.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
            <div>
              <p className="font-mono text-sm font-medium">{a.numero}</p>
              <p className="text-xs" style={{ color: "#6B5D52" }}>
                {a.client ? `${a.client.nomPrenoms}${a.client.telephone ? ` · ${a.client.telephone}` : " · téléphone non renseigné"}` : "Client inconnu"}
              </p>
              <p className="text-xs" style={{ color: "#6B5D52" }}>{a.dateValidite ? `Valide jusqu'au ${new Date(a.dateValidite).toLocaleDateString("fr-FR")}` : "Sans expiration"}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm">{fmt(a.montant)} F</p>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: a.utilisee ? "#FBEAE7" : "#E9F0EA", color: a.utilisee ? "#B04A3B" : "#3F6B4A" }}>{a.utilisee ? "Utilise" : "Disponible"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreditSection({ estAdmin, onDone }) {
  const [ventesCredit, setVentesCredit] = useState([]);
  const [boutiqueFiltre, setBoutiqueFiltre] = useState("");
  const [chargement, setChargement] = useState(true);
  const [venteSel, setVenteSel] = useState(null);
  const [mode, setMode] = useState("especes");
  const [montant, setMontant] = useState("");
  const [carteNumero, setCarteNumero] = useState("");
  const [error, setError] = useState("");
  const [succes, setSucces] = useState("");
  const [recuReglement, setRecuReglement] = useState(null);

  const chargerCredits = useCallback(async () => {
    setChargement(true);
    try {
      setVentesCredit(await api.ventes.creditListe(boutiqueFiltre ? { boutique: boutiqueFiltre } : {}));
    } catch (e) { setError(e.message); } finally { setChargement(false); }
  }, [boutiqueFiltre]);
  useEffect(() => { chargerCredits(); }, [chargerCredits]);

  const nonSoldees = ventesCredit.filter((v) => v.resteAPayer > 0);
  const soldees = ventesCredit.filter((v) => v.resteAPayer <= 0);
  const ouvrirReglement = (v) => {
    setVenteSel(v);
    setMontant(v.resteAPayer);
    setMode("especes");
    setCarteNumero("");
    setError("");
    setSucces("");
  };

  const enregistrerReglement = async () => {
    if (!montant || Number(montant) <= 0) { setError("Le montant doit etre positif."); return; }
    try {
      const resultat = await api.ventes.reglement(venteSel.id, {
        mode, montant: Number(montant), carteNumero: (mode === "bon_achat" || mode === "avoir") ? carteNumero : undefined,
      });
      setRecuReglement(resultat);
      setVenteSel(null);
      chargerCredits();
      onDone();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      {succes && <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ background: "#E9F0EA", color: "#3F6B4A" }}>{succes}</p>}
      {estAdmin && (
        <div className="flex gap-2 mb-5">
          {[["", "Toutes les boutiques"], ["Boutique Principale", "Boutique Principale"]].map(([val, label]) => (
            <button key={val || "toutes"} onClick={() => setBoutiqueFiltre(val)} className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={boutiqueFiltre === val ? { background: "#2B2320", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52", border: "1px solid #DDD3C4" }}>
              {label}
            </button>
          ))}
        </div>
      )}
      {chargement && <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement…</p>}
      {!chargement && <p className="font-display font-semibold mb-3">Non soldees ({nonSoldees.length})</p>}

        <div className="space-y-2 mb-6">
        {nonSoldees.length === 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>Aucune vente a credit en attente de reglement.</p>}
        {nonSoldees.map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-xl p-4 flex-wrap gap-2" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
            <div>
              <p className="font-mono text-sm font-medium">{v.numero}</p>
              <p className="text-xs" style={{ color: "#6B5D52" }}>{v.client?.nomPrenoms || "Client inconnu"} · {new Date(v.date).toLocaleDateString("fr-FR")} · {v.boutique}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs" style={{ color: "#6B5D52" }}>Total {fmt(v.total)} F · Paye {fmt(v.totalPaye)} F</p>
                <p className="text-sm font-semibold" style={{ color: "#B04A3B" }}>Reste {fmt(v.resteAPayer)} F</p>
              </div>
              <button onClick={() => ouvrirReglement(v)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Enregistrer un reglement</button>
            </div>
          </div>
        ))}
      </div>

      <p className="font-display font-semibold mb-3">Soldees ({soldees.length})</p>
      <div className="space-y-2">
        {soldees.map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-xl p-4 flex-wrap gap-2" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
            <div>
              <p className="font-mono text-sm font-medium">{v.numero}</p>
              <p className="text-xs" style={{ color: "#6B5D52" }}>{v.client?.nomPrenoms || "Client inconnu"} · {new Date(v.date).toLocaleDateString("fr-FR")} · {v.boutique}</p>
            </div>
            <p className="text-sm font-semibold" style={{ color: "#3F6B4A" }}>Soldee · {fmt(v.total)} F</p>
          </div>
        ))}
      </div>

      {venteSel && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
          <div className="rounded-xl p-6 max-w-sm w-full" style={{ background: "#FFFDF9" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-semibold">Reglement — {venteSel.numero}</p>
              <button onClick={() => setVenteSel(null)}><X size={18} color="#6B5D52" /></button>
            </div>
            {error && <p className="text-sm mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAE7", color: "#8C3B2E" }}>{error}</p>}
            <p className="text-xs mb-3" style={{ color: "#6B5D52" }}>Reste a payer : {fmt(venteSel.resteAPayer)} F</p>
            <Field label="Mode de paiement">
              <select value={mode} onChange={(e) => { const m = e.target.value; setMode(m); if (m === "bon_achat" || m === "avoir") setMontant(""); else setMontant(venteSel.resteAPayer); }} style={inputStyle}>
                {MODES_PAIEMENT.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Montant (F CFA)">
              <input type="number" min="0" max={venteSel.resteAPayer} value={montant} onChange={(e) => setMontant(e.target.value)} style={inputStyle} />
            </Field>
            {(mode === "bon_achat" || mode === "avoir") && (
              <Field label={mode === "avoir" ? "Numero de l'avoir" : "Numero de la carte cadeau"}>
                <input value={carteNumero} onChange={(e) => setCarteNumero(e.target.value)} onBlur={async () => {
                  if (!carteNumero.trim()) return;
                  try { const bon = await api.bonsValeur.verifier(carteNumero.trim()); setMontant(Math.min(bon.montant, venteSel.resteAPayer)); } catch (e) { /* le message d'erreur sortira a la validation */ }
                }} style={inputStyle} />
              </Field>
            )}
            <button onClick={enregistrerReglement} className="mt-4 w-full px-4 py-2.5 rounded-lg text-sm font-medium" style={{ background: "#3F6B4A", color: "#F3F7F3" }}>Valider le reglement</button>
          </div>
        </div>
      )}

      {recuReglement && <RecuReglementModal recu={recuReglement} onClose={() => setRecuReglement(null)} />}
    </div>
  );
}

function RecuReglementModal({ recu, onClose }) {
  const infos = INFOS_BOUTIQUE[recu.venteBoutique] || {};
  const modeLabel = MODES_PAIEMENT.find((m) => m.id === recu.paiement.mode)?.label || recu.paiement.mode;
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
      <div className="print-area rounded-xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto" style={{ background: "#FFFDF9", fontFamily: "'IBM Plex Mono', monospace" }}>
        <div className="flex items-center justify-between mb-4 no-print"><p className="font-display font-semibold">Reçu de règlement</p><button onClick={onClose}><X size={18} color="#6B5D52" /></button></div>

        <div className="text-center mb-3">
          <p className="font-display font-bold text-sm leading-tight">{infos.nom}</p>
          <p className="font-display font-bold text-sm leading-tight">{infos.ligne2}</p>
          <p className="text-xs mt-1" style={{ color: "#6B5D52" }}>{infos.adresse}</p>
          <p className="text-xs" style={{ color: "#6B5D52" }}>{infos.telephone}</p>
        </div>
        <div style={{ borderTop: "1px dashed #DDD3C4" }} className="my-2" />

        <p className="text-center font-display text-lg font-semibold">RÈGLEMENT DE CRÉDIT</p>
        <p className="text-center text-xs mb-4" style={{ color: "#6B5D52" }}>{new Date().toLocaleString("fr-FR")} · {recu.venteBoutique}</p>

        <div className="text-xs mb-2" style={{ color: "#6B5D52" }}>Vente d'origine : {recu.venteNumero}</div>
        {recu.clientNom && <div className="text-xs mb-3" style={{ color: "#6B5D52" }}>Client : {recu.clientNom}</div>}

        <div style={{ borderTop: "1px dashed #DDD3C4", borderBottom: "1px dashed #DDD3C4" }} className="py-3 space-y-2">
          <div className="flex justify-between text-sm"><span>Total de la vente</span><span>{fmt(recu.totalVente)} F</span></div>
          <div className="flex justify-between text-sm font-semibold" style={{ color: "#3F6B4A" }}><span>Montant réglé aujourd'hui</span><span>{fmt(recu.paiement.montant)} F</span></div>
          <div className="flex justify-between text-xs" style={{ color: "#6B5D52" }}><span>Mode de paiement</span><span>{modeLabel}</span></div>
        </div>

        <div className="flex justify-between font-semibold mt-3 text-sm" style={{ color: recu.resteApres > 0 ? "#B04A3B" : "#3F6B4A" }}>
          <span>{recu.resteApres > 0 ? "RESTE À PAYER" : "SOLDÉ"}</span>
          <span>{fmt(Math.max(0, recu.resteApres))} F</span>
        </div>

        <div style={{ borderTop: "1px dashed #DDD3C4" }} className="mt-3 pt-3">
          <p className="text-xs text-center whitespace-pre-line leading-relaxed" style={{ color: "#6B5D52" }}>{MESSAGE_FIN_TICKET}</p>
        </div>

        <button onClick={() => window.print()} className="no-print w-full mt-5 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", fontFamily: "'Inter', sans-serif" }}><Printer size={15} /> Imprimer</button>
      </div>
    </div>
  );
}

function CreancesHistoriquesSection({ boutique, clients, estAdmin, onDone }) {
  const [creances, setCreances] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [error, setError] = useState("");

  const [formOuvert, setFormOuvert] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [montantTotal, setMontantTotal] = useState("");
  const [montantDejaPaye, setMontantDejaPaye] = useState("");
  const [note, setNote] = useState("");

  const [creanceSel, setCreanceSel] = useState(null);
  const [mode, setMode] = useState("especes");
  const [montant, setMontant] = useState("");
  const [recu, setRecu] = useState(null);

  const load = useCallback(async () => {
    setChargement(true);
    try { setCreances(await api.creancesHistoriques.list({ boutique })); } catch (e) { setError(e.message); } finally { setChargement(false); }
  }, [boutique]);
  useEffect(() => { load(); }, [load]);

  const nonSoldees = creances.filter((c) => c.resteAPayer > 0);
  const soldees = creances.filter((c) => c.resteAPayer <= 0);

  const creer = async () => {
    if (!clientId) { setError("Choisis un client."); return; }
    if (!montantTotal) { setError("Le montant total est obligatoire."); return; }
    try {
      await api.creancesHistoriques.create({
        clientId, boutique, montantTotal: Number(montantTotal),
        montantDejaPaye: Number(montantDejaPaye) || 0, note,
      });
      setClientId(""); setClientSearch(""); setMontantTotal(""); setMontantDejaPaye(""); setNote(""); setFormOuvert(false);
      setError(""); load();
    } catch (e) { setError(e.message); }
  };

  const ouvrirReglement = (c) => {
    setCreanceSel(c);
    setMontant(c.resteAPayer);
    setMode("especes");
    setError("");
  };

  const enregistrerReglement = async () => {
    if (!montant || Number(montant) <= 0) { setError("Le montant doit etre positif."); return; }
    try {
      const resultat = await api.creancesHistoriques.reglement(creanceSel.id, { montant: Number(montant), mode, boutique });
      setRecu({ ...resultat, boutique });
      setCreanceSel(null);
      onDone?.();
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      {error && <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ background: "#FBEAE7", color: "#8C3B2E" }}>{error}</p>}

      {estAdmin && (
        <div className="mb-6">
          {!formOuvert ? (
            <button onClick={() => setFormOuvert(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}><Plus size={16} /> Ajouter une ancienne créance</button>
          ) : (
            <div className="rounded-xl p-5 max-w-md" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
              <p className="font-display font-semibold mb-3">Nouvelle créance historique</p>
              <Field label="Client">
                {clientId ? (
                  <div className="flex items-center justify-between mt-1 px-3 py-2 rounded-lg" style={{ background: "#F1E9DC" }}>
                    <span className="text-sm">{clients.find((c) => c.id === clientId)?.nomPrenoms}</span>
                    <button onClick={() => { setClientId(""); setClientSearch(""); }} style={{ color: "#B04A3B" }}><X size={14} /></button>
                  </div>
                ) : (
                  <div className="relative mt-1">
                    <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} style={{ ...inputStyle, marginTop: 0, paddingLeft: "30px" }} placeholder="Rechercher…" />
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#6B5D52" />
                    {clientSearch.trim() && (
                      <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden max-h-40 overflow-y-auto" style={{ background: "#FFFFFF", border: "1px solid #DDD3C4" }}>
                        {clients.filter((c) => c.nomPrenoms.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 6).map((c) => (
                          <button key={c.id} onClick={() => { setClientId(c.id); setClientSearch(""); }} className="w-full text-left px-3 py-2 text-sm" style={{ background: "#FFFFFF" }}>{c.nomPrenoms}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Montant total de la dette (F CFA)"><input value={montantTotal} onChange={(e) => setMontantTotal(e.target.value.replace(/\D/g, ""))} style={inputStyle} /></Field>
                <Field label="Deja regle avant import (F CFA)"><input value={montantDejaPaye} onChange={(e) => setMontantDejaPaye(e.target.value.replace(/\D/g, ""))} style={inputStyle} /></Field>
              </div>
              <Field label="Note (optionnel)"><input value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} placeholder="Ex : reprise Abigescom" /></Field>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setFormOuvert(false)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium" style={{ border: "1px solid #DDD3C4", color: "#6B5D52" }}>Annuler</button>
                <button onClick={creer} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Enregistrer</button>
              </div>
            </div>
          )}
        </div>
      )}

      {chargement && <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement...</p>}

      {!chargement && (
        <>
          <p className="font-display font-semibold mb-3">Non soldees ({nonSoldees.length})</p>
          <div className="space-y-2 mb-6">
            {nonSoldees.length === 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>Aucune créance en attente.</p>}
            {nonSoldees.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl p-4 flex-wrap gap-2" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
                <div>
                  <p className="font-medium text-sm">{c.client?.nomPrenoms || "Client inconnu"}</p>
                  <p className="text-xs" style={{ color: "#6B5D52" }}>{c.boutique}{c.note ? ` · ${c.note}` : ""}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs" style={{ color: "#6B5D52" }}>Total {fmt(c.montantTotal)} F · Regle {fmt(c.totalRegle)} F</p>
                    <p className="text-sm font-semibold" style={{ color: "#B04A3B" }}>Reste {fmt(c.resteAPayer)} F</p>
                  </div>
                  <button onClick={() => ouvrirReglement(c)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Enregistrer un reglement</button>
                </div>
              </div>
            ))}
          </div>

          <p className="font-display font-semibold mb-3">Soldees ({soldees.length})</p>
          <div className="space-y-2">
            {soldees.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl p-4 flex-wrap gap-2" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
                <div>
                  <p className="font-medium text-sm">{c.client?.nomPrenoms || "Client inconnu"}</p>
                  <p className="text-xs" style={{ color: "#6B5D52" }}>{c.boutique}</p>
                </div>
                <p className="text-sm font-semibold" style={{ color: "#3F6B4A" }}>Soldee · {fmt(c.montantTotal)} F</p>
              </div>
            ))}
          </div>
        </>
      )}

      {creanceSel && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
          <div className="rounded-xl p-6 max-w-sm w-full" style={{ background: "#FFFDF9" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-semibold">Reglement — {creanceSel.client?.nomPrenoms}</p>
              <button onClick={() => setCreanceSel(null)}><X size={18} color="#6B5D52" /></button>
            </div>
            {error && <p className="text-sm mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAE7", color: "#8C3B2E" }}>{error}</p>}
            <p className="text-xs mb-3" style={{ color: "#6B5D52" }}>Reste a payer : {fmt(creanceSel.resteAPayer)} F</p>
            <Field label="Mode de paiement">
              <select value={mode} onChange={(e) => setMode(e.target.value)} style={inputStyle}>
                {MODES_PAIEMENT.filter((m) => m.id !== "bon_achat" && m.id !== "avoir").map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Montant (F CFA)">
              <input type="number" min="0" max={creanceSel.resteAPayer} value={montant} onChange={(e) => setMontant(e.target.value)} style={inputStyle} />
            </Field>
            <button onClick={enregistrerReglement} className="mt-4 w-full px-4 py-2.5 rounded-lg text-sm font-medium" style={{ background: "#3F6B4A", color: "#F3F7F3" }}>Valider le reglement</button>
          </div>
        </div>
      )}

      {recu && <CreanceRecuModal recu={recu} onClose={() => setRecu(null)} />}
    </div>
  );
}

function CreanceRecuModal({ recu, onClose }) {
  const infos = INFOS_BOUTIQUE[recu.boutique] || {};
  const modeLabel = MODES_PAIEMENT.find((m) => m.id === recu.reglement.mode)?.label || recu.reglement.mode;
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
      <div className="print-area rounded-xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto" style={{ background: "#FFFDF9", fontFamily: "'IBM Plex Mono', monospace" }}>
        <div className="flex items-center justify-between mb-4 no-print"><p className="font-display font-semibold">Reçu de règlement</p><button onClick={onClose}><X size={18} color="#6B5D52" /></button></div>

        <div className="text-center mb-3">
          <p className="font-display font-bold text-sm leading-tight">{infos.nom}</p>
          <p className="font-display font-bold text-sm leading-tight">{infos.ligne2}</p>
          <p className="text-xs mt-1" style={{ color: "#6B5D52" }}>{infos.adresse}</p>
          <p className="text-xs" style={{ color: "#6B5D52" }}>{infos.telephone}</p>
        </div>
        <div style={{ borderTop: "1px dashed #DDD3C4" }} className="my-2" />

        <p className="text-center font-display text-lg font-semibold">RÈGLEMENT DE CRÉANCE</p>
        <p className="text-center text-xs mb-4" style={{ color: "#6B5D52" }}>{new Date().toLocaleString("fr-FR")} · {recu.boutique}</p>

        <div className="text-xs mb-3" style={{ color: "#6B5D52" }}>Client : {recu.clientNom}</div>

        <div style={{ borderTop: "1px dashed #DDD3C4", borderBottom: "1px dashed #DDD3C4" }} className="py-3 space-y-2">
          <div className="flex justify-between text-sm"><span>Montant total de la dette</span><span>{fmt(recu.montantTotal)} F</span></div>
          <div className="flex justify-between text-sm font-semibold" style={{ color: "#3F6B4A" }}><span>Montant réglé aujourd'hui</span><span>{fmt(recu.reglement.montant)} F</span></div>
          <div className="flex justify-between text-xs" style={{ color: "#6B5D52" }}><span>Mode de paiement</span><span>{modeLabel}</span></div>
        </div>

        <div className="flex justify-between font-semibold mt-3 text-sm" style={{ color: recu.resteApres > 0 ? "#B04A3B" : "#3F6B4A" }}>
          <span>{recu.resteApres > 0 ? "RESTE À PAYER" : "SOLDÉ"}</span>
          <span>{fmt(Math.max(0, recu.resteApres))} F</span>
        </div>

        <div style={{ borderTop: "1px dashed #DDD3C4" }} className="mt-3 pt-3">
          <p className="text-xs text-center whitespace-pre-line leading-relaxed" style={{ color: "#6B5D52" }}>{MESSAGE_FIN_TICKET}</p>
        </div>

        <button onClick={() => window.print()} className="no-print w-full mt-5 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", fontFamily: "'Inter', sans-serif" }}><Printer size={15} /> Imprimer</button>
      </div>
    </div>
  );
}
