import { useState, useEffect, useCallback } from "react";
import { Calendar, CreditCard, Store, Lock, Award, Download, ChevronDown, Printer, ShieldAlert, Heart, Truck } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { MODES_PAIEMENT, LIVRAISON_ACTIF } from "../constants.js";
import { ReceiptModal } from "./VentesSection.jsx";

const COULEUR = { fond: "#FAF7F2", carte: "#FFFDF9", bordure: "#DDD3C4", texte: "#2B2320", texteDoux: "#6B5D52", accent: "#8C3B2E" };

function formatFCFA(n) {
  return `${(n || 0).toLocaleString("fr-FR")} FCFA`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function EtatsSection() {
  const { user } = useAuth();
  const estAdmin = !!user?.role?.systeme;

  const [sousOnglet, setSousOnglet] = useState("date");
  const [dateDebut, setDateDebut] = useState(todayISO());
  const [dateFin, setDateFin] = useState(todayISO());
  const [boutique, setBoutique] = useState("");

  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const [fermeture, setFermeture] = useState(null);
  const [chargementFermeture, setChargementFermeture] = useState(false);
  const [periodeOuverte, setPeriodeOuverte] = useState(false);
  const [receiptVente, setReceiptVente] = useState(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    setDonnees(null);
    const params = { dateDebut, dateFin };
    if (estAdmin && boutique) params.boutique = boutique;
    try {
      let res;
      if (sousOnglet === "date") res = await api.etats.parDate(params);
      else if (sousOnglet === "mode") res = await api.etats.parModePaiement(params);
      else if (sousOnglet === "type") res = await api.etats.parType(params);
      else if (sousOnglet === "vendeur") res = await api.etats.parVendeur(params);
      else if (sousOnglet === "clients") res = await api.etats.parClient(params);
      else if (sousOnglet === "audit") res = await api.etats.auditRemises({ dateDebut, dateFin });
      else if (sousOnglet === "livraisons") res = await api.etats.livraisons(params);
      else res = await api.etats.recapBoutiques({ dateDebut, dateFin });
      setDonnees(res);
    } catch (e) {
      setErreur(e.message || "Erreur lors du chargement de l'état.");
      setDonnees(null);
    } finally {
      setChargement(false);
    }
  }, [sousOnglet, dateDebut, dateFin, boutique, estAdmin]);

  useEffect(() => { charger(); }, [charger]);

  // Impression automatique dès qu'une fermeture de caisse est calculée
  useEffect(() => {
    if (fermeture) {
      const timer = setTimeout(() => window.print(), 300);
      return () => clearTimeout(timer);
    }
  }, [fermeture]);

  const iso = (d) => d.toISOString().slice(0, 10);

  const appliquerPeriode = (type) => {
    const aujourdhui = new Date();
    let debut = new Date(aujourdhui);
    let fin = new Date(aujourdhui);

    if (type === "aujourdhui") {
      // debut = fin = aujourd'hui
    } else if (type === "hier") {
      debut.setDate(debut.getDate() - 1);
      fin.setDate(fin.getDate() - 1);
    } else if (type === "semaine-cours") {
      const jour = (debut.getDay() + 6) % 7; // lundi = 0
      debut.setDate(debut.getDate() - jour);
    } else if (type === "semaine-precedente") {
      const jour = (debut.getDay() + 6) % 7;
      debut.setDate(debut.getDate() - jour - 7);
      fin = new Date(debut);
      fin.setDate(fin.getDate() + 6);
    } else if (type === "mois-cours") {
      debut = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
    } else if (type === "mois-precedent") {
      debut = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1, 1);
      fin = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 0);
    } else if (type === "deux-derniers-mois") {
      debut = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1, 1);
    } else if (type === "annee-cours") {
      debut = new Date(aujourdhui.getFullYear(), 0, 1);
    }

    setDateDebut(iso(debut));
    setDateFin(iso(fin));
    setPeriodeOuverte(false);
  };

  const PERIODES = [
    { id: "aujourdhui", label: "Aujourd'hui" },
    { id: "hier", label: "Hier" },
    { id: "semaine-cours", label: "Semaine en cours" },
    { id: "semaine-precedente", label: "Semaine précédente" },
    { id: "mois-cours", label: "Mois en cours" },
    { id: "mois-precedent", label: "Mois précédent" },
    { id: "deux-derniers-mois", label: "Deux derniers mois" },
    { id: "annee-cours", label: "Année en cours" },
  ];

  const exportCSV = () => {
    let lignes = [];
    let nomFichier = "export";

    if (sousOnglet === "date" && donnees?.ventes) {
      lignes.push(["N°", "Date", "Boutique", "Vendeur", "Type", "Paires", "Total"]);
      donnees.ventes.forEach((v) => {
        const paires = v.lignes.filter((l) => l.famille === "Chaussure").reduce((s, l) => s + l.quantite, 0);
        lignes.push([v.numero, new Date(v.date).toLocaleString("fr-FR"), v.boutique, v.vendeur?.nom || "", v.modeVente, paires, v.total]);
      });
      lignes.push(["", "", "", "", "", "Total net", donnees.total]);
      nomFichier = `etat-par-date_${dateDebut}_${dateFin}`;
    } else if (sousOnglet === "mode" && donnees?.recap) {
      lignes.push(["Mode de paiement", "Nombre", "Montant"]);
      donnees.recap.forEach((r) => {
        lignes.push([MODES_PAIEMENT.find((m) => m.id === r.mode)?.label || r.mode, r.nombre, r.montant]);
      });
      lignes.push(["", "Total", donnees.total]);
      nomFichier = `etat-par-mode-paiement_${dateDebut}_${dateFin}`;
    } else if (sousOnglet === "type" && donnees?.recap) {
      lignes.push(["Type de vente", "Nombre", "Montant"]);
      donnees.recap.forEach((r) => {
        lignes.push([r.modeVente, r.nombre, r.montant]);
      });
      lignes.push(["", "Total", donnees.total]);
      nomFichier = `etat-par-type_${dateDebut}_${dateFin}`;
    } else if (sousOnglet === "vendeur" && donnees?.classement) {
      lignes.push(["Rang", "Vendeuse", "Boutique", "Nombre de ventes", "Panier moyen", "Montant vendu"]);
      donnees.classement.forEach((v, i) => {
        lignes.push([i + 1, v.nom, v.boutique, v.nombre, v.panierMoyen, v.montant]);
      });
      nomFichier = `etat-par-vendeur_${dateDebut}_${dateFin}`;
    } else if (sousOnglet === "recap" && donnees?.parBoutique) {
      lignes.push(["Boutique", "Nombre de ventes", "Total des ventes", "Retours traités", "Total règlements", "Créances historiques"]);
      donnees.parBoutique.forEach((b) => {
        lignes.push([b.boutique, b.nombreVentes, b.totalVentes, b.totalRetours, b.totalReglements, b.totalReglementsCreancesHistoriques]);
      });
      lignes.push(["Cumul", donnees.cumul.nombreVentes, donnees.cumul.totalVentes, donnees.cumul.totalRetours, donnees.cumul.totalReglements, donnees.cumul.totalReglementsCreancesHistoriques]);
      nomFichier = `etat-recap-boutiques_${dateDebut}_${dateFin}`;
    } else if (sousOnglet === "audit" && donnees?.lignes) {
      lignes.push(["Vente", "Date", "Boutique", "Caissier", "Montant remise", "Demande N°", "Statut demande", "Traité par", "Suspecte"]);
      donnees.lignes.forEach((l) => {
        lignes.push([l.venteNumero, new Date(l.date).toLocaleString("fr-FR"), l.boutique, l.caissier || "", l.montantRemise, l.demandeNumero || "", l.demandeStatut || "", l.traitePar || "", l.suspecte ? "OUI" : "non"]);
      });
      nomFichier = `audit-remises_${dateDebut}_${dateFin}`;
    } else {
      return;
    }

    const csv = lignes.map((ligne) => ligne.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomFichier}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ouvrirFermeture = async () => {
    setChargementFermeture(true);
    setErreur("");
    try {
      const params = { date: dateFin };
      if (estAdmin && boutique) params.boutique = boutique;
      const res = await api.etats.fermetureCaisse(params);
      setFermeture(res);
    } catch (e) {
      setErreur(e.message || "Erreur lors du calcul de la fermeture de caisse.");
    } finally {
      setChargementFermeture(false);
    }
  };

  const SOUS_ONGLETS = [
    { id: "date", label: "Par date", icon: Calendar },
    { id: "mode", label: "Par mode de paiement", icon: CreditCard },
    { id: "type", label: "Par type", icon: Store },
    { id: "vendeur", label: "Meilleur vendeur", icon: Award },
    { id: "clients", label: "Meilleures clientes", icon: Heart },
    ...(estAdmin ? [{ id: "recap", label: "Récap boutiques", icon: Store }] : []),
    ...(estAdmin ? [{ id: "audit", label: "Audit remises", icon: ShieldAlert }] : []),
    ...(LIVRAISON_ACTIF ? [{ id: "livraisons", label: "Livraisons", icon: Truck }] : []),
  ];

  return (
    <div>
      <div className="flex gap-6 items-start">
        <div className="flex flex-col gap-2 no-print shrink-0" style={{ width: "200px" }}>
          {SOUS_ONGLETS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setSousOnglet(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-left"
              style={sousOnglet === id ? { background: COULEUR.texte, color: "#FBF3EC" } : { background: "transparent", color: COULEUR.texteDoux, border: `1px solid ${COULEUR.bordure}` }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0">
      <div className="flex items-center justify-end gap-2 flex-wrap mb-6">
          <button onClick={exportCSV} disabled={chargement || !donnees}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium"
            style={{ border: `1px solid ${COULEUR.bordure}`, color: COULEUR.texteDoux, opacity: (chargement || !donnees) ? 0.5 : 1 }}>
            <Download size={14} /> Exporter CSV
          </button>
          <button onClick={ouvrirFermeture} disabled={chargementFermeture}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium"
            style={{ background: COULEUR.accent, color: "#FBF3EC" }}>
            <Lock size={14} /> {chargementFermeture ? "Calcul..." : "Fermeture de caisse"}
          </button>
      </div>

      {sousOnglet !== "audit" && estAdmin && (
      <div className="flex items-end gap-3 flex-wrap mb-6 p-4 rounded-2xl" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
        <div className="relative">
          <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Période</label>
          <button type="button" onClick={() => setPeriodeOuverte((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
            style={{ border: `1px solid ${COULEUR.bordure}`, background: "#fff", color: COULEUR.texte }}>
            Choisir <ChevronDown size={14} />
          </button>
          {periodeOuverte && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPeriodeOuverte(false)} />
              <div className="absolute z-20 mt-1 rounded-lg overflow-hidden" style={{ background: "#fff", border: `1px solid ${COULEUR.bordure}`, minWidth: "180px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                {PERIODES.map((p) => (
                  <button key={p.id} type="button" onClick={() => appliquerPeriode(p.id)}
                    className="w-full text-left px-3 py-2 text-sm"
                    style={{ background: "#fff", color: COULEUR.texte }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = COULEUR.fond)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Du</label>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${COULEUR.bordure}`, background: "#fff" }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Au</label>
          <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${COULEUR.bordure}`, background: "#fff" }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Boutique</label>
          <select value={boutique} onChange={(e) => setBoutique(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${COULEUR.bordure}`, background: "#fff" }}>
            <option value="">Toutes les boutiques</option>
            <option value="Boutique Principale">Boutique Principale</option>
          </select>
        </div>
      </div>
      )}

      {sousOnglet !== "audit" && !estAdmin && (
        <div className="mb-6 p-4 rounded-2xl text-sm" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}`, color: COULEUR.texteDoux }}>
          Tu consultes les ventes d'aujourd'hui ({new Date().toLocaleDateString("fr-FR")}). Seule Djenie peut consulter les jours précédents.
        </div>
      )}

      {sousOnglet === "audit" && (
        <div className="flex items-end gap-3 flex-wrap mb-6 p-4 rounded-2xl" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
          <div>
            <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Du</label>
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${COULEUR.bordure}`, background: "#fff" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Au</label>
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${COULEUR.bordure}`, background: "#fff" }} />
          </div>
        </div>
      )}

      {erreur && <p className="text-sm mb-4" style={{ color: COULEUR.accent }}>{erreur}</p>}

      {fermeture && (
        <div className="mb-6 p-5 rounded-2xl print-area" id="fermeture-caisse-print" style={{ background: "#FFFDF9", border: `1px solid ${COULEUR.accent}` }}>
          <div className="flex items-center justify-between mb-3 no-print">
            <h3 className="font-display text-lg font-semibold">Fermeture de caisse — {fermeture.date} ({fermeture.boutique})</h3>
            <div className="flex gap-3 items-center">
              <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg" style={{ background: COULEUR.accent, color: "#FBF3EC" }}><Printer size={14} /> Imprimer</button>
              <button onClick={() => setFermeture(null)} className="text-sm" style={{ color: COULEUR.texteDoux }}>Fermer</button>
            </div>
          </div>
          <p className="text-center font-display font-semibold text-base mb-2 hidden print:block">Fermeture de caisse — {fermeture.date} ({fermeture.boutique})</p>
          <p className="text-sm mb-1">Nombre de ventes : <strong>{fermeture.nombreVentes}</strong></p>
          <p className="text-sm mb-1">Total des ventes (net) : <strong>{formatFCFA(fermeture.totalVentes)}</strong></p>
          <p className="text-sm mb-1">Cartes cadeaux utilisées : <strong>{formatFCFA(fermeture.totalCartesCadeauxUtilisees)}</strong></p>
          <p className="text-sm mb-1">Retours traités (avoirs générés) : <strong>- {formatFCFA(fermeture.totalRetours)}</strong></p>
          <p className="text-sm mb-1">Total monnaie rendue : <strong>{formatFCFA(fermeture.totalMonnaieRendue)}</strong></p>
          <p className="text-sm mb-1">Règlements de crédit reçus aujourd'hui : <strong style={{ color: COULEUR.accent }}>+ {formatFCFA(fermeture.totalReglementsRecus)}</strong></p>
          <p className="text-sm mb-1">Cartes cadeaux vendues aujourd'hui : <strong style={{ color: COULEUR.accent }}>+ {formatFCFA(fermeture.totalCartesCadeauxVendues)}</strong></p>
          <p className="text-sm mb-1">Règlements de créances historiques aujourd'hui : <strong style={{ color: COULEUR.accent }}>+ {formatFCFA(fermeture.totalReglementsCreancesHistoriques)}</strong></p>
          <p className="text-sm mb-1">Avances de livraison perçues aujourd'hui : <strong style={{ color: COULEUR.accent }}>+ {formatFCFA(fermeture.totalAvancesLivraison)}</strong></p>
          <p className="text-sm font-semibold mb-3" style={{ borderTop: `1px solid ${COULEUR.bordure}`, paddingTop: "8px" }}>Total encaissé (caisse) : <strong>{formatFCFA(fermeture.totalEncaisseGlobal)}</strong></p>

          {fermeture.remisesEnAttente?.length > 0 && (
            <div className="mb-4 p-3 rounded-xl animate-pulse" style={{ background: "#FBEAE7", border: "1px solid #B04A3B" }}>
              <p className="text-sm font-semibold mb-1" style={{ color: "#8C3B2E" }}>
                ⚠ Remises en attente de validation : {formatFCFA(fermeture.totalRemisesEnAttente)} — à traiter pour régulariser le CA
              </p>
              <table className="w-full text-xs mt-2">
                <thead><tr style={{ color: "#8C3B2E" }}><th className="text-left py-1">Demande</th><th className="text-left py-1">Vente</th><th className="text-left py-1">Demandée par</th><th className="text-right py-1">Montant</th></tr></thead>
                <tbody>
                  {fermeture.remisesEnAttente.map((r) => (
                    <tr key={r.numero} style={{ borderTop: "1px solid #E8C3BB" }}>
                      <td className="py-1">{r.numero}</td>
                      <td className="py-1">{r.venteNumero || "—"}</td>
                      <td className="py-1">{r.demandePar || "—"}</td>
                      <td className="text-right py-1">{formatFCFA(r.montantRemise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs font-semibold mb-1" style={{ color: COULEUR.texteDoux }}>Répartition par mode de paiement</p>
          <table className="w-full text-sm mb-4">
            <thead><tr style={{ color: COULEUR.texteDoux }}><th className="text-left py-1">Mode</th><th className="text-right py-1">Montant</th></tr></thead>
            <tbody>
              {fermeture.parMode.map((m) => (
                <tr key={m.mode} style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                  <td className="py-1">{m.mode}</td>
                  <td className="text-right py-1">{formatFCFA(m.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {fermeture.reglementsDetail.length > 0 && (
            <>
              <p className="text-xs font-semibold mb-1" style={{ color: COULEUR.texteDoux }}>Détail des règlements de crédit reçus</p>
              <table className="w-full text-sm mb-4">
                <thead><tr style={{ color: COULEUR.texteDoux }}><th className="text-left py-1">Vente</th><th className="text-left py-1">Client</th><th className="text-left py-1">Mode</th><th className="text-right py-1">Montant</th></tr></thead>
                <tbody>
                  {fermeture.reglementsDetail.map((r, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                      <td className="py-1">{r.venteNumero}</td>
                      <td className="py-1">{r.clientNom}</td>
                      <td className="py-1">{MODES_PAIEMENT.find((m) => m.id === r.mode)?.label || r.mode}</td>
                      <td className="text-right py-1">{formatFCFA(r.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {fermeture.cartesCadeauxVenduesDetail?.length > 0 && (
            <>
              <p className="text-xs font-semibold mb-1" style={{ color: COULEUR.texteDoux }}>Détail des cartes cadeaux vendues</p>
              <table className="w-full text-sm mb-4">
                <thead><tr style={{ color: COULEUR.texteDoux }}><th className="text-left py-1">Numéro</th><th className="text-left py-1">Mode</th><th className="text-right py-1">Montant</th></tr></thead>
                <tbody>
                  {fermeture.cartesCadeauxVenduesDetail.map((c, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                      <td className="py-1">{c.numero}</td>
                      <td className="py-1">{MODES_PAIEMENT.find((m) => m.id === c.mode)?.label || c.mode}</td>
                      <td className="text-right py-1">{formatFCFA(c.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {fermeture.reglementsCreancesDetail?.length > 0 && (
            <>
              <p className="text-xs font-semibold mb-1" style={{ color: COULEUR.texteDoux }}>Détail des règlements de créances historiques</p>
              <table className="w-full text-sm">
                <thead><tr style={{ color: COULEUR.texteDoux }}><th className="text-left py-1">Client</th><th className="text-left py-1">Mode</th><th className="text-right py-1">Montant</th></tr></thead>
                <tbody>
                  {fermeture.reglementsCreancesDetail.map((r, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                      <td className="py-1">{r.clientNom}</td>
                      <td className="py-1">{MODES_PAIEMENT.find((m) => m.id === r.mode)?.label || r.mode}</td>
                      <td className="text-right py-1">{formatFCFA(r.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {fermeture.avancesLivraisonDetail?.length > 0 && (
            <>
              <p className="text-xs font-semibold mb-1" style={{ color: COULEUR.texteDoux }}>Détail des avances de livraison perçues</p>
              <table className="w-full text-sm">
                <thead><tr style={{ color: COULEUR.texteDoux }}><th className="text-left py-1">Bon</th><th className="text-left py-1">Client</th><th className="text-left py-1">Mode</th><th className="text-right py-1">Montant</th></tr></thead>
                <tbody>
                  {fermeture.avancesLivraisonDetail.map((a, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                      <td className="py-1">{a.bonNumero}</td>
                      <td className="py-1">{a.clientNom}</td>
                      <td className="py-1">{MODES_PAIEMENT.find((m) => m.id === a.mode)?.label || a.mode}</td>
                      <td className="text-right py-1">{formatFCFA(a.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {chargement && <p className="text-sm" style={{ color: COULEUR.texteDoux }}>Chargement...</p>}

      {!chargement && donnees?.ventes && sousOnglet === "date" && (
        <>
          <div className="rounded-2xl p-5 mb-4" style={{ background: COULEUR.texte, color: "#FBF3EC" }}>
            <p className="text-xs opacity-80 mb-1">Total net ({donnees.nombre} vente{donnees.nombre > 1 ? "s" : ""})</p>
            <p className="font-display text-2xl font-semibold">{formatFCFA(donnees.total)}</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div className="rounded-2xl p-4" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
              <p className="text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Cartes cadeaux vendues</p>
              <p className="font-display text-lg font-semibold" style={{ color: COULEUR.accent }}>+ {formatFCFA(donnees.totalCartesCadeauxVendues)}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
              <p className="text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Cartes cadeaux utilisées</p>
              <p className="font-display text-lg font-semibold">{formatFCFA(donnees.totalCartesCadeauxUtilisees)}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
              <p className="text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Retours traités (avoirs générés)</p>
              <p className="font-display text-lg font-semibold" style={{ color: COULEUR.accent }}>- {formatFCFA(donnees.totalRetours)}</p>
            </div>
          </div>
          <div className="rounded-2xl" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}`, overflowX: "auto", overflowY: "hidden" }}>
            <table className="text-sm" style={{ width: "100%", minWidth: "900px" }}>
              <thead>
                <tr style={{ background: COULEUR.fond, color: COULEUR.texteDoux }}>
                  <th className="text-left px-4 py-2">N°</th>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Boutique</th>
                  <th className="text-left px-4 py-2">Vendeur</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Mode de paiement</th>
                  <th className="text-right px-4 py-2">Paires</th>
                  <th className="text-right px-4 py-2">Total</th>
                  <th className="text-right px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {donnees.ventes.map((v) => (
                  <tr key={v.id} style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                    <td className="px-4 py-2">{v.numero}</td>
                    <td className="px-4 py-2">{new Date(v.date).toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-2">{v.boutique}</td>
                    <td className="px-4 py-2">{v.vendeur?.nom}</td>
                    <td className="px-4 py-2">{v.modeVente}</td>
                    <td className="px-4 py-2">{v.paiements.map((p) => MODES_PAIEMENT.find((m) => m.id === p.mode)?.label || p.mode).join(", ")}</td>
                    <td className="text-right px-4 py-2">{v.lignes.filter((l) => l.famille === "Chaussure").reduce((s, l) => s + l.quantite, 0)}</td>
                    <td className="text-right px-4 py-2 whitespace-nowrap">{formatFCFA(v.total)}</td>
                    <td className="text-right px-4 py-2">
                      <button onClick={() => setReceiptVente(v)} className="text-xs px-2 py-1 rounded-lg" style={{ border: `1px solid ${COULEUR.bordure}`, color: COULEUR.accent }}>Réimprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${COULEUR.texte}`, fontWeight: 600 }}>
                  <td className="px-4 py-2" colSpan={6}>Total net ({donnees.nombre} vente{donnees.nombre > 1 ? "s" : ""})</td>
                  <td className="text-right px-4 py-2">{donnees.ventes.reduce((s, v) => s + v.lignes.filter((l) => l.famille === "Chaussure").reduce((s2, l) => s2 + l.quantite, 0), 0)}</td>
                  <td className="text-right px-4 py-2 whitespace-nowrap">{formatFCFA(donnees.total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {!chargement && donnees?.recap && sousOnglet === "mode" && (
        <>
          <div className="rounded-2xl p-5 mb-4" style={{ background: COULEUR.texte, color: "#FBF3EC" }}>
            <p className="text-xs opacity-80 mb-1">Total général</p>
            <p className="font-display text-2xl font-semibold">{formatFCFA(donnees.total)}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div className="rounded-2xl p-4" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
              <p className="text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Liquidités (Espèces)</p>
              <p className="font-display text-xl font-semibold" style={{ color: COULEUR.accent }}>
                {formatFCFA(donnees.recap.filter((r) => MODES_PAIEMENT.find((m) => m.id === r.mode)?.liquide).reduce((s, r) => s + r.montant, 0))}
              </p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
              <p className="text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Non liquidités (Mobile Money, Carte, Bon d'achat, Avoir...)</p>
              <p className="font-display text-xl font-semibold" style={{ color: COULEUR.accent }}>
                {formatFCFA(donnees.recap.filter((r) => !MODES_PAIEMENT.find((m) => m.id === r.mode)?.liquide).reduce((s, r) => s + r.montant, 0))}
              </p>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: COULEUR.fond, color: COULEUR.texteDoux }}>
                  <th className="text-left px-4 py-2">Mode de paiement</th>
                  <th className="text-right px-4 py-2">Nombre</th>
                  <th className="text-right px-4 py-2">Montant</th>
                </tr>
              </thead>
              <tbody>
                {donnees.recap.map((r) => (
                  <tr key={r.mode} style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                    <td className="px-4 py-2">{MODES_PAIEMENT.find((m) => m.id === r.mode)?.label || r.mode}</td>
                    <td className="text-right px-4 py-2">{r.nombre}</td>
                    <td className="text-right px-4 py-2 whitespace-nowrap">{formatFCFA(r.montant)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${COULEUR.texte}`, fontWeight: 600 }}>
                  <td className="px-4 py-2" colSpan={2}>Total</td>
                  <td className="text-right px-4 py-2 whitespace-nowrap">{formatFCFA(donnees.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {!chargement && donnees?.recap && sousOnglet === "type" && (
        <>
          <div className="rounded-2xl p-5 mb-4" style={{ background: COULEUR.texte, color: "#FBF3EC" }}>
            <p className="text-xs opacity-80 mb-1">Total général</p>
            <p className="font-display text-2xl font-semibold">{formatFCFA(donnees.total)}</p>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: COULEUR.fond, color: COULEUR.texteDoux }}>
                <th className="text-left px-4 py-2">Type de vente</th>
                <th className="text-right px-4 py-2">Nombre</th>
                <th className="text-right px-4 py-2">Montant</th>
              </tr>
            </thead>
            <tbody>
              {donnees.recap.map((r) => (
                <tr key={r.modeVente} style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                  <td className="px-4 py-2">{r.modeVente}</td>
                  <td className="text-right px-4 py-2">{r.nombre}</td>
                  <td className="text-right px-4 py-2 whitespace-nowrap">{formatFCFA(r.montant)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${COULEUR.texte}`, fontWeight: 600 }}>
                <td className="px-4 py-2" colSpan={2}>Total</td>
                <td className="text-right px-4 py-2 whitespace-nowrap">{formatFCFA(donnees.total)}</td>
              </tr>
            </tfoot>
          </table>
          </div>
        </>
      )}

      {!chargement && donnees?.classement && sousOnglet === "vendeur" && (
        <div className="space-y-4">
          {donnees.meilleur && (
            <div className="rounded-2xl p-5" style={{ background: COULEUR.texte, color: "#FBF3EC" }}>
              <p className="text-xs opacity-80 mb-1 flex items-center gap-1.5"><Award size={14} /> Meilleure vendeuse de la période</p>
              <p className="font-display text-xl font-semibold">{donnees.meilleur.nom} — {donnees.meilleur.boutique}</p>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div><p className="text-xs opacity-80">Montant vendu</p><p className="font-display text-lg font-semibold">{formatFCFA(donnees.meilleur.montant)}</p></div>
                <div><p className="text-xs opacity-80">Nombre de ventes</p><p className="font-display text-lg font-semibold">{donnees.meilleur.nombre}</p></div>
                <div><p className="text-xs opacity-80">Panier moyen</p><p className="font-display text-lg font-semibold">{formatFCFA(donnees.meilleur.panierMoyen)}</p></div>
              </div>
            </div>
          )}
          <div className="rounded-2xl overflow-hidden" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: COULEUR.fond, color: COULEUR.texteDoux }}>
                  <th className="text-left px-4 py-2">Rang</th>
                  <th className="text-left px-4 py-2">Vendeuse</th>
                  <th className="text-left px-4 py-2">Boutique</th>
                  <th className="text-right px-4 py-2">Nombre de ventes</th>
                  <th className="text-right px-4 py-2">Panier moyen</th>
                  <th className="text-right px-4 py-2">Montant vendu</th>
                </tr>
              </thead>
              <tbody>
                {donnees.classement.length === 0 && (
                  <tr><td className="px-4 py-3 text-sm" colSpan={6} style={{ color: COULEUR.texteDoux }}>Aucune vente sur cette période.</td></tr>
                )}
                {donnees.classement.map((v, i) => (
                  <tr key={v.vendeurId} style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                    <td className="px-4 py-2">{i + 1}</td>
                    <td className="px-4 py-2">{v.nom}</td>
                    <td className="px-4 py-2">{v.boutique}</td>
                    <td className="text-right px-4 py-2">{v.nombre}</td>
                    <td className="text-right px-4 py-2 whitespace-nowrap">{formatFCFA(v.panierMoyen)}</td>
                    <td className="text-right px-4 py-2 whitespace-nowrap">{formatFCFA(v.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!chargement && donnees?.classement && sousOnglet === "clients" && (
        <div className="space-y-4">
          {donnees.meilleure && (
            <div className="rounded-2xl p-5" style={{ background: COULEUR.texte, color: "#FBF3EC" }}>
              <p className="text-xs opacity-80 mb-1 flex items-center gap-1.5"><Heart size={14} /> Meilleure cliente de la période</p>
              <p className="font-display text-xl font-semibold">{donnees.meilleure.nomPrenoms}</p>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div><p className="text-xs opacity-80">Montant dépensé</p><p className="font-display text-lg font-semibold">{formatFCFA(donnees.meilleure.montant)}</p></div>
                <div><p className="text-xs opacity-80">Nombre d'achats</p><p className="font-display text-lg font-semibold">{donnees.meilleure.nombre}</p></div>
                <div><p className="text-xs opacity-80">Panier moyen</p><p className="font-display text-lg font-semibold">{formatFCFA(donnees.meilleure.panierMoyen)}</p></div>
              </div>
            </div>
          )}
          <div className="rounded-2xl overflow-hidden" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: COULEUR.fond, color: COULEUR.texteDoux }}>
                  <th className="text-left px-4 py-2">Rang</th>
                  <th className="text-left px-4 py-2">Cliente</th>
                  <th className="text-left px-4 py-2">Téléphone</th>
                  <th className="text-right px-4 py-2">Nombre d'achats</th>
                  <th className="text-right px-4 py-2">Panier moyen</th>
                  <th className="text-right px-4 py-2">Montant dépensé</th>
                </tr>
              </thead>
              <tbody>
                {donnees.classement.length === 0 && (
                  <tr><td className="px-4 py-3 text-sm" colSpan={6} style={{ color: COULEUR.texteDoux }}>Aucun achat rattaché à une cliente sur cette période.</td></tr>
                )}
                {donnees.classement.map((c, i) => (
                  <tr key={c.clientId} style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                    <td className="px-4 py-2">{i + 1}</td>
                    <td className="px-4 py-2">{c.nomPrenoms}{c.carteFidelite ? ` · Carte ${c.carteFidelite}` : ""}</td>
                    <td className="px-4 py-2">{c.telephone}</td>
                    <td className="text-right px-4 py-2">{c.nombre}</td>
                    <td className="text-right px-4 py-2 whitespace-nowrap">{formatFCFA(c.panierMoyen)}</td>
                    <td className="text-right px-4 py-2 whitespace-nowrap">{formatFCFA(c.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!chargement && donnees?.paires && sousOnglet === "livraisons" && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="rounded-2xl p-4" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
              <p className="text-xs" style={{ color: COULEUR.texteDoux }}>Bons sur la période</p>
              <p className="font-display text-2xl font-semibold">{donnees.nombreBons}</p>
              <p className="text-xs mt-1" style={{ color: COULEUR.texteDoux }}>{donnees.nombreEnCours} en cours · {donnees.nombreClotures} clôturés{donnees.nombreAnnules > 0 ? ` · ${donnees.nombreAnnules} annulés` : ""}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
              <p className="text-xs" style={{ color: COULEUR.texteDoux }}>Paires parties</p>
              <p className="font-display text-2xl font-semibold">{donnees.paires.parties}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "#E9F0EA" }}>
              <p className="text-xs" style={{ color: "#3F6B4A" }}>Vendues / Rendues</p>
              <p className="font-display text-2xl font-semibold" style={{ color: "#3F6B4A" }}>{donnees.paires.vendues} / {donnees.paires.retournees}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: donnees.paires.perdues > 0 ? "#FBEAE7" : COULEUR.carte, border: donnees.paires.perdues > 0 ? "1px solid #B04A3B" : `1px solid ${COULEUR.bordure}` }}>
              <p className="text-xs" style={{ color: donnees.paires.perdues > 0 ? "#B04A3B" : COULEUR.texteDoux }}>Perdues / cassées</p>
              <p className="font-display text-2xl font-semibold" style={{ color: donnees.paires.perdues > 0 ? "#B04A3B" : COULEUR.texte }}>{donnees.paires.perdues}</p>
              {donnees.valeurPertes > 0 && <p className="text-xs mt-1" style={{ color: "#B04A3B" }}>{formatFCFA(donnees.valeurPertes)}</p>}
            </div>
          </div>

          {donnees.parBoutique.length > 1 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
              <table className="w-full text-sm">
                <thead><tr style={{ background: COULEUR.fond, color: COULEUR.texteDoux }}><th className="text-left px-4 py-2">Boutique</th><th className="text-right px-4 py-2">Bons</th><th className="text-right px-4 py-2">Parties</th><th className="text-right px-4 py-2">Vendues</th><th className="text-right px-4 py-2">Rendues</th><th className="text-right px-4 py-2">Perdues</th></tr></thead>
                <tbody>
                  {donnees.parBoutique.map((pb) => (
                    <tr key={pb.boutique} style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                      <td className="px-4 py-2">{pb.boutique}</td>
                      <td className="text-right px-4 py-2">{pb.nombreBons}</td>
                      <td className="text-right px-4 py-2">{pb.parties}</td>
                      <td className="text-right px-4 py-2">{pb.vendues}</td>
                      <td className="text-right px-4 py-2">{pb.retournees}</td>
                      <td className="text-right px-4 py-2" style={{ color: pb.perdues > 0 ? "#B04A3B" : COULEUR.texte }}>{pb.perdues}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-2xl overflow-hidden" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: COULEUR.fond, color: COULEUR.texteDoux }}>
                  <th className="text-left px-4 py-2">Bon</th>
                  <th className="text-left px-4 py-2">Client</th>
                  <th className="text-left px-4 py-2">Boutique</th>
                  <th className="text-left px-4 py-2">Statut</th>
                  <th className="text-left px-4 py-2">Créé le</th>
                  <th className="text-left px-4 py-2">Vente générée</th>
                </tr>
              </thead>
              <tbody>
                {donnees.bons.length === 0 && (
                  <tr><td className="px-4 py-3 text-sm" colSpan={6} style={{ color: COULEUR.texteDoux }}>Aucun bon de livraison sur cette période.</td></tr>
                )}
                {donnees.bons.map((b) => (
                  <tr key={b.numero} style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                    <td className="px-4 py-2">{b.numero}</td>
                    <td className="px-4 py-2">{b.clientNom}</td>
                    <td className="px-4 py-2">{b.boutique}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={
                        b.statut === "EN_COURS" ? { background: "#F1E9DC", color: "#6B5D52" }
                        : b.statut === "ANNULE" ? { background: "#FBEAE7", color: "#B04A3B" }
                        : { background: "#E9F0EA", color: "#3F6B4A" }
                      }>{b.statut === "EN_COURS" ? "En cours" : b.statut === "ANNULE" ? "Annulé" : "Clôturé"}</span>
                    </td>
                    <td className="px-4 py-2">{new Date(b.dateCreation).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-2">{b.venteGeneree ? `${b.venteGeneree.numero} (${formatFCFA(b.venteGeneree.total)})` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!chargement && donnees?.parBoutique && sousOnglet === "recap" && (
        <div className="space-y-4">
          {donnees.parBoutique.map((b) => (
            <div key={b.boutique} className="rounded-2xl p-5" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
              <p className="font-display text-lg font-semibold mb-3">{b.boutique}</p>
              <div className="grid sm:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs" style={{ color: COULEUR.texteDoux }}>Total des ventes ({b.nombreVentes})</p>
                  <p className="font-display text-xl font-semibold" style={{ color: COULEUR.accent }}>{formatFCFA(b.totalVentes)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: COULEUR.texteDoux }}>Retours traités</p>
                  <p className="font-display text-xl font-semibold" style={{ color: COULEUR.accent }}>- {formatFCFA(b.totalRetours)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: COULEUR.texteDoux }}>Total des règlements encaissés</p>
                  <p className="font-display text-xl font-semibold" style={{ color: COULEUR.accent }}>{formatFCFA(b.totalReglements)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: COULEUR.texteDoux }}>Cartes cadeaux vendues</p>
                  <p className="font-display text-xl font-semibold" style={{ color: COULEUR.accent }}>{formatFCFA(b.totalCartesCadeauxVendues)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: COULEUR.texteDoux }}>Créances historiques réglées</p>
                  <p className="font-display text-xl font-semibold" style={{ color: COULEUR.accent }}>{formatFCFA(b.totalReglementsCreancesHistoriques)}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-2xl p-5" style={{ background: COULEUR.texte, color: "#FBF3EC" }}>
            <p className="font-display text-lg font-semibold mb-3">Cumul des 2 boutiques</p>
            <div className="grid sm:grid-cols-5 gap-4">
              <div>
                <p className="text-xs opacity-80">Total des ventes ({donnees.cumul.nombreVentes})</p>
                <p className="font-display text-xl font-semibold">{formatFCFA(donnees.cumul.totalVentes)}</p>
              </div>
              <div>
                <p className="text-xs opacity-80">Retours traités</p>
                <p className="font-display text-xl font-semibold">- {formatFCFA(donnees.cumul.totalRetours)}</p>
              </div>
              <div>
                <p className="text-xs opacity-80">Total des règlements encaissés</p>
                <p className="font-display text-xl font-semibold">{formatFCFA(donnees.cumul.totalReglements)}</p>
              </div>
              <div>
                <p className="text-xs opacity-80">Cartes cadeaux vendues</p>
                <p className="font-display text-xl font-semibold">{formatFCFA(donnees.cumul.totalCartesCadeauxVendues)}</p>
              </div>
              <div>
                <p className="text-xs opacity-80">Créances historiques réglées</p>
                <p className="font-display text-xl font-semibold">{formatFCFA(donnees.cumul.totalReglementsCreancesHistoriques)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!chargement && donnees?.lignes && sousOnglet === "audit" && (
        <div>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div className="rounded-2xl p-4" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
              <p className="text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Ventes avec remise (période)</p>
              <p className="font-display text-xl font-semibold">{donnees.total}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: donnees.nbSuspectes > 0 ? "#FBEAE7" : COULEUR.carte, border: `1px solid ${donnees.nbSuspectes > 0 ? COULEUR.accent : COULEUR.bordure}` }}>
              <p className="text-xs mb-1" style={{ color: COULEUR.texteDoux }}>Anomalies détectées</p>
              <p className="font-display text-xl font-semibold" style={{ color: donnees.nbSuspectes > 0 ? COULEUR.accent : "#3F6B4A" }}>{donnees.nbSuspectes}</p>
            </div>
          </div>

          {donnees.nbSuspectes === 0 ? (
            <p className="text-sm px-4 py-3 rounded-lg" style={{ background: "#E9F0EA", color: "#3F6B4A" }}>Aucune anomalie — toutes les remises appliquées correspondent à une demande approuvée par toi.</p>
          ) : (
            <p className="text-sm px-4 py-3 rounded-lg mb-4" style={{ background: "#FBEAE7", color: "#8C3B2E" }}>⚠ {donnees.nbSuspectes} vente(s) avec remise ne correspondent à aucune demande approuvée valide — à vérifier ci-dessous.</p>
          )}

          <div className="rounded-2xl overflow-hidden" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: COULEUR.fond, color: COULEUR.texteDoux }}>
                  <th className="text-left px-4 py-2">Vente</th>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Boutique</th>
                  <th className="text-left px-4 py-2">Caissier</th>
                  <th className="text-right px-4 py-2">Remise</th>
                  <th className="text-left px-4 py-2">Demande</th>
                  <th className="text-left px-4 py-2">Traitée par</th>
                  <th className="text-left px-4 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {donnees.lignes.length === 0 && (
                  <tr><td className="px-4 py-3 text-sm" colSpan={8} style={{ color: COULEUR.texteDoux }}>Aucune vente avec remise sur cette période.</td></tr>
                )}
                {donnees.lignes.map((l) => (
                  <tr key={l.venteId} style={{ borderTop: `1px solid ${COULEUR.bordure}`, background: l.suspecte ? "#FBEAE7" : "transparent" }}>
                    <td className="px-4 py-2 font-mono">{l.venteNumero}</td>
                    <td className="px-4 py-2">{new Date(l.date).toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-2">{l.boutique}</td>
                    <td className="px-4 py-2">{l.caissier || "—"}</td>
                    <td className="text-right px-4 py-2 whitespace-nowrap">{formatFCFA(l.montantRemise)}</td>
                    <td className="px-4 py-2 font-mono">{l.demandeNumero || "—"}</td>
                    <td className="px-4 py-2">{l.traitePar || "—"}</td>
                    <td className="px-4 py-2">
                      {l.suspecte ? (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>{l.problemes.join(", ")}</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#E9F0EA", color: "#3F6B4A" }}>OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {receiptVente && <ReceiptModal vente={receiptVente} onClose={() => setReceiptVente(null)} />}
        </div>
      </div>
    </div>
  );
}
