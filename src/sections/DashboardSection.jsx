import { useState, useEffect, useCallback } from "react";
import { TrendingUp, ShoppingBag, AlertTriangle, CreditCard, Award, Cake, Percent, Gift, Truck, Wallet, X, Crown } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { fmt, MOIS, LIVRAISON_ACTIF, FIDELITE_ACTIF, MODES_PAIEMENT } from "../constants.js";

const COULEUR = { fond: "#FAF7F2", carte: "#FFFFFF", bordure: "#EAE1D2", texte: "#2B2320", texteDoux: "#6B5D52", accent: "#8C3B2E" };
const SEUIL_STOCK_FAIBLE = 3;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function debutSemaineISO() {
  const d = new Date();
  const jour = d.getDay();
  const decalage = jour === 0 ? 6 : jour - 1;
  d.setDate(d.getDate() - decalage);
  return d.toISOString().slice(0, 10);
}
function debutMoisISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function DashboardSection({ onNaviguerVentes, onNaviguerFidelite } = {}) {
  const { user, permissions } = useAuth();
  const estAdmin = !!user?.role?.systeme;
  const peutVoirVentes = !!permissions.ventes;
  const peutVoirStock = !!permissions.stock;

  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [caJour, setCaJour] = useState(null);
  const [modesJour, setModesJour] = useState(null);
  const [echeancesProches, setEcheancesProches] = useState(null);
  const [rappelEnCours, setRappelEnCours] = useState(null);
  const [detailOuvert, setDetailOuvert] = useState(null); // { titre, lignes } | null
  const [caMois, setCaMois] = useState(null);
  const [alertesStock, setAlertesStock] = useState([]);
  const [credits, setCredits] = useState(null);
  const [meilleurVendeur, setMeilleurVendeur] = useState(null);
  const [anniversaires, setAnniversaires] = useState([]);
  const [remisesEnAttente, setRemisesEnAttente] = useState(null);
  const [correctionsRemises, setCorrectionsRemises] = useState(null);
  const [changementsStatut, setChangementsStatut] = useState(null);
  const [statutEnCours, setStatutEnCours] = useState(null);
  const [resumeCartesCadeaux, setResumeCartesCadeaux] = useState([]);
  const [livraisonJour, setLivraisonJour] = useState(null);

  const chargerEcheances = useCallback(() => {
    api.bonsValeur.echeancesProches(7).then(setEcheancesProches).catch(() => {});
  }, []);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const jour = todayISO();

      if (peutVoirVentes) {
        if (estAdmin) {
          const recap = await api.etats.recapBoutiques({ dateDebut: jour, dateFin: jour });
          setCaJour({ parBoutique: recap.parBoutique, cumul: recap.cumul });
          const recapMois = await api.etats.recapBoutiques({ dateDebut: debutMoisISO(), dateFin: jour });
          setCaMois({ cumul: recapMois.cumul });
        } else {
          const res = await api.etats.parDate({ dateDebut: jour, dateFin: jour });
          setCaJour({ parBoutique: [{ boutique: user.boutique, totalVentes: res.total, nombreVentes: res.nombre }], cumul: { totalVentes: res.total, nombreVentes: res.nombre } });
          const resMois = await api.etats.parDate({ dateDebut: debutMoisISO(), dateFin: jour });
          setCaMois({ cumul: { nombreVentes: resMois.nombre, totalVentes: resMois.total } });
        }

        api.etats.parModePaiement({ dateDebut: jour, dateFin: jour, ...(estAdmin ? {} : { boutique: user.boutique }) })
          .then(setModesJour).catch(() => {});

        chargerEcheances();

        const paramsBoutique = estAdmin ? {} : { boutique: user.boutique };
        const [creditListe, vendeurRes] = await Promise.all([
          api.ventes.creditListe(paramsBoutique),
          api.etats.parVendeur({ ...paramsBoutique, dateDebut: debutSemaineISO(), dateFin: jour }),
        ]);
        const enAttente = creditListe.filter((v) => v.resteAPayer > 0);
        const clientsUniques = new Set(enAttente.map((v) => v.clientId));
        setCredits({
          total: enAttente.reduce((s, v) => s + v.resteAPayer, 0),
          nombreClients: clientsUniques.size,
          top: [...enAttente].sort((a, b) => b.resteAPayer - a.resteAPayer).slice(0, 5),
        });
        setMeilleurVendeur(vendeurRes.meilleur);
      }

      if (estAdmin) {
        const clients = await api.clients.list();
        const aujourdhui = new Date();
        const jourAujourdhui = aujourdhui.getDate();
        const moisAujourdhui = MOIS[aujourdhui.getMonth()];
        const bientot = clients.filter((c) => parseInt(c.jourAnniv, 10) === jourAujourdhui && c.moisAnniv === moisAujourdhui);
        const anneeEnCours = aujourdhui.getFullYear();
        const bientotAvecCumul = await Promise.all(bientot.map(async (c) => {
          const ventes = await api.ventes.list({ clientId: c.id });
          const cumulAnnee = ventes.filter((v) => new Date(v.date).getFullYear() === anneeEnCours).reduce((s, v) => s + v.total, 0);
          return { ...c, cumulAnnee };
        }));
        setAnniversaires(bientotAvecCumul);

        const [remisesRes, remisesApprouveesRes, resumeRes] = await Promise.all([
          api.remises.list("EN_ATTENTE"),
          api.remises.list("APPROUVEE"),
          api.denominationsCartesCadeaux.resume(),
        ]);
        setRemisesEnAttente({
          nombre: remisesRes.length,
          total: remisesRes.reduce((s, r) => s + r.montantRemise, 0),
          top: [...remisesRes]
            .sort((a, b) => new Date(a.createdAt || a.vente?.date || a.retour?.date || 0) - new Date(b.createdAt || b.vente?.date || b.retour?.date || 0))
            .slice(0, 5),
        });
        // Corrections de CA déjà appliquées suite à une remise approuvée — utile pour repérer
        // quelles journées ont bougé après coup (voir le jour de la vente, pas celui de
        // l'approbation, dans États → Par date).
        setCorrectionsRemises(
          [...remisesApprouveesRes]
            .sort((a, b) => new Date(b.dateTraitement) - new Date(a.dateTraitement))
            .slice(0, 5)
        );
        setResumeCartesCadeaux(resumeRes);

        if (LIVRAISON_ACTIF) {
          api.etats.livraisonJour().then(setLivraisonJour).catch(() => {});
        }
        if (FIDELITE_ACTIF) {
          api.fidelite.changementsStatut().then(setChangementsStatut).catch(() => {});
        }
      }      

    // Alerte stock faible : utile pour un gestionnaire de stock au quotidien, pas pour Djenie
    // qui fonctionne par collections (un stock faible sur un modèle n'est pas anormal chez elle).
    if (peutVoirStock && !estAdmin) {
        const articles = await api.articles.list();
        const alertes = [];
        for (const a of articles) {
          for (const s of a.stocks || []) {
            if (!estAdmin && s.boutique !== user.boutique) continue;
            if (s.quantite <= SEUIL_STOCK_FAIBLE) {
              alertes.push({ designation: a.designation, reference: a.reference, boutique: s.boutique, pointure: s.pointure, quantite: s.quantite });
            }
          }
        }
        alertes.sort((x, y) => x.quantite - y.quantite);
        setAlertesStock(alertes.slice(0, 8));
      }
    } catch (e) {
      setErreur(e.message || "Erreur lors du chargement du tableau de bord.");
    } finally {
      setChargement(false);
    }
  }, [estAdmin, peutVoirVentes, peutVoirStock, user, chargerEcheances]);

  useEffect(() => { charger(); }, [charger]);

  const toggleRappel = async (bon) => {
    setRappelEnCours(bon.id);
    try {
      await api.bonsValeur.marquerRappel(bon.id, !bon.rappelEffectue);
      chargerEcheances();
    } catch (e) { /* ignore, l'utilisateur peut retenter */ } finally { setRappelEnCours(null); }
  };

  const marquerStatutVu = async (changement) => {
    setStatutEnCours(changement.id);
    try {
      await api.fidelite.marquerChangementStatutVu(changement.id);
      setChangementsStatut((liste) => liste.filter((c) => c.id !== changement.id));
    } catch (e) { /* ignore, l'utilisateur peut retenter */ } finally { setStatutEnCours(null); }
  };

  if (chargement) return <p className="text-sm" style={{ color: COULEUR.texteDoux }}>Chargement…</p>;

  return (
    <div>
      {erreur && <p className="text-sm mb-4 p-3 rounded-lg" style={{ color: "#B04A3B", background: "#FBEAE7" }}>⚠ {erreur}</p>}

      <p className="font-display text-2xl font-semibold mb-6">
        Bonjour {user?.prenom} 👋
      </p>

      {peutVoirVentes && caJour && (
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl p-5" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
            <p className="text-xs font-mono uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color: COULEUR.accent }}>
              <TrendingUp size={14} /> Chiffre d'affaires du jour
            </p>
            <div className="flex gap-6 items-end flex-wrap">
              {caJour.parBoutique.map((b) => (
                <div key={b.boutique}>
                  <p className="text-xs" style={{ color: COULEUR.texteDoux }}>{b.boutique}</p>
                  <p className="font-display text-lg font-semibold">{fmt(b.totalVentes)} F</p>
                </div>
              ))}
              {caJour.parBoutique.length > 1 && (
                <div>
                  <p className="text-xs" style={{ color: COULEUR.texteDoux }}>Total</p>
                  <p className="font-display text-xl font-semibold" style={{ color: COULEUR.accent }}>{fmt(caJour.cumul.totalVentes)} F</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
            <p className="text-xs font-mono uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color: COULEUR.accent }}>
              <ShoppingBag size={14} /> Ventes du mois
            </p>
            <p className="font-display text-3xl font-semibold">{caMois?.cumul.nombreVentes ?? "…"}</p>
            {caMois && <p className="text-sm mt-1" style={{ color: COULEUR.texteDoux }}>{fmt(caMois.cumul.totalVentes)} F cumulés</p>}
          </div>
        </div>
      )}

      {peutVoirVentes && modesJour && (
        <div className="rounded-2xl p-5 mb-6" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
          <p className="text-xs font-mono uppercase tracking-wide mb-1 flex items-center gap-1.5" style={{ color: COULEUR.accent }}>
            <Wallet size={14} /> Encaissements du jour, par mode de paiement
          </p>
          <p className="text-xs mb-3" style={{ color: COULEUR.texteDoux }}>Le chiffre d'affaires ci-dessus, c'est la valeur des articles vendus aujourd'hui. Ici, c'est comment ça a été payé — utile pour vérifier ce qui doit vraiment être en espèces dans le tiroir.</p>
          <div className="flex flex-wrap gap-4">
            {modesJour.recap.length === 0 && <p className="text-sm" style={{ color: COULEUR.texteDoux }}>Aucun encaissement aujourd'hui.</p>}
            {modesJour.recap.map((r) => {
              const estCarteOuAvoir = r.mode === "bon_achat" || r.mode === "avoir";
              const libelle = MODES_PAIEMENT.find((m) => m.id === r.mode)?.label || r.mode;
              return (
                <button key={r.mode} onClick={() => setDetailOuvert({ titre: libelle, lignes: r.detail })} className="rounded-xl px-3 py-2 text-left" style={{ background: estCarteOuAvoir ? "#FBEAE7" : "#F1E9DC", cursor: "pointer" }}>
                  <p className="text-xs" style={{ color: estCarteOuAvoir ? "#B04A3B" : COULEUR.texteDoux }}>
                    {libelle}
                    {estCarteOuAvoir ? " (déjà encaissé avant)" : ""}
                  </p>
                  <p className="font-display text-base font-semibold" style={{ color: estCarteOuAvoir ? "#B04A3B" : COULEUR.texte }}>{fmt(r.montant)} F</p>
                </button>
              );
            })}
            {modesJour.totalCredit > 0 && (
              <button onClick={() => setDetailOuvert({ titre: "Crédit (à encaisser plus tard)", lignes: modesJour.creditDetail })} className="rounded-xl px-3 py-2 text-left" style={{ background: "#F1E9DC", border: "1px dashed #A8823D", cursor: "pointer" }}>
                <p className="text-xs" style={{ color: "#A8823D" }}>Crédit (à encaisser plus tard)</p>
                <p className="font-display text-base font-semibold" style={{ color: "#A8823D" }}>{fmt(modesJour.totalCredit)} F</p>
              </button>
            )}
          </div>
        </div>
      )}

      {peutVoirVentes && echeancesProches && echeancesProches.length > 0 && (
        <div className="rounded-2xl p-5 mb-6" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
          <style>{`
            @keyframes clignoteRappel { 0%, 100% { background: #FBEAE7; } 50% { background: #F6C9C0; } }
            .rappel-a-faire { animation: clignoteRappel 1.4s ease-in-out infinite; }
          `}</style>
          <p className="text-xs font-mono uppercase tracking-wide mb-1 flex items-center gap-1.5" style={{ color: COULEUR.accent }}>
            <AlertTriangle size={14} /> Avoirs et cartes cadeaux à échéance dans moins de 7 jours
          </p>
          <p className="text-xs mb-3" style={{ color: COULEUR.texteDoux }}>Pense à appeler la cliente pour lui rappeler de venir l'utiliser avant qu'il ne soit définitivement perdu.</p>
          <div className="space-y-2">
            {echeancesProches.map((b) => {
              const joursRestants = Math.ceil((new Date(b.dateValidite) - new Date()) / (1000 * 60 * 60 * 24));
              return (
                <div key={b.id} className={`flex items-center justify-between rounded-lg px-4 py-3 ${!b.rappelEffectue ? "rappel-a-faire" : ""}`} style={{ background: b.rappelEffectue ? "#E9F0EA" : "#FBEAE7" }}>
                  <div>
                    <p className="text-sm font-medium">{b.type === "AVOIR" ? "Avoir" : "Carte cadeau"} {b.numero} — {fmt(b.montant)} F</p>
                    <p className="text-xs" style={{ color: "#6B5D52" }}>
                      {b.client ? `${b.client.nomPrenoms}${b.client.telephone ? ` · ${b.client.telephone}` : ""}` : "Client inconnu"}
                      {" · Expire dans "}{joursRestants <= 0 ? "moins d'un jour" : `${joursRestants} jour${joursRestants > 1 ? "s" : ""}`}
                      {" (le "}{new Date(b.dateValidite).toLocaleDateString("fr-FR")}{")"}
                    </p>
                  </div>
                  <button onClick={() => toggleRappel(b)} disabled={rappelEnCours === b.id} className="text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap" style={b.rappelEffectue ? { border: "1px solid #DDD3C4", color: "#6B5D52" } : { background: "#8C3B2E", color: "#FBF3EC" }}>
                    {b.rappelEffectue ? "Appelée ✓ (annuler)" : "Marquer appelée"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {FIDELITE_ACTIF && peutVoirVentes && changementsStatut && changementsStatut.length > 0 && (
        <div className="rounded-2xl p-5 mb-6" style={{ background: COULEUR.carte, border: "1px solid #A8823D" }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-mono uppercase tracking-wide flex items-center gap-1.5" style={{ color: "#A8823D" }}>
              <Crown size={14} /> Nouveaux statuts Cendrillon
            </p>
            {changementsStatut.length > 5 && onNaviguerFidelite && (
              <button type="button" onClick={onNaviguerFidelite} className="text-xs font-medium" style={{ color: "#A8823D" }}>Voir tout →</button>
            )}
          </div>
          <p className="text-xs mb-3" style={{ color: COULEUR.texteDoux }}>Une occasion de reconnaître ces clientes — à toi de voir s'il y a un geste commercial à faire.</p>
          <div className="space-y-2">
            {changementsStatut.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: "#FBF3E3" }}>
                <div>
                  <p className="text-sm font-medium">{c.client?.nomPrenoms || "Cliente inconnue"}</p>
                  <p className="text-xs" style={{ color: "#6B5D52" }}>
                    {c.ancienStatut ? `${c.ancienStatut} → ` : ""}<strong>{c.nouveauStatut}</strong>
                    {c.client?.telephone ? ` · ${c.client.telephone}` : ""}
                  </p>
                </div>
                <button onClick={() => marquerStatutVu(c)} disabled={statutEnCours === c.id} className="text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap" style={{ background: "#A8823D", color: "#2B2320" }}>
                  Vu
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {detailOuvert && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
          <div className="rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" style={{ background: "#FFFDF9" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display text-lg font-semibold">{detailOuvert.titre}</p>
              <button onClick={() => setDetailOuvert(null)} style={{ color: COULEUR.texteDoux }}><X size={18} /></button>
            </div>
            {(!detailOuvert.lignes || detailOuvert.lignes.length === 0) && (
              <p className="text-sm" style={{ color: COULEUR.texteDoux }}>Aucun détail disponible.</p>
            )}
            <div className="space-y-2">
              {detailOuvert.lignes?.map((l, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: COULEUR.fond }}>
                  <div>
                    <p className="text-sm font-medium">{l.venteNumero}</p>
                    <p className="text-xs" style={{ color: COULEUR.texteDoux }}>{l.clientNom} · {new Date(l.heure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <p className="font-mono text-sm font-medium">{fmt(l.montant)} F</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {peutVoirStock && !estAdmin && (
          <div className="rounded-2xl p-5" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
            <p className="text-xs font-mono uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color: "#B04A3B" }}>
              <AlertTriangle size={14} /> Alertes stock faible (≤ {SEUIL_STOCK_FAIBLE})
            </p>
            {alertesStock.length === 0 ? (
              <p className="text-sm" style={{ color: COULEUR.texteDoux }}>Aucune alerte pour l'instant.</p>
            ) : (
              <div className="space-y-2">
                {alertesStock.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{a.designation} {a.pointure ? `· T${a.pointure}` : ""} <span className="text-xs" style={{ color: COULEUR.texteDoux }}>({a.boutique})</span></span>
                    <span className="font-mono px-2 py-0.5 rounded-full text-xs" style={{ background: a.quantite === 0 ? "#FBEAE7" : "#FDF3E3", color: a.quantite === 0 ? "#B04A3B" : "#A8823D" }}>
                      {a.quantite}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {peutVoirVentes && credits && (
          <div className="rounded-2xl p-5" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
            <p className="text-xs font-mono uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color: COULEUR.accent }}>
              <CreditCard size={14} /> Créances en cours
            </p>
            <div className="flex items-center justify-between mb-1">
              <p className="font-display text-2xl font-semibold">{fmt(credits.total)} F</p>
              {onNaviguerVentes && (
                <button type="button" onClick={() => onNaviguerVentes("credit")} className="text-xs font-medium" style={{ color: COULEUR.accent }}>Voir tout →</button>
              )}
            </div>
            <p className="text-xs mb-3" style={{ color: COULEUR.texteDoux }}>{credits.nombreClients} client(s) concerné(s)</p>
          {credits.top.length > 0 && (
              <div className="space-y-2.5 pt-3" style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                {credits.top.map((v) => (
                  <div key={v.id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span>{v.client?.nomPrenoms || "Client"}</span>
                      <span className="font-mono font-semibold" style={{ color: COULEUR.accent }}>{fmt(v.resteAPayer)} F</span>
                    </div>
                    <div className="flex items-center justify-between text-xs" style={{ color: COULEUR.texteDoux }}>
                      <span>{new Date(v.date).toLocaleDateString("fr-FR")} · Payé {fmt(v.totalPaye)} F</span>
                    </div>
                  </div>
             ))}
              </div>
            )}
          </div>
        )}

        {estAdmin && remisesEnAttente && (
          <div className="rounded-2xl p-5" style={{ background: COULEUR.carte, border: remisesEnAttente.nombre > 0 ? "1px solid #B04A3B" : `1px solid ${COULEUR.bordure}` }}>
            <p className="text-xs font-mono uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color: remisesEnAttente.nombre > 0 ? "#B04A3B" : COULEUR.accent }}>
              <Percent size={14} /> Remises en attente {remisesEnAttente.nombre > 0 && <span className="animate-pulse">●</span>}
            </p>
            {remisesEnAttente.nombre === 0 ? (
              <p className="text-sm" style={{ color: COULEUR.texteDoux }}>Rien à traiter pour l'instant.</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-display text-2xl font-semibold">{remisesEnAttente.nombre} demande(s)</p>
                  {onNaviguerVentes && (
                    <button type="button" onClick={() => onNaviguerVentes("remises-admin")} className="text-xs font-medium" style={{ color: "#B04A3B" }}>Voir tout →</button>
                  )}
                </div>
                <p className="text-xs mb-3" style={{ color: COULEUR.texteDoux }}>{fmt(remisesEnAttente.total)} F à régulariser au total</p>
                <div className="space-y-1.5 pt-3" style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                  {remisesEnAttente.top.map((r) => {
                    const jours = Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 86400000);
                    return (
                      <div key={r.id} className="flex items-start justify-between gap-3 text-sm">
                        <span className="min-w-0">
                          {r.numero}{r.clientNom ? ` · ${r.clientNom}` : ""}{r.vente ? ` · vente du ${new Date(r.vente.date).toLocaleDateString("fr-FR")}` : ""}
                          {jours >= 1 && <span className="ml-1.5" style={{ color: jours >= 3 ? "#B04A3B" : COULEUR.texteDoux }}>· en attente depuis {jours} jour{jours > 1 ? "s" : ""}</span>}
                        </span>
                        <span className="font-mono shrink-0 whitespace-nowrap text-right" style={{ color: "#B04A3B" }}>{fmt(r.montantRemise)} F</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {estAdmin && correctionsRemises && correctionsRemises.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono uppercase tracking-wide flex items-center gap-1.5" style={{ color: COULEUR.accent }}>
                <Percent size={14} /> Corrections de CA suite à remise
              </p>
              {onNaviguerVentes && (
                <button type="button" onClick={() => onNaviguerVentes("remises-admin")} className="text-xs font-medium" style={{ color: COULEUR.accent }}>Voir tout →</button>
              )}
            </div>
            <p className="text-xs mb-3" style={{ color: COULEUR.texteDoux }}>
              Le CA de ces journées a été corrigé après coup — pense à reporter l'ajustement dans ta comptabilité sur la date de la vente, pas celle de l'approbation.
            </p>
            <div className="space-y-1.5 pt-3" style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
              {correctionsRemises.map((r) => {
                const dateVente = r.vente?.date || r.retour?.date;
                return (
                  <div key={r.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      {r.numero}{r.clientNom ? ` · ${r.clientNom}` : ""}
                      {dateVente && <> · vente du <strong>{new Date(dateVente).toLocaleDateString("fr-FR")}</strong></>}
                      <span className="ml-1.5" style={{ color: COULEUR.texteDoux }}>(approuvée le {new Date(r.dateTraitement).toLocaleDateString("fr-FR")})</span>
                    </span>
                    <span className="font-mono shrink-0 whitespace-nowrap text-right" style={{ color: "#3F6B4A" }}>-{fmt(r.montantRemise)} F</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {estAdmin && resumeCartesCadeaux.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
            <p className="text-xs font-mono uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color: COULEUR.accent }}>
              <Gift size={14} /> Cartes cadeaux
            </p>
            <div className="space-y-3">
              {resumeCartesCadeaux.map((r) => (
                <div key={r.id}>
                  <p className="text-sm font-medium">{fmt(r.montant)} F {!r.actif && <span className="text-xs" style={{ color: COULEUR.texteDoux }}>(inactif)</span>}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {(r.parBoutique || []).map((pb) => (
                      <span key={pb.boutique} className="flex items-center gap-1.5 text-xs">
                        <span style={{ color: COULEUR.texteDoux }}>{pb.boutique} :</span>
                        <span className="font-mono px-2 py-0.5 rounded-full" style={{ background: pb.enStock <= 5 ? "#FBEAE7" : "#F1E9DC", color: pb.enStock <= 5 ? "#B04A3B" : "#6B5D52" }}>
                          {pb.enStock} en stock{pb.enStock <= 5 ? " ⚠" : ""}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {LIVRAISON_ACTIF && estAdmin && livraisonJour && (
          <div className="rounded-2xl p-5" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
            <p className="text-xs font-mono uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color: COULEUR.accent }}>
              <Truck size={14} /> Livraisons du jour
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {livraisonJour.parBoutique?.map((b) => (
                <div key={b.boutique}>
                  <p className="text-xs font-medium mb-1" style={{ color: COULEUR.texteDoux }}>{b.boutique}</p>
                  <div className="flex gap-4">
                    <div><p className="text-xs" style={{ color: COULEUR.texteDoux }}>Parties</p><p className="font-display text-lg font-semibold">{b.parties}</p></div>
                    <div><p className="text-xs" style={{ color: COULEUR.texteDoux }}>Rendues</p><p className="font-display text-lg font-semibold" style={{ color: "#3F6B4A" }}>{b.retournees}</p></div>
                  </div>
                </div>
              ))}
            </div>
            {(livraisonJour.parBoutique?.length || 0) > 1 && (
              <div className="flex gap-6 mt-3 pt-3" style={{ borderTop: `1px solid ${COULEUR.bordure}` }}>
                <div><p className="text-xs" style={{ color: COULEUR.texteDoux }}>Total parties</p><p className="font-display text-xl font-semibold" style={{ color: COULEUR.accent }}>{livraisonJour.parties}</p></div>
                <div><p className="text-xs" style={{ color: COULEUR.texteDoux }}>Total rendues</p><p className="font-display text-xl font-semibold" style={{ color: "#3F6B4A" }}>{livraisonJour.retournees}</p></div>
              </div>
            )}
          </div>
        )}
      </div>

      {estAdmin && anniversaires.length > 0 && (        <div className="rounded-2xl p-5 mb-6" style={{ background: COULEUR.carte, border: `1px solid ${COULEUR.bordure}` }}>
          <p className="text-xs font-mono uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color: COULEUR.accent }}>
            <Cake size={14} /> Anniversaires aujourd'hui
          </p>
          <div className="space-y-1.5">
            {anniversaires.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <div>
                  <span>{c.nomPrenoms}</span>
                  <span className="text-xs ml-2" style={{ color: COULEUR.texteDoux }}>{c.telephone || "— pas de téléphone"}</span>
                </div>
                <span className="text-xs font-mono" style={{ color: COULEUR.texteDoux }}>Cumul {fmt(c.cumulAnnee)} F</span>
              </div>
            ))}
    </div>
        </div>
      )}
     {peutVoirVentes && meilleurVendeur && (
        <div className="rounded-2xl p-5" style={{ background: COULEUR.texte, color: "#FBF3EC" }}>
          <p className="text-xs opacity-80 mb-1 flex items-center gap-1.5"><Award size={14} /> Meilleur vendeur de la semaine</p>
          <p className="font-display text-lg font-semibold">{meilleurVendeur.nom} — {meilleurVendeur.boutique}</p>
          <p className="text-sm opacity-90 mt-1">{fmt(meilleurVendeur.montant)} F sur {meilleurVendeur.nombre} vente(s)</p>
        </div>
      )}
    </div>
  );
}