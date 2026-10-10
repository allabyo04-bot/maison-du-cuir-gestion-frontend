import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Package, Tag, ChevronRight, X, Search, PauseCircle, Star } from "lucide-react";
import { api } from "../api.js";
import { FAMILLES, BOUTIQUES, POINTURES, fmt } from "../constants.js";
import { Field, ConfirmModal, ErrorBanner, inputStyle, selectStyle } from "../components/Shared.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const FAMILLE_COLORS = { Chaussure: { bg: "#8C3B2E", fg: "#FBF3EC" }, Sac: { bg: "#A8823D", fg: "#2B2320" }, "Article d'entretien": { bg: "#5C7A5E", fg: "#FBF3EC" } };

function stockQty(article, boutique, pointure) {
  const item = article.stocks?.find((s) => s.boutique === boutique && s.pointure === (pointure || null));
  return item?.quantite || 0;
}
function totalStock(article) {
  return (article.stocks || []).reduce((s, i) => s + i.quantite, 0);
}
function totalStockBoutique(article, boutique) {
  return (article.stocks || []).filter((s) => s.boutique === boutique).reduce((s2, i) => s2 + i.quantite, 0);
}
function uidLocal() { return `tmp_${Date.now()}_${Math.floor(Math.random() * 10000)}`; }

export default function StockSection() {
  const { user } = useAuth();
  const estAdmin = !!user?.role?.systeme;
  const [tab, setTab] = useState("articles");
  const [articles, setArticles] = useState(null);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalArticle, setModalArticle] = useState(null);
  const [stockEditor, setStockEditor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmVeille, setConfirmVeille] = useState(false);
  const [veilleEnCours, setVeilleEnCours] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [filterFamille, setFilterFamille] = useState("Tous");
  const [filterBrand, setFilterBrand] = useState("Toutes");
  const [searchArticle, setSearchArticle] = useState("");
  const [mouvements, setMouvements] = useState([]);
  const [loadingMouvements, setLoadingMouvements] = useState(false);
  const [articleFiltreId, setArticleFiltreId] = useState("");
  const [articleFiltreSearch, setArticleFiltreSearch] = useState("");
  const [mvtDateDebut, setMvtDateDebut] = useState("");
  const [mvtDateFin, setMvtDateFin] = useState("");
  const [mvtType, setMvtType] = useState("");

  const loadMouvements = useCallback(async (articleId) => {
    setLoadingMouvements(true);
    try {
      const params = {
        ...(articleId ? { articleId } : {}),
        ...(mvtDateDebut ? { dateDebut: mvtDateDebut } : {}),
        ...(mvtDateFin ? { dateFin: mvtDateFin } : {}),
        ...(mvtType ? { type: mvtType } : {}),
      };
      const m = await api.articles.historiqueMouvements(params);
      setMouvements(m);
    } catch (e) { setError(e.message); } finally { setLoadingMouvements(false); }
  }, [mvtDateDebut, mvtDateFin, mvtType]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([api.articles.list(), api.brands.list()]);
      setArticles(a);
      setBrands(b);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
useEffect(() => { if (tab === "historique") loadMouvements(articleFiltreId); }, [tab, loadMouvements, articleFiltreId]);

  const [infoVeille, setInfoVeille] = useState("");
  const mettreToutEnVeille = async () => {
    setVeilleEnCours(true);
    try {
      const res = await api.articles.desactiverTous();
      setConfirmVeille(false);
      await load();
      setError("");
      setInfoVeille(`${res.desactives} article(s) mis en veille. Ils redeviendront visibles automatiquement dès qu'ils seront réimportés, ou en cliquant sur "Réactiver" sur leur fiche.`);
    } catch (e) { setError(e.message); } finally { setVeilleEnCours(false); }
  };

  const brandName = (id) => brands.find((b) => b.id === id)?.nom || "—";

  const addBrand = async () => {
    const nom = newBrand.trim();
    if (!nom) return;
    try { await api.brands.create(nom); setNewBrand(""); load(); } catch (e) { setError(e.message); }
  };
  const deleteBrand = async (id) => {
    try { await api.brands.remove(id); load(); } catch (e) { setError(e.message); }
  };

  const openNewArticle = () => setModalArticle({ isNew: true, designation: "", famille: "Chaussure", marqueId: brands?.[0]?.id || "", prixVente: "" });
  const openEditArticle = (a) => setModalArticle({ ...a, isNew: false });

  const submitArticle = async (form) => {
    if (!form.designation.trim() || !form.marqueId || !form.prixVente) { setError("Désignation, marque et prix de vente sont obligatoires."); return; }
    try {
      if (form.isNew) await api.articles.create(form);
      else await api.articles.update(form.id, { designation: form.designation, prixVente: form.prixVente, actif: form.actif });
      setModalArticle(null); setError(""); load();
    } catch (e) { setError(e.message); }
  };

  const removeArticle = async (a) => {
    try { await api.articles.remove(a.id); setConfirmDelete(null); load(); }
    catch (e) { setConfirmDelete(null); setError(e.message); }
  };

  const toggleActif = async (a) => {
    try { await api.articles.toggleActif(a.id, a.actif === false); load(); } catch (e) { setError(e.message); }
  };

  const updateStock = async (articleId, boutique, pointure, quantite) => {
    try { await api.articles.updateStock(articleId, boutique, pointure, quantite); load(); } catch (e) { setError(e.message); }
  };
const ajouterStock = async (articleId, boutique, pointure, quantite) => {
    try { await api.articles.ajouterStock(articleId, boutique, pointure, quantite); load(); } catch (e) { setError(e.message); }
  };

  const virementStock = async (articleId, boutiqueSource, boutiqueDestination, pointure, quantite) => {
    try { await api.articles.virementStock(articleId, boutiqueSource, boutiqueDestination, pointure, quantite); load(); } catch (e) { setError(e.message); }
  };
 const filteredArticles = useMemo(() => (articles || []).filter((a) => {
    if (filterFamille !== "Tous" && a.famille !== filterFamille) return false;
    if (filterBrand !== "Toutes" && a.marqueId !== filterBrand) return false;
    if (searchArticle.trim()) {
      const q = searchArticle.trim().toLowerCase();
      if (!a.designation.toLowerCase().includes(q) && !a.reference.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [articles, filterFamille, filterBrand, searchArticle]);

  const editingArticle = stockEditor ? articles.find((a) => a.id === stockEditor) : null;

  return (
    <div>
      <ErrorBanner error={error} onClose={() => setError("")} />
      <div className="flex gap-6 items-start">
        <div className="flex flex-col gap-2 shrink-0" style={{ width: "200px" }}>
          {[["articles", "Articles"], ["marques", "Marques (sous-familles)"], ["virements", "Virements"], ["historique", "Historique des mouvements"], ["etat-stock", "État du stock"], ["import", "Import"], ["inventaire", "Inventaire (Excel)"], ["soldes", "Soldes"], ["reception", "Réception"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className="px-4 py-2 rounded-lg text-sm font-medium text-left" style={tab === id ? { background: "#2B2320", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52", border: "1px solid #DDD3C4" }}>{label}</button>
          ))}
        </div>

        <div className="flex-1 min-w-0">

      {loading && <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement…</p>}

      {!loading && tab === "articles" && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex gap-2 flex-wrap items-center">
              <div className="relative">
                <input value={searchArticle} onChange={(e) => setSearchArticle(e.target.value)} placeholder="Rechercher un article ou une référence…" style={{ ...selectStyle, paddingLeft: "32px", minWidth: "240px" }} />
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#6B5D52" />
              </div>
              <select value={filterFamille} onChange={(e) => setFilterFamille(e.target.value)} style={selectStyle}>
                <option>Tous</option>{FAMILLES.map((f) => <option key={f}>{f}</option>)}
              </select>
              <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} style={selectStyle}>
                <option value="Toutes">Toutes les marques</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              {estAdmin && (
                <button onClick={() => setConfirmVeille(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid #B04A3B", color: "#B04A3B" }}>
                  <PauseCircle size={16} /> Tout mettre en veille
                </button>
              )}
              <button onClick={openNewArticle} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>
                <Plus size={16} /> Nouvel article
              </button>
            </div>
          </div>
          {infoVeille && (
            <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: "#E9F0EA", color: "#3F6B4A" }}>{infoVeille}</p>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {filteredArticles.map((a) => {
              const fc = FAMILLE_COLORS[a.famille];
              const total = totalStock(a);
              return (
                <div key={a.id} className="stitch card-hover rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2", opacity: a.actif === false ? 0.6 : 1 }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {a.photoUrl ? (
                        <img src={a.photoUrl} alt={a.designation} className="w-11 h-11 rounded-full object-cover shrink-0" style={{ border: "1px solid #EAE1D2" }} />
                      ) : (
                        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "#F1E9DC" }}><Package size={18} color="#8C3B2E" /></div>
                      )}
                      <div>
                        <p className="font-medium leading-tight">{a.designation}</p>
                        <p className="text-xs font-mono mt-0.5" style={{ color: "#6B5D52" }}>{a.reference}</p>
                      </div>
                    </div>
                    <p className="font-display font-semibold text-sm" style={{ color: "#8C3B2E" }}>{fmt(a.prixVente)} F</p>
                  </div>
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: fc.bg, color: fc.fg }}>{a.famille}</span>
                    <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: "#F1E9DC", color: "#6B5D52" }}><Tag size={11} /> {brandName(a.marqueId)}</span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-mono" style={{ background: total > 0 ? "#E9F0EA" : "#FBEAE7", color: total > 0 ? "#3F6B4A" : "#B04A3B" }}>{total} en stock</span>
                    {a.actif === false && (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1" style={{ background: "#DDD3C4", color: "#6B5D52" }}><PauseCircle size={11} /> En veille</span>
                    )}
                  </div>
                  <p className="text-xs mt-1.5 font-mono" style={{ color: "#A89A87" }}>
                    {BOUTIQUES.map((b) => `${b} ${totalStockBoutique(a, b)}`).join("  ·  ")}
                  </p>
                  <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: "1px solid #EFE7D9" }}>
                    <button onClick={() => setStockEditor(a.id)} className="text-xs font-medium flex items-center gap-1" style={{ color: "#8C3B2E" }}>Gérer le stock <ChevronRight size={13} /></button>
                    <div className="flex gap-3">
                      <button onClick={() => toggleActif(a)} title={a.actif === false ? "Réactiver" : "Désactiver"} style={{ color: "#6B5D52" }}><PauseCircle size={16} /></button>
                      <button onClick={() => openEditArticle(a)} style={{ color: "#8C3B2E" }}><Pencil size={16} /></button>
                      <button onClick={() => setConfirmDelete(a)} style={{ color: "#B04A3B" }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && tab === "marques" && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Nom de la marque" className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #DDD3C4", background: "#FFFFFF" }} onKeyDown={(e) => e.key === "Enter" && addBrand()} />
            <button onClick={addBrand} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}><Plus size={16} /> Ajouter</button>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {brands.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
                <p className="font-medium text-sm">{b.nom}</p>
                <button onClick={() => deleteBrand(b.id)} style={{ color: "#B04A3B" }}><Trash2 size={15} /></button>

              </div>
            ))}
          </div>
        </div>
      )}
{!loading && tab === "historique" && (
        <div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <p className="text-sm" style={{ color: "#6B5D52" }}>Filtrer par article :</p>
            {articleFiltreId ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "#F1E9DC" }}>
                <span className="text-sm">{(articles || []).find((a) => a.id === articleFiltreId)?.designation}</span>
                <button onClick={() => { setArticleFiltreId(""); setArticleFiltreSearch(""); }} style={{ color: "#B04A3B" }}><X size={14} /></button>
              </div>
            ) : (
              <div className="relative" style={{ minWidth: "280px" }}>
                <input value={articleFiltreSearch} onChange={(e) => setArticleFiltreSearch(e.target.value)} placeholder="Tous les articles — taper pour filtrer…" style={{ ...selectStyle, paddingLeft: "30px", width: "100%" }} />
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#6B5D52" />
                {articleFiltreSearch.trim() && (
                  <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden max-h-56 overflow-y-auto" style={{ background: "#FFFFFF", border: "1px solid #DDD3C4" }}>
                    {(articles || []).filter((a) => a.designation.toLowerCase().includes(articleFiltreSearch.toLowerCase()) || a.reference.toLowerCase().includes(articleFiltreSearch.toLowerCase())).slice(0, 20).map((a) => (
                      <button key={a.id} onClick={() => { setArticleFiltreId(a.id); setArticleFiltreSearch(""); }} className="w-full text-left px-3 py-2 text-sm" style={{ background: "#FFFFFF" }}>
                        {a.designation} · {a.reference}
                      </button>
                    ))}
                    {(articles || []).filter((a) => a.designation.toLowerCase().includes(articleFiltreSearch.toLowerCase()) || a.reference.toLowerCase().includes(articleFiltreSearch.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm" style={{ color: "#6B5D52" }}>Aucun article trouvé.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-end gap-3 mb-5 flex-wrap">
            <div>
              <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Du</label>
              <input type="date" value={mvtDateDebut} onChange={(e) => setMvtDateDebut(e.target.value)} style={selectStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Au</label>
              <input type="date" value={mvtDateFin} onChange={(e) => setMvtDateFin(e.target.value)} style={selectStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Type</label>
              <select value={mvtType} onChange={(e) => setMvtType(e.target.value)} style={selectStyle}>
                <option value="">Tous les types</option>
                <option value="Ajout">Ajout (mise en stock / import)</option>
                <option value="Correction">Correction (inventaire)</option>
                <option value="Virement">Virement entre boutiques</option>
                <option value="Vente">Vente</option>
                <option value="Retour">Retour</option>
                <option value="Echange">Échange</option>
                <option value="SortieLivraison">Sortie livraison</option>
                <option value="RetourLivraison">Retour livraison</option>
              </select>
            </div>
            <button onClick={() => loadMouvements(articleFiltreId)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Filtrer</button>
            {(mvtDateDebut || mvtDateFin || mvtType) && (
              <button onClick={() => { setMvtDateDebut(""); setMvtDateFin(""); setMvtType(""); }} className="text-xs" style={{ color: "#6B5D52" }}>Réinitialiser les filtres</button>
            )}
          </div>

          {articleFiltreId && (() => {
            const art = (articles || []).find((a) => a.id === articleFiltreId);
            if (!art) return null;
            return (
              <div className="rounded-xl p-4 mb-5" style={{ background: "#F1E9DC" }}>
                <p className="text-xs font-mono uppercase tracking-wide mb-2" style={{ color: "#8C3B2E" }}>Stock actuel — {art.designation}</p>
                <div className="flex gap-6 flex-wrap">
                  {BOUTIQUES.map((b) => (
                    <div key={b}>
                      <p className="text-xs" style={{ color: "#6B5D52" }}>{b}</p>
                      <p className="font-display text-lg font-semibold">
                        {(art.stocks || []).filter((s) => s.boutique === b).reduce((s, i) => s + i.quantite, 0)}
                      </p>
                    </div>
                  ))}
                  <div>
                    <p className="text-xs" style={{ color: "#6B5D52" }}>Total</p>
                    <p className="font-display text-lg font-semibold" style={{ color: "#8C3B2E" }}>{totalStock(art)}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {loadingMouvements && <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement…</p>}
          {!loadingMouvements && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#F1E9DC", color: "#6B5D52" }}>
                    <th className="text-left px-4 py-2">Date</th>
                    <th className="text-left px-4 py-2">Article</th>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-left px-4 py-2">Boutique</th>
                    <th className="text-left px-4 py-2">Pointure</th>
                    <th className="text-right px-4 py-2">Quantité</th>
                    <th className="text-right px-4 py-2">Avant → Après</th>
                    <th className="text-left px-4 py-2">Par</th>
                  </tr>
                </thead>
                <tbody>
                  {mouvements.map((m) => (
                    <tr key={m.id} style={{ borderTop: "1px solid #EFE7D9" }}>
                      <td className="px-4 py-2">{new Date(m.date).toLocaleString("fr-FR")}</td>
                      <td className="px-4 py-2">{m.article?.designation}</td>
                      <td className="px-4 py-2">{m.type}</td>
                      <td className="px-4 py-2">{m.type === "Virement" ? `${m.boutiqueSource} → ${m.boutique}` : m.boutique}</td>
                      <td className="px-4 py-2">{m.pointure ? `T${m.pointure}` : "—"}</td>
                      <td className="text-right px-4 py-2">{m.quantite}</td>
                      <td className="text-right px-4 py-2">{m.quantiteAvant} → {m.quantiteApres}</td>
                      <td className="px-4 py-2">{m.effectuePar?.prenom} {m.effectuePar?.nom}</td>
                    </tr>
                  ))}
                  {mouvements.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-6 text-center" style={{ color: "#6B5D52" }}>Aucun mouvement enregistré pour l'instant.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === "virements" && <VirementsSection articles={articles || []} onDone={load} />}
      {!loading && tab === "etat-stock" && <EtatStockSection articles={articles || []} estAdmin={estAdmin} />}
      {tab === "import" && <ImportSection brands={brands} onImported={load} />}
      {tab === "inventaire" && <InventaireSection brands={brands} onApplique={load} />}
      {tab === "soldes" && <SoldesSection brands={brands} />}
      {tab === "reception" && <ReceptionSection articles={articles} onApplique={load} />}
        </div>
      </div>
      {modalArticle && <ArticleModal article={modalArticle} brands={brands} onCancel={() => setModalArticle(null)} onSubmit={submitArticle} onPhotoChange={load} />}
      {editingArticle && (
        <StockEditorModal
          article={editingArticle}
          onClose={() => setStockEditor(null)}
          onCorriger={(b, p, q) => updateStock(editingArticle.id, b, p, q)}
          onAjouter={(b, p, q) => ajouterStock(editingArticle.id, b, p, q)}
          onVirement={(bs, bd, p, q) => virementStock(editingArticle.id, bs, bd, p, q)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal title="Supprimer cet article ?" message={`${confirmDelete.designation} sera retiré du stock.`} onCancel={() => setConfirmDelete(null)} onConfirm={() => removeArticle(confirmDelete)} />
      )}
      {confirmVeille && (
        <ConfirmModal
          title="Mettre tout le catalogue en veille ?"
          message={`Tous les articles actifs (les deux boutiques confondues) deviendront invisibles à la vente. L'historique des ventes déjà réalisées n'est pas touché. Ils redeviendront visibles automatiquement dès que Djenie les réimportera via Excel. ${veilleEnCours ? "Mise en veille en cours..." : ""}`}
          onCancel={() => setConfirmVeille(false)}
          onConfirm={mettreToutEnVeille}
        />
      )}
    </div>
  );
}

// Galerie de photos d'un article : ajout (plusieurs), définir la principale (vignette dans les
// listes), suppression. La toute première photo ajoutée devient automatiquement la principale.
function GaleriePhotos({ article, onArticleMisAJour }) {
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [actionEnCours, setActionEnCours] = useState(null); // id de la photo en cours de suppression/promotion
  const [erreur, setErreur] = useState("");
  const photos = article.photos || [];

  const ajouterPhoto = async (e) => {
    const fichier = e.target.files[0];
    if (!fichier) return;
    e.target.value = "";
    setEnvoiEnCours(true); setErreur("");
    try { onArticleMisAJour(await api.articles.uploaderPhoto(article.id, fichier)); }
    catch (err) { setErreur(err.message); }
    finally { setEnvoiEnCours(false); }
  };
  const supprimerPhoto = async (photoId) => {
    setActionEnCours(photoId); setErreur("");
    try { onArticleMisAJour(await api.articles.supprimerPhoto(article.id, photoId)); }
    catch (err) { setErreur(err.message); }
    finally { setActionEnCours(null); }
  };
  const definirPrincipale = async (photoId) => {
    setActionEnCours(photoId); setErreur("");
    try { onArticleMisAJour(await api.articles.definirPhotoPrincipale(article.id, photoId)); }
    catch (err) { setErreur(err.message); }
    finally { setActionEnCours(null); }
  };

  return (
    <div className="mt-4 pt-4" style={{ borderTop: "1px solid #EFE7D9" }}>
      <p className="text-xs font-medium mb-2" style={{ color: "#6B5D52" }}>Photos</p>
      {erreur && <p className="text-xs mb-2" style={{ color: "#B04A3B" }}>{erreur}</p>}
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative" style={{ width: "64px", height: "64px" }}>
            <img
              src={photo.url} alt="" onClick={() => !photo.estPrincipale && definirPrincipale(photo.id)}
              className="w-full h-full object-cover rounded-lg"
              style={{ outline: photo.estPrincipale ? "2px solid #8C3B2E" : "1px solid #EAE1D2", cursor: photo.estPrincipale ? "default" : "pointer", opacity: actionEnCours === photo.id ? 0.5 : 1 }}
              title={photo.estPrincipale ? "Photo principale" : "Cliquer pour définir comme principale"}
            />
            {photo.estPrincipale && <Star size={14} fill="#8C3B2E" color="#8C3B2E" className="absolute -top-1.5 -left-1.5" />}
            <button type="button" onClick={() => supprimerPhoto(photo.id)} disabled={actionEnCours === photo.id}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs"
              style={{ background: "#B04A3B", color: "#FFFFFF" }} title="Supprimer cette photo">×</button>
          </div>
        ))}
        <label className="flex items-center justify-center rounded-lg text-xs cursor-pointer" style={{ width: "64px", height: "64px", border: "1px dashed #DDD3C4", color: "#6B5D52" }}>
          {envoiEnCours ? "…" : "+ Ajouter"}
          <input type="file" accept="image/*" onChange={ajouterPhoto} style={{ display: "none" }} disabled={envoiEnCours} />
        </label>
      </div>
      {photos.length > 1 && <p className="text-xs mt-2" style={{ color: "#A89A87" }}>Clique sur une photo pour la définir comme principale (vignette dans les listes).</p>}
    </div>
  );
}

function ArticleModal({ article, brands, onCancel, onSubmit, onPhotoChange }) {
  const [form, setForm] = useState(article);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
      <div className="rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: "#FFFDF9" }}>
        <div className="flex items-center justify-between mb-5">
          <p className="font-display text-lg font-semibold">{form.isNew ? "Nouvel article" : "Modifier l'article"}</p>
          <button onClick={onCancel}><X size={18} color="#6B5D52" /></button>
        </div>
        {!form.isNew && <Field label="Référence"><div style={{ ...inputStyle, background: "#F1E9DC", color: "#6B5D52" }}>{form.reference}</div></Field>}
      <Field label="Famille">
          <select value={form.famille} onChange={(e) => set("famille", e.target.value)} style={inputStyle} disabled={!form.isNew}>
            {FAMILLES.map((f) => <option key={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Désignation"><input value={form.designation} onChange={(e) => set("designation", e.target.value)} style={inputStyle} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Marque">
            <select value={form.marqueId} onChange={(e) => set("marqueId", e.target.value)} style={inputStyle} disabled={!form.isNew}>
              <option value="">— Choisir —</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </select>
          </Field>
          <Field label="Prix de vente (F CFA)"><input value={form.prixVente} onChange={(e) => set("prixVente", e.target.value.replace(/\D/g, ""))} style={inputStyle} inputMode="numeric" /></Field>
        </div>
        {!form.isNew && (
          <p className="text-xs mt-3" style={{ color: "#6B5D52" }}>La famille et la marque ne sont pas modifiables après création (ça changerait la structure du stock déjà en place).</p>
     )}
        {!form.isNew && (
          <GaleriePhotos
            article={form}
            onArticleMisAJour={(a) => { setForm((f) => ({ ...f, photoUrl: a.photoUrl, photos: a.photos })); onPhotoChange?.(); }}
          />
        )}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm" style={{ color: "#6B5D52" }}>Annuler</button>
          <button onClick={() => onSubmit(form)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
function StockEditorModal({ article, onClose, onCorriger, onAjouter, onVirement }) {
  const [mode, setMode] = useState("corriger");
  const [boutique, setBoutique] = useState(BOUTIQUES[0]);
  const [boutiqueDestination, setBoutiqueDestination] = useState(BOUTIQUES[1] || BOUTIQUES[0]);
  const isChaussure = article.famille === "Chaussure";
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const [values, setValues] = useState(() => {
    const init = {};
    if (isChaussure) POINTURES.forEach((p) => { init[`${boutique}__${p}`] = mode === "corriger" ? stockQty(article, boutique, p) : 0; });
    else init[`${boutique}__`] = mode === "corriger" ? stockQty(article, boutique, null) : 0;
    return init;
  });

  const key = (b, p) => `${b}__${p || ""}`;
  const getValue = (b, p) => (key(b, p) in values ? values[key(b, p)] : 0);
  const setValue = (b, p, v) => setValues((prev) => ({ ...prev, [key(b, p)]: v }));

  const changerMode = (m) => {
    setMode(m);
    setError("");
    const init = {};
    if (isChaussure) POINTURES.forEach((p) => { init[key(boutique, p)] = m === "corriger" ? stockQty(article, boutique, p) : 0; });
    else init[key(boutique, null)] = m === "corriger" ? stockQty(article, boutique, null) : 0;
    setValues(init);
  };

  const changerBoutique = (b) => {
    setBoutique(b);
    if (b === boutiqueDestination) {
      const autre = BOUTIQUES.find((x) => x !== b);
      if (autre) setBoutiqueDestination(autre);
    }
    const init = {};
    if (isChaussure) POINTURES.forEach((p) => { init[key(b, p)] = mode === "corriger" ? stockQty(article, b, p) : 0; });
    else init[key(b, null)] = mode === "corriger" ? stockQty(article, b, null) : 0;
    setValues(init);
  };

  const soumettreCorriger = async () => {
    if (envoi) return;
    setEnvoi(true);
    setError("");
    try {
      if (isChaussure) {
        for (const p of POINTURES) await onCorriger(boutique, p, getValue(boutique, p));
      } else {
        await onCorriger(boutique, null, getValue(boutique, null));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(e.message); } finally { setEnvoi(false); }
  };

  const soumettreAjouter = async () => {
    if (envoi) return;
    setEnvoi(true);
    setError("");
    try {
      if (isChaussure) {
        for (const p of POINTURES) {
          const q = Number(getValue(boutique, p)) || 0;
          if (q > 0) await onAjouter(boutique, p, q);
        }
      } else {
        const q = Number(getValue(boutique, null)) || 0;
        if (q > 0) await onAjouter(boutique, null, q);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      changerMode("ajouter");
    } catch (e) { setError(e.message); } finally { setEnvoi(false); }
  };

  const soumettreVirement = async () => {
    if (envoi) return;
    setEnvoi(true);
    setError("");
    try {
      if (isChaussure) {
        for (const p of POINTURES) {
          const q = Number(getValue(boutique, p)) || 0;
          if (q > 0) await onVirement(boutique, boutiqueDestination, p, q);
        }
      } else {
        const q = Number(getValue(boutique, null)) || 0;
        if (q > 0) await onVirement(boutique, boutiqueDestination, null, q);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      changerMode("virement");
    } catch (e) { setError(e.message); } finally { setEnvoi(false); }
  };

  const total = isChaussure
    ? POINTURES.reduce((s, p) => s + (Number(getValue(boutique, p)) || 0), 0)
    : Number(getValue(boutique, null)) || 0;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
      <div className="rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ background: "#FFFDF9" }}>
        <div className="flex items-center justify-between mb-1">
          <p className="font-display text-lg font-semibold">{article.designation}</p>
          <button onClick={onClose}><X size={18} color="#6B5D52" /></button>
        </div>
        <p className="text-xs font-mono mb-5" style={{ color: "#6B5D52" }}>{article.reference}</p>

        <div className="flex gap-2 mb-5">
          {[["corriger", "Corriger (inventaire)"], ["ajouter", "Ajouter du stock"], ["virement", "Virement"]].map(([id, label]) => (
            <button key={id} onClick={() => changerMode(id)} className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={mode === id ? { background: "#8C3B2E", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52", border: "1px solid #DDD3C4" }}>
              {label}
            </button>
          ))}
        </div>

        {mode === "virement" ? (
          <div className="flex items-center gap-2 mb-5">
            <select value={boutique} onChange={(e) => changerBoutique(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid #DDD3C4" }}>
              {BOUTIQUES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <span className="text-sm" style={{ color: "#6B5D52" }}>vers</span>
            <select value={boutiqueDestination} onChange={(e) => setBoutiqueDestination(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid #DDD3C4" }}>
              {BOUTIQUES.filter((b) => b !== boutique).map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        ) : (
          <div className="flex gap-2 mb-5">
            {BOUTIQUES.map((b) => (
              <button key={b} onClick={() => changerBoutique(b)} className="px-3 py-1.5 rounded-full text-xs font-medium" style={boutique === b ? { background: "#2B2320", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52", border: "1px solid #DDD3C4" }}>{b}</button>
            ))}
          </div>
        )}

        {error && <p className="text-sm mb-4" style={{ color: "#B04A3B" }}>{error}</p>}

        {isChaussure ? (
          <div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {POINTURES.map((p) => {
                const dispoSource = stockQty(article, boutique, p);
                return (
                  <div key={p} className="text-center">
                    <p className="text-xs font-mono mb-1" style={{ color: "#8C3B2E" }}>T{p}</p>
                    {mode === "virement" && (
                      <p className="text-xs mb-1" style={{ color: dispoSource > 0 ? "#3F6B4A" : "#B04A3B" }}>
                        {dispoSource} dispo.
                      </p>
                    )}
                    <input
                      className="qty-input"
                      type="number"
                      min="0"
                      max={mode === "virement" ? dispoSource : undefined}
                      value={getValue(boutique, p)}
                      onChange={(e) => {
                        const v = mode === "virement" ? Math.min(Number(e.target.value) || 0, dispoSource) : e.target.value;
                        setValue(boutique, p, v);
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: "1px solid #EFE7D9" }}>
              <p className="text-xs font-mono uppercase tracking-wide" style={{ color: "#8C3B2E" }}>
                {mode === "corriger" ? `Total pour ${boutique}` : mode === "ajouter" ? "Total à ajouter" : "Total à transférer"}
              </p>
              <p className="font-display text-xl font-semibold">{total}</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-mono mb-1" style={{ color: "#8C3B2E" }}>Quantité</p>
            <input className="qty-input" style={{ width: "80px" }} type="number" min="0" value={getValue(boutique, null)} onChange={(e) => setValue(boutique, null, e.target.value)} />
          </div>
        )}

        <button
          onClick={mode === "corriger" ? soumettreCorriger : mode === "ajouter" ? soumettreAjouter : soumettreVirement}
          disabled={envoi}
          className="w-full mt-5 px-4 py-2.5 rounded-lg text-sm font-medium"
          style={{ background: saved ? "#3F6B4A" : envoi ? "#B8A88F" : "#8C3B2E", color: "#FBF3EC", opacity: envoi ? 0.7 : 1 }}>
          {saved ? "Enregistré ✓" : mode === "corriger" ? `Enregistrer le stock pour ${boutique}` : mode === "ajouter" ? `Ajouter au stock de ${boutique}` : `Transférer vers ${boutiqueDestination}`}
        </button>
      </div>
    </div>
  );
}

// Une ligne de stock est "basse" si elle passe SOUS le seuil fixe, OU sous le pourcentage de son
// stock initial (quand celui-ci est connu — voir StockItem.quantiteInitiale). Un article qui n'a
// jamais été réapprovisionné depuis l'ajout de ce suivi n'a que le seuil fixe qui s'applique.
function ligneEnStockBas(stockItem, parametres) {
  if (!parametres) return false;
  if (stockItem.quantite <= parametres.seuilFixe) return true;
  if (stockItem.quantiteInitiale != null && stockItem.quantiteInitiale > 0) {
    return stockItem.quantite <= (stockItem.quantiteInitiale * parametres.seuilPourcentage) / 100;
  }
  return false;
}
function articleEnStockBas(article, parametres) {
  return (article.stocks || []).some((s) => ligneEnStockBas(s, parametres));
}

function ReglagesStockBas({ parametres, onMaj }) {
  const [seuilFixe, setSeuilFixe] = useState(parametres.seuilFixe);
  const [seuilPourcentage, setSeuilPourcentage] = useState(parametres.seuilPourcentage);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const modifie = seuilFixe !== parametres.seuilFixe || seuilPourcentage !== parametres.seuilPourcentage;

  const enregistrer = async () => {
    setEnvoi(true); setErreur("");
    try {
      const maj = await api.articles.majParametresStock(seuilFixe, seuilPourcentage);
      onMaj(maj);
    } catch (e) { setErreur(e.message); } finally { setEnvoi(false); }
  };

  return (
    <div className="rounded-2xl p-4 mb-5 flex flex-wrap items-end gap-4" style={{ background: "#FFFDF9", border: "1px solid #EAE1D2" }}>
      <div>
        <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Alerte si quantité ≤</label>
        <input type="number" min="0" value={seuilFixe} onChange={(e) => setSeuilFixe(parseInt(e.target.value, 10) || 0)}
          className="w-24" style={inputStyle} />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Ou si quantité ≤ ce % du stock initial</label>
        <input type="number" min="0" max="100" value={seuilPourcentage} onChange={(e) => setSeuilPourcentage(parseInt(e.target.value, 10) || 0)}
          className="w-24" style={inputStyle} />
      </div>
      {modifie && (
        <button onClick={enregistrer} disabled={envoi} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>
          {envoi ? "Enregistrement..." : "Enregistrer"}
        </button>
      )}
      {erreur && <p className="text-xs w-full" style={{ color: "#B04A3B" }}>{erreur}</p>}
    </div>
  );
}

function EtatStockSection({ articles, estAdmin }) {
  const [filtreFamille, setFiltreFamille] = useState("Tous");
  const [filtreQuantite, setFiltreQuantite] = useState("tous");
  const [filtreActif, setFiltreActif] = useState("tous");
  const [parametresStock, setParametresStock] = useState(null);

  useEffect(() => { api.articles.parametresStock().then(setParametresStock).catch(() => {}); }, []);

  const filtered = articles.filter((a) => {
    if (filtreFamille !== "Tous" && a.famille !== filtreFamille) return false;
    if (filtreQuantite === "nulle" && totalStock(a) !== 0) return false;
    if (filtreQuantite === "stock" && totalStock(a) === 0) return false;
    if (filtreQuantite === "bas" && !articleEnStockBas(a, parametresStock)) return false;
    if (filtreActif === "actifs" && a.actif === false) return false;
    if (filtreActif === "veille" && a.actif !== false) return false;
    return true;
  });

  // Même logique que "filtered" ci-dessus, mais sans le filtre famille — chaque encart applique
  // ensuite sa propre famille par-dessus, pour que "Actifs uniquement" / "En veille uniquement"
  // se reflète aussi dans les encarts, pas seulement dans le tableau détaillé en dessous.
  const articlesPourEncarts = articles.filter((a) => {
    if (filtreQuantite === "nulle" && totalStock(a) !== 0) return false;
    if (filtreQuantite === "stock" && totalStock(a) === 0) return false;
    if (filtreQuantite === "bas" && !articleEnStockBas(a, parametresStock)) return false;
    if (filtreActif === "actifs" && a.actif === false) return false;
    if (filtreActif === "veille" && a.actif !== false) return false;
    return true;
  });

  const totalPourBoutiqueEtFamille = (b, f) =>
    articlesPourEncarts.filter((a) => a.famille === f).reduce((s, a) => s + (a.stocks || []).filter((si) => si.boutique === b).reduce((s2, i) => s2 + i.quantite, 0), 0);

  const totalFamille = (f) => articlesPourEncarts.filter((a) => a.famille === f).reduce((s, a) => s + totalStock(a), 0);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {["Tous", ...FAMILLES].map((f) => (
          <button key={f} onClick={() => setFiltreFamille(f)} className="px-4 py-2 rounded-full text-sm font-medium"
            style={filtreFamille === f ? { background: "#2B2320", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52", border: "1px solid #DDD3C4" }}>
            {f}
          </button>
        ))}
      </div>
      {estAdmin && parametresStock && <ReglagesStockBas parametres={parametresStock} onMaj={setParametresStock} />}
      <div className="flex gap-2 mb-3">
        {[["tous", "Tout"], ["stock", "En stock"], ["nulle", "Quantité nulle"], ["bas", "Stock bas"]].map(([id, label]) => (
          <button key={id} onClick={() => setFiltreQuantite(id)} className="px-4 py-2 rounded-full text-sm font-medium"
            style={filtreQuantite === id ? { background: "#8C3B2E", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52", border: "1px solid #DDD3C4" }}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-5">
        {[["tous", "Actifs + en veille"], ["actifs", "Actifs uniquement"], ["veille", "En veille uniquement"]].map(([id, label]) => (
          <button key={id} onClick={() => setFiltreActif(id)} className="px-4 py-2 rounded-full text-sm font-medium"
            style={filtreActif === id ? { background: "#6B5D52", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52", border: "1px solid #DDD3C4" }}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {FAMILLES.map((f) => (
          <div key={f} className="rounded-2xl p-4" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
            <p className="text-xs font-mono uppercase tracking-wide mb-2" style={{ color: "#8C3B2E" }}>
              {f}s en stock{filtreActif === "actifs" ? " (actifs)" : filtreActif === "veille" ? " (en veille)" : ""}
            </p>
            <div className="flex gap-6 items-end">
              {BOUTIQUES.map((b) => (
                <div key={b}>
                  <p className="text-xs" style={{ color: "#6B5D52" }}>{b}</p>
                  <p className="font-display text-lg font-semibold">{totalPourBoutiqueEtFamille(b, f)}</p>
                </div>
              ))}
              <div>
                <p className="text-xs" style={{ color: "#6B5D52" }}>Total</p>
                <p className="font-display text-xl font-semibold" style={{ color: "#8C3B2E" }}>{totalFamille(f)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#F1E9DC", color: "#6B5D52" }}>
              <th className="text-left px-4 py-2">Article</th>
              <th className="text-left px-4 py-2">Famille</th>
              {BOUTIQUES.map((b) => <th key={b} className="text-right px-4 py-2">{b}</th>)}
              <th className="text-right px-4 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const bas = articleEnStockBas(a, parametresStock);
              return (
              <tr key={a.id} style={{ borderTop: "1px solid #EFE7D9" }}>
                <td className="px-4 py-2">
                  {a.designation} <span className="font-mono text-xs" style={{ color: "#6B5D52" }}>· {a.reference}</span>
                  {a.actif === false && <span className="text-xs ml-2 px-2 py-0.5 rounded-full" style={{ background: "#DDD3C4", color: "#6B5D52" }}>En veille</span>}
                  {bas && <span className="text-xs ml-2 px-2 py-0.5 rounded-full" style={{ background: "#FBEAE7", color: "#B04A3B" }}>⚠ Stock bas</span>}
                </td>
                <td className="px-4 py-2">{a.famille}</td>
                {BOUTIQUES.map((b) => {
                  const stockLigne = (a.stocks || []).filter((s) => s.boutique === b);
                  const total = stockLigne.reduce((s, i) => s + i.quantite, 0);
                  const basIci = stockLigne.some((s) => ligneEnStockBas(s, parametresStock));
                  return <td key={b} className="text-right px-4 py-2" style={basIci ? { color: "#B04A3B", fontWeight: 600 } : undefined}>{total}</td>;
                })}
                <td className="text-right px-4 py-2 font-semibold">{totalStock(a)}</td>
              </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={2 + BOUTIQUES.length + 1} className="px-4 py-6 text-center" style={{ color: "#6B5D52" }}>Aucun article.</td></tr>
            )}
          </tbody>
        </table>
      </div>
   </div>
  );
}

function VirementsSection({ articles, onDone }) {
  const [articleId, setArticleId] = useState("");
  const [search, setSearch] = useState("");
  const [boutiqueSource, setBoutiqueSource] = useState(BOUTIQUES[0]);
  const [boutiqueDestination, setBoutiqueDestination] = useState(BOUTIQUES[1] || BOUTIQUES[0]);
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [saved, setSaved] = useState(false);

  const article = articles.find((a) => a.id === articleId);
  const isChaussure = article?.famille === "Chaussure";

  const choisirArticle = (a) => {
    setArticleId(a.id);
    setSearch("");
    setValues({});
    setError("");
  };

  const changerSource = (b) => {
    setBoutiqueSource(b);
    if (b === boutiqueDestination) {
      const autre = BOUTIQUES.find((x) => x !== b);
      if (autre) setBoutiqueDestination(autre);
    }
    setValues({});
  };

  const getValue = (p) => values[p || ""] || 0;
  const setValue = (p, v, dispo) => setValues((prev) => ({ ...prev, [p || ""]: Math.min(Number(v) || 0, dispo) }));

  const total = isChaussure
    ? POINTURES.reduce((s, p) => s + getValue(p), 0)
    : getValue(null);

  const soumettre = async () => {
    if (!article) return;
    if (total <= 0) { setError("Indique au moins une quantité à transférer."); return; }
    setEnvoi(true);
    setError("");
    try {
      if (isChaussure) {
        for (const p of POINTURES) {
          const q = getValue(p);
          if (q > 0) await api.articles.virementStock(article.id, boutiqueSource, boutiqueDestination, p, q);
        }
      } else {
        const q = getValue(null);
        if (q > 0) await api.articles.virementStock(article.id, boutiqueSource, boutiqueDestination, null, q);
      }
      setSaved(true);
      setValues({});
      onDone();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(e.message); } finally { setEnvoi(false); }
  };

  const resultats = search.trim()
    ? articles.filter((a) => a.designation.toLowerCase().includes(search.toLowerCase()) || a.reference.toLowerCase().includes(search.toLowerCase())).slice(0, 20)
    : [];

  return (
    <div className="max-w-2xl">
      <div className="rounded-2xl p-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
        <p className="font-display text-lg font-semibold mb-4">Transférer du stock entre boutiques</p>

        <div className="mb-4">
          <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Article</label>
          {article ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "#F1E9DC" }}>
              <span className="text-sm">{article.designation} · {article.reference}</span>
              <button onClick={() => { setArticleId(""); setValues({}); }} style={{ color: "#B04A3B" }}><X size={14} /></button>
            </div>
          ) : (
            <div className="relative">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un article…" style={{ ...selectStyle, paddingLeft: "32px", width: "100%" }} />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#6B5D52" />
              {search.trim() && (
                <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden max-h-56 overflow-y-auto" style={{ background: "#FFFFFF", border: "1px solid #DDD3C4" }}>
                  {resultats.map((a) => (
                    <button key={a.id} onClick={() => choisirArticle(a)} className="w-full text-left px-3 py-2 text-sm" style={{ background: "#FFFFFF" }}>
                      {a.designation} · {a.reference} <span style={{ color: "#6B5D52" }}>({totalStock(a)} en stock)</span>
                    </button>
                  ))}
                  {resultats.length === 0 && <div className="px-3 py-2 text-sm" style={{ color: "#6B5D52" }}>Aucun article trouvé.</div>}
                </div>
              )}
            </div>
          )}
        </div>

        {article && (
          <>
            <div className="flex items-center gap-2 mb-5">
              <select value={boutiqueSource} onChange={(e) => changerSource(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid #DDD3C4" }}>
                {BOUTIQUES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <span className="text-sm" style={{ color: "#6B5D52" }}>vers</span>
              <select value={boutiqueDestination} onChange={(e) => setBoutiqueDestination(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid #DDD3C4" }}>
                {BOUTIQUES.filter((b) => b !== boutiqueSource).map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {error && <p className="text-sm mb-4" style={{ color: "#B04A3B" }}>{error}</p>}

            {isChaussure ? (
              <div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {POINTURES.map((p) => {
                    const dispo = stockQty(article, boutiqueSource, p);
                    return (
                      <div key={p} className="text-center">
                        <p className="text-xs font-mono mb-1" style={{ color: "#8C3B2E" }}>T{p}</p>
                        <p className="text-xs mb-1" style={{ color: dispo > 0 ? "#3F6B4A" : "#B04A3B" }}>{dispo} dispo.</p>
                        <input className="qty-input" type="number" min="0" max={dispo} value={getValue(p)} onChange={(e) => setValue(p, e.target.value, dispo)} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: "1px solid #EFE7D9" }}>
                  <p className="text-xs font-mono uppercase tracking-wide" style={{ color: "#8C3B2E" }}>Total à transférer</p>
                  <p className="font-display text-xl font-semibold">{total}</p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs font-mono mb-1" style={{ color: "#8C3B2E" }}>
                  Disponible à {boutiqueSource} : {stockQty(article, boutiqueSource, null)}
                </p>
                <input className="qty-input" style={{ width: "80px" }} type="number" min="0" max={stockQty(article, boutiqueSource, null)} value={getValue(null)} onChange={(e) => setValue(null, e.target.value, stockQty(article, boutiqueSource, null))} />
              </div>
            )}

            <button onClick={soumettre} disabled={envoi}
              className="w-full mt-5 px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: saved ? "#3F6B4A" : envoi ? "#B8A88F" : "#8C3B2E", color: "#FBF3EC", opacity: envoi ? 0.7 : 1 }}>
              {saved ? "Transféré ✓" : `Transférer vers ${boutiqueDestination}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ImportSection({ brands, onImported }) {
  const [marqueId, setMarqueId] = useState(brands?.[0]?.id || "");
  const [famille, setFamille] = useState("Chaussure");
  const [modeQuantite, setModeQuantite] = useState("pointure");
  const [boutique, setBoutique] = useState("");
  const [fichier, setFichier] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [lignesEdit, setLignesEdit] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [resultat, setResultat] = useState(null);

  // Suggestion de mode par defaut selon la famille choisie — reste modifiable manuellement,
  // pour les familles a venir (bijoux, etc.) qui n'ont pas forcement besoin de pointures.
  useEffect(() => {
    setModeQuantite(famille === "Chaussure" ? "pointure" : "simple");
  }, [famille]);

  useEffect(() => {
    if (resultat || erreur) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [resultat, erreur]);

  const analyser = async () => {
    if (!fichier || !marqueId) { setErreur("Choisis une marque et un fichier."); return; }
    if (!boutique) { setErreur("Choisis la boutique concernée par cet arrivage."); return; }
    setChargement(true); setErreur(""); setResultat(null);
    try {
      const fd = new FormData();
      fd.append("fichier", fichier);
      fd.append("marqueId", marqueId);
      fd.append("famille", famille);
      fd.append("modeQuantite", modeQuantite);
      fd.append("boutique", boutique);
      const res = await api.articles.importApercu(fd);
      setApercu(res);
      setLignesEdit(res.lignes.map((l) => ({ ...l, prixVente: l.ecartPrix ? l.ancienPrix : (l.nouveauPrix ?? l.ancienPrix) })));
    } catch (e) { setErreur(e.message); } finally { setChargement(false); }
  };

  const confirmer = async () => {
    setChargement(true); setErreur("");
    try {
      const res = await api.articles.importConfirmer({
        marqueId, famille, modeQuantite, boutique,
        lignes: lignesEdit.map((l) => ({ designation: l.designation, articleId: l.articleId, prixVente: l.prixVente, quantites: l.quantites })),
      });
      setResultat(res);
      setApercu(null);
      setFichier(null);
      onImported();
    } catch (e) { setErreur(e.message); } finally { setChargement(false); }
  };

  const choisirPrix = (idx, prix) => {
    setLignesEdit((prev) => prev.map((l, i) => (i === idx ? { ...l, prixVente: prix } : l)));
  };

  return (
    <div>
      <div className="rounded-2xl p-5 mb-6" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
        <p className="font-display text-lg font-semibold mb-4">Importer un arrivage (mise en stock)</p>
        <div className="grid sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Marque</label>
            <select value={marqueId} onChange={(e) => setMarqueId(e.target.value)} style={selectStyle}>
              <option value="">— Choisir —</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Famille</label>
            <select value={famille} onChange={(e) => setFamille(e.target.value)} style={selectStyle}>
              {FAMILLES.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Colonnes du fichier</label>
            <select value={modeQuantite} onChange={(e) => setModeQuantite(e.target.value)} style={selectStyle}>
              <option value="pointure">Par pointure (T{POINTURES[0]} à T{POINTURES[POINTURES.length - 1]})</option>
              <option value="simple">Quantité simple (un seul total)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Boutique</label>
            <select value={boutique} onChange={(e) => setBoutique(e.target.value)} style={selectStyle}>
              <option value="">— Choisir —</option>
              {BOUTIQUES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="file" accept=".xls,.xlsx" onChange={(e) => setFichier(e.target.files?.[0] || null)} className="text-sm" />
          <button onClick={analyser} disabled={chargement || !fichier} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: chargement || !fichier ? 0.6 : 1 }}>
            {chargement ? "Analyse..." : "Analyser le fichier"}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: "#6B5D52" }}>
          {modeQuantite === "pointure" ? `Colonnes attendues : REFERENCES, T${POINTURES[0]} à T${POINTURES[POINTURES.length - 1]}, PRIX DE VENTE.` : "Colonnes attendues : REFERENCES, QUANTITE, PRIX DE VENTE."}
          {" "}Le choix "Colonnes du fichier" est indépendant de la famille — utile si un nouveau type de produit (bijoux, etc.) n'a pas besoin de pointures.
        </p>
      </div>

      {erreur && <p className="text-sm mb-4 p-3 rounded-lg" style={{ color: "#B04A3B", background: "#FBEAE7" }}>⚠ {erreur}</p>}

      {resultat && (
        <div className="rounded-2xl p-5 mb-6" style={{ background: "#E9F0EA", border: "1px solid #C9DECD" }}>
          <p className="font-medium text-sm" style={{ color: "#3F6B4A" }}>
            Import terminé : {resultat.articlesCreees} article(s) créé(s), {resultat.articlesMisesAJour} prix mis à jour, {resultat.mouvements} mouvement(s) de stock enregistré(s).
          </p>
        </div>
      )}

      {apercu && (
        <div>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <p className="text-sm" style={{ color: "#6B5D52" }}>
              <strong>{apercu.marque}</strong> · {apercu.famille} · {apercu.boutique} — {apercu.nbNouveaux} nouveau(x), {apercu.nbExistants} existant(s)
              {apercu.nbEcartsPrix > 0 && <span style={{ color: "#B04A3B" }}> · {apercu.nbEcartsPrix} écart(s) de prix à valider</span>}
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F1E9DC", color: "#6B5D52" }}>
                  <th className="text-left px-4 py-2">Désignation</th>
                  <th className="text-left px-4 py-2">Statut</th>
                  <th className="text-right px-4 py-2">Quantité à ajouter</th>
                  <th className="text-right px-4 py-2">Prix</th>
                </tr>
              </thead>
              <tbody>
                {lignesEdit.map((l, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #EFE7D9" }}>
                    <td className="px-4 py-2">{l.designation}</td>
                    <td className="px-4 py-2">
                      {l.existant
                        ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#F1E9DC", color: "#6B5D52" }}>Existant</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Nouveau</span>}
                    </td>
                    <td className="text-right px-4 py-2">{l.quantiteTotale}</td>
                    <td className="text-right px-4 py-2">
                      {l.ecartPrix ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs" style={{ color: "#B04A3B" }}>{l.ancienPrix} F → {l.nouveauPrix} F</span>
                          <select value={l.prixVente} onChange={(e) => choisirPrix(i, Number(e.target.value))} className="text-xs px-2 py-1 rounded" style={{ border: "1px solid #DDD3C4" }}>
                            <option value={l.ancienPrix}>Garder {l.ancienPrix} F</option>
                            <option value={l.nouveauPrix}>Prendre {l.nouveauPrix} F</option>
                          </select>
                        </div>
                      ) : (
                        <span>{l.prixVente ? `${l.prixVente} F` : "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => { setApercu(null); setFichier(null); }} className="px-4 py-2 rounded-lg text-sm" style={{ color: "#6B5D52" }}>Annuler</button>
            <button onClick={confirmer} disabled={chargement} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: chargement ? 0.6 : 1 }}>
              {chargement ? "Import en cours..." : "Confirmer l'import"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// ------------------------------------------------------------
// INVENTAIRE (export/import Excel) — comme les anciennes habitudes clients (Abigescom) :
// on télécharge une feuille Excel avec le stock système, on la remplit à la main pendant
// le comptage physique, puis on la réimporte pour appliquer les écarts.
// ------------------------------------------------------------
function InventaireSection({ brands, onApplique }) {
  const [boutique, setBoutique] = useState(BOUTIQUES[0]);
  const [marqueId, setMarqueId] = useState("");
  const [famille, setFamille] = useState("");
  const [telechargement, setTelechargement] = useState(false);

  const [fichier, setFichier] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [notes, setNotes] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [resultat, setResultat] = useState(null);

  useEffect(() => {
    if (resultat || erreur) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [resultat, erreur]);

  const telecharger = async () => {
    setTelechargement(true); setErreur("");
    try {
      await api.inventaire.export({ boutique, marqueId: marqueId || undefined, famille: famille || undefined });
    } catch (e) { setErreur(e.message); } finally { setTelechargement(false); }
  };

  const analyser = async () => {
    if (!fichier) { setErreur("Choisis le fichier Excel rempli à réimporter."); return; }
    setChargement(true); setErreur(""); setResultat(null);
    try {
      const fd = new FormData();
      fd.append("fichier", fichier);
      fd.append("boutique", boutique);
      const res = await api.inventaire.apercu(fd);
      setApercu(res);
    } catch (e) { setErreur(e.message); } finally { setChargement(false); }
  };

  const confirmer = async () => {
    setChargement(true); setErreur("");
    try {
      const lignesAAppliquer = apercu.lignes
        .filter((l) => l.statut === "OK" && l.ecart !== 0)
        .map((l) => ({ articleId: l.articleId, pointure: l.pointure, quantiteComptee: l.quantiteComptee }));
      const res = await api.inventaire.confirmer({ boutique, notes: notes || undefined, lignes: lignesAAppliquer });
      setResultat(res);
      setApercu(null);
      setFichier(null);
      setNotes("");
      onApplique();
    } catch (e) { setErreur(e.message); } finally { setChargement(false); }
  };

  const badgeStatut = (statut) => {
    const styles = {
      OK: { background: "#E9F0EA", color: "#3F6B4A", label: "OK" },
      INTROUVABLE: { background: "#FBEAE7", color: "#B04A3B", label: "Référence introuvable" },
      ERREUR: { background: "#FBEAE7", color: "#B04A3B", label: "Erreur" },
      IGNOREE: { background: "#F1E9DC", color: "#6B5D52", label: "Ignorée (vide)" },
    };
    const s = styles[statut] || styles.ERREUR;
    return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.background, color: s.color }}>{s.label}</span>;
  };

  return (
    <div>
      <div className="rounded-2xl p-5 mb-6" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
        <p className="font-display text-lg font-semibold mb-1">1. Télécharger la feuille de comptage</p>
        <p className="text-xs mb-4" style={{ color: "#6B5D52" }}>
          Génère un fichier Excel avec chaque article (et pointure) de la sélection, son stock système, et une colonne "Stock Compté" à remplir pendant l'inventaire physique. Ne modifie rien en base.
        </p>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Boutique</label>
            <select value={boutique} onChange={(e) => setBoutique(e.target.value)} style={selectStyle}>
              {BOUTIQUES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Marque (optionnel)</label>
            <select value={marqueId} onChange={(e) => setMarqueId(e.target.value)} style={selectStyle}>
              <option value="">Toutes les marques</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Famille (optionnel)</label>
            <select value={famille} onChange={(e) => setFamille(e.target.value)} style={selectStyle}>
              <option value="">Toutes les familles</option>
              {FAMILLES.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <button onClick={telecharger} disabled={telechargement} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: telechargement ? 0.6 : 1 }}>
          {telechargement ? "Génération..." : "⬇ Télécharger la feuille Excel"}
        </button>
      </div>

      <div className="rounded-2xl p-5 mb-6" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
        <p className="font-display text-lg font-semibold mb-1">2. Réimporter le fichier rempli</p>
        <p className="text-xs mb-4" style={{ color: "#6B5D52" }}>
          Ne touche pas aux colonnes Référence et Pointure — seule la colonne "Stock Compté" doit être remplie. Les lignes laissées vides sont ignorées (le stock système reste inchangé).
        </p>
        <div className="flex items-center gap-3">
          <input type="file" accept=".xls,.xlsx" onChange={(e) => setFichier(e.target.files?.[0] || null)} className="text-sm" />
          <button onClick={analyser} disabled={chargement || !fichier} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: chargement || !fichier ? 0.6 : 1 }}>
            {chargement ? "Analyse..." : "Analyser le fichier"}
          </button>
        </div>
      </div>

      {erreur && <p className="text-sm mb-4 p-3 rounded-lg" style={{ color: "#B04A3B", background: "#FBEAE7" }}>⚠ {erreur}</p>}

      {resultat && (
        <div className="rounded-2xl p-5 mb-6" style={{ background: "#E9F0EA", border: "1px solid #C9DECD" }}>
          <p className="font-medium text-sm" style={{ color: "#3F6B4A" }}>
            Inventaire appliqué : {resultat.corrections} correction(s) enregistrée(s), {resultat.inchanges} article(s) déjà juste(s).
            {resultat.erreurs?.length > 0 && ` ${resultat.erreurs.length} erreur(s).`}
          </p>
        </div>
      )}

      {apercu && (
        <div>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <p className="text-sm" style={{ color: "#6B5D52" }}>
              {apercu.nombreLignes} ligne(s) lue(s) — {apercu.nombreOk} reconnue(s), {apercu.nombreEcarts} écart(s) à corriger
              {apercu.nombreIntrouvables > 0 && <span style={{ color: "#B04A3B" }}> · {apercu.nombreIntrouvables} référence(s) introuvable(s)</span>}
              {apercu.nombreErreurs > 0 && <span style={{ color: "#B04A3B" }}> · {apercu.nombreErreurs} ligne(s) en erreur</span>}
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F1E9DC", color: "#6B5D52" }}>
                  <th className="text-left px-4 py-2">Référence</th>
                  <th className="text-left px-4 py-2">Désignation</th>
                  <th className="text-left px-4 py-2">Pointure</th>
                  <th className="text-right px-4 py-2">Stock système</th>
                  <th className="text-right px-4 py-2">Stock compté</th>
                  <th className="text-right px-4 py-2">Écart</th>
                  <th className="text-left px-4 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {apercu.lignes.map((l, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #EFE7D9" }}>
                    <td className="px-4 py-2">{l.reference || "—"}</td>
                    <td className="px-4 py-2">{l.designation || "—"}</td>
                    <td className="px-4 py-2">{l.pointure || "—"}</td>
                    <td className="text-right px-4 py-2">{l.statut === "OK" ? l.stockActuel : "—"}</td>
                    <td className="text-right px-4 py-2">{l.statut === "OK" ? l.quantiteComptee : "—"}</td>
                    <td className="text-right px-4 py-2" style={{ color: l.ecart > 0 ? "#3F6B4A" : l.ecart < 0 ? "#B04A3B" : "#6B5D52", fontWeight: 600 }}>
                      {l.statut === "OK" ? (l.ecart > 0 ? `+${l.ecart}` : l.ecart) : "—"}
                    </td>
                    <td className="px-4 py-2">{badgeStatut(l.statut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-4">
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Motif / notes (optionnel)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} style={selectStyle} placeholder="Ex : Inventaire mensuel du 2 août" />
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => { setApercu(null); setFichier(null); }} className="px-4 py-2 rounded-lg text-sm" style={{ color: "#6B5D52" }}>Annuler</button>
            <button onClick={confirmer} disabled={chargement || apercu.nombreEcarts === 0} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: chargement || apercu.nombreEcarts === 0 ? 0.6 : 1 }}>
              {chargement ? "Application..." : `Confirmer l'inventaire (${apercu.nombreEcarts} écart(s))`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// SOLDES (remises groupées temporaires) — sélection multiple d'articles filtrés par
// marque/famille, application d'un pourcentage ou d'un montant en une seule action.
// Les prix d'origine sont restaurés automatiquement à la date de fin (côté serveur).
// ------------------------------------------------------------
function SoldesSection({ brands }) {
  const [marqueId, setMarqueId] = useState("");
  const [famille, setFamille] = useState("");
  const [recherche, setRecherche] = useState("");
  const [articles, setArticles] = useState([]);
  const [selection, setSelection] = useState(new Set());
  const [chargementArticles, setChargementArticles] = useState(false);

  const [nom, setNom] = useState("");
  const [type, setType] = useState("POURCENTAGE");
  const [valeur, setValeur] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [resultat, setResultat] = useState(null);

  const [campagnes, setCampagnes] = useState([]);
  const [chargementCampagnes, setChargementCampagnes] = useState(false);

  const chargerArticles = useCallback(async () => {
    setChargementArticles(true); setErreur("");
    try {
      const a = await api.soldes.listerArticles({ marqueId: marqueId || undefined, famille: famille || undefined });
      setArticles(a);
      setSelection(new Set());
    } catch (e) { setErreur(e.message); } finally { setChargementArticles(false); }
  }, [marqueId, famille]);

  const chargerCampagnes = useCallback(async () => {
    setChargementCampagnes(true);
    try { setCampagnes(await api.soldes.lister()); } catch (e) { setErreur(e.message); } finally { setChargementCampagnes(false); }
  }, []);

  useEffect(() => { chargerArticles(); }, [chargerArticles]);
  useEffect(() => { chargerCampagnes(); }, [chargerCampagnes]);

  const toggleArticle = (id) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const articlesSelectionnables = articles.filter((a) => !a.dejaEnSolde);
  const articlesAffiches = recherche.trim()
    ? articles.filter((a) => {
        const q = recherche.trim().toLowerCase();
        return a.designation.toLowerCase().includes(q) || a.reference.toLowerCase().includes(q);
      })
    : articles;
  const toutSelectionner = () => setSelection(new Set(articlesSelectionnables.map((a) => a.id)));
  const toutDeselectionner = () => setSelection(new Set());

  const previsualiserPrix = (prixVente) => {
    if (!valeur || Number(valeur) <= 0) return prixVente;
    if (type === "POURCENTAGE") return Math.max(0, Math.round(prixVente - (prixVente * Number(valeur)) / 100));
    return Math.max(0, prixVente - Number(valeur));
  };

  const appliquer = async () => {
    if (selection.size === 0) { setErreur("Sélectionne au moins un article."); return; }
    if (!valeur || Number(valeur) <= 0) { setErreur("Indique une valeur de remise valide."); return; }
    if (type === "POURCENTAGE" && Number(valeur) > 100) { setErreur("Un pourcentage ne peut pas dépasser 100."); return; }
    if (!dateFin) { setErreur("Choisis une date de fin."); return; }
    setEnvoiEnCours(true); setErreur(""); setResultat(null);
    try {
      const campagne = await api.soldes.creer({
        nom: nom || undefined, type, valeur: Number(valeur),
        dateFin: new Date(`${dateFin}T23:59:59`).toISOString(),
        articleIds: Array.from(selection),
      });
      setResultat(campagne);
      setNom(""); setValeur(""); setDateFin("");
      chargerArticles();
      chargerCampagnes();
    } catch (e) { setErreur(e.message); } finally { setEnvoiEnCours(false); }
  };

  const terminerMaintenant = async (campagne) => {
    const confirme = window.confirm(`Terminer maintenant les soldes "${campagne.nom || campagne.numero}" ? Les prix d'origine seront restaurés immédiatement.`);
    if (!confirme) return;
    try {
      await api.soldes.terminer(campagne.id);
      chargerCampagnes();
      chargerArticles();
    } catch (e) { setErreur(e.message); }
  };

  return (
    <div>
      <div className="rounded-2xl p-5 mb-6" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
        <p className="font-display text-lg font-semibold mb-1">Nouvelle campagne de soldes</p>
        <p className="text-xs mb-4" style={{ color: "#6B5D52" }}>
          Filtre les articles concernés, sélectionne-les, choisis une remise et une date de fin — les prix reviendront automatiquement à la normale ce jour-là.
        </p>

        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Marque (filtre)</label>
            <select value={marqueId} onChange={(e) => setMarqueId(e.target.value)} style={selectStyle}>
              <option value="">Toutes les marques</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Famille (filtre)</label>
            <select value={famille} onChange={(e) => setFamille(e.target.value)} style={selectStyle}>
              <option value="">Toutes les familles</option>
              {FAMILLES.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Rechercher un article</label>
            <div className="relative">
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Référence ou désignation…" style={{ ...selectStyle, paddingLeft: "30px" }} />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#6B5D52" />
            </div>
          </div>
        </div>

        {erreur && <p className="text-sm mb-4 p-3 rounded-lg" style={{ color: "#B04A3B", background: "#FBEAE7" }}>⚠ {erreur}</p>}
        {resultat && (
          <p className="text-sm mb-4 p-3 rounded-lg" style={{ color: "#3F6B4A", background: "#E9F0EA" }}>
            Campagne "{resultat.nom || resultat.numero}" créée : {resultat.lignes.length} article(s) mis en soldes.
          </p>
        )}

        {chargementArticles ? (
          <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement…</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs" style={{ color: "#6B5D52" }}>{selection.size} sélectionné(s) sur {articlesSelectionnables.length} éligible(s) ({articles.length - articlesSelectionnables.length} déjà en soldes exclu(s))</p>
              <div className="flex gap-2">
                <button type="button" onClick={toutSelectionner} className="text-xs px-2 py-1 rounded" style={{ border: "1px solid #DDD3C4", color: "#6B5D52" }}>Tout sélectionner</button>
                <button type="button" onClick={toutDeselectionner} className="text-xs px-2 py-1 rounded" style={{ border: "1px solid #DDD3C4", color: "#6B5D52" }}>Tout désélectionner</button>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2", maxHeight: "320px", overflowY: "auto" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#F1E9DC", color: "#6B5D52" }}>
                    <th className="text-left px-3 py-2"></th>
                    <th className="text-left px-3 py-2">Article</th>
                    <th className="text-left px-3 py-2">Marque</th>
                    <th className="text-right px-3 py-2">Prix actuel</th>
                    <th className="text-right px-3 py-2">Prix soldé prévu</th>
                  </tr>
                </thead>
                <tbody>
                  {articlesAffiches.map((a) => (
                    <tr key={a.id} style={{ borderTop: "1px solid #EFE7D9", opacity: a.dejaEnSolde ? 0.5 : 1 }}>
                      <td className="px-3 py-2">
                        <input type="checkbox" disabled={a.dejaEnSolde} checked={selection.has(a.id)} onChange={() => toggleArticle(a.id)} />
                      </td>
                      <td className="px-3 py-2">
                        {a.designation} <span style={{ color: "#6B5D52" }}>({a.reference})</span>
                        {a.dejaEnSolde && <span className="text-xs ml-2" style={{ color: "#B04A3B" }}>(déjà en soldes — {a.campagneActive})</span>}
                      </td>
                      <td className="px-3 py-2">{a.marque}</td>
                      <td className="text-right px-3 py-2">{fmt(a.prixVente)} F</td>
                      <td className="text-right px-3 py-2" style={{ color: "#8C3B2E", fontWeight: 600 }}>
                        {selection.has(a.id) ? `${fmt(previsualiserPrix(a.prixVente))} F` : "—"}
                      </td>
                    </tr>
                  ))}
                  {articlesAffiches.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-sm" style={{ color: "#6B5D52" }}>{recherche.trim() ? "Aucun article ne correspond à cette recherche." : "Aucun article pour ce filtre."}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="grid sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Nom (optionnel)</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} style={selectStyle} placeholder="Ex : Soldes Août" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle}>
              <option value="POURCENTAGE">Pourcentage (%)</option>
              <option value="MONTANT">Montant (F)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Valeur</label>
            <input type="number" min="0" value={valeur} onChange={(e) => setValeur(e.target.value)} style={selectStyle} placeholder={type === "POURCENTAGE" ? "Ex : 20" : "Ex : 5000"} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Date de fin</label>
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} style={selectStyle} />
          </div>
        </div>

        <button onClick={appliquer} disabled={envoiEnCours || selection.size === 0} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: envoiEnCours || selection.size === 0 ? 0.6 : 1 }}>
          {envoiEnCours ? "Application..." : `Appliquer les soldes (${selection.size} article(s))`}
        </button>
      </div>

      <div className="rounded-2xl p-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
        <p className="font-display text-lg font-semibold mb-4">Campagnes de soldes</p>
        {chargementCampagnes ? (
          <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement…</p>
        ) : campagnes.length === 0 ? (
          <p className="text-sm" style={{ color: "#6B5D52" }}>Aucune campagne pour l'instant.</p>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #EAE1D2" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F1E9DC", color: "#6B5D52" }}>
                  <th className="text-left px-4 py-2">Campagne</th>
                  <th className="text-left px-4 py-2">Remise</th>
                  <th className="text-left px-4 py-2">Articles</th>
                  <th className="text-left px-4 py-2">Fin</th>
                  <th className="text-left px-4 py-2">Statut</th>
                  <th className="text-right px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {campagnes.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid #EFE7D9" }}>
                    <td className="px-4 py-2">{c.nom || c.numero}</td>
                    <td className="px-4 py-2">{c.type === "POURCENTAGE" ? `- ${c.valeur}%` : `- ${fmt(c.valeur)} F`}</td>
                    <td className="px-4 py-2">{c.nombreArticles}</td>
                    <td className="px-4 py-2">{new Date(c.dateFin).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-2">
                      {c.statut === "ACTIVE"
                        ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#E9F0EA", color: "#3F6B4A" }}>Active</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#F1E9DC", color: "#6B5D52" }}>Terminée{c.terminaisonAnticipee ? " (anticipée)" : ""}</span>}
                    </td>
                    <td className="text-right px-4 py-2">
                      {c.statut === "ACTIVE" && (
                        <button onClick={() => terminerMaintenant(c)} className="text-xs px-2 py-1 rounded" style={{ border: "1px solid #DDD3C4", color: "#B04A3B" }}>
                          Terminer maintenant
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// RÉCEPTION — arrivage fournisseur, façon Archange Bébé : fournisseur, référence du bon de
// livraison, recherche d'article, prix d'achat, notes. Pas de date de péremption (spécifique
// aux cosmétiques d'Archange Bébé, non pertinent pour des chaussures/sacs).
// ------------------------------------------------------------
function ReceptionSection({ articles, onApplique }) {
  const [boutique, setBoutique] = useState("");
  const [fournisseurs, setFournisseurs] = useState([]);
  const [fournisseurId, setFournisseurId] = useState("");
  const [fournisseurNomLibre, setFournisseurNomLibre] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => { api.fournisseurs.lister(true).then(setFournisseurs).catch(() => {}); }, []);

  const [rechercheArticle, setRechercheArticle] = useState("");
  const [articleChoisi, setArticleChoisi] = useState(null);
  const [pointureChoisie, setPointureChoisie] = useState("");
  const [quantiteChoisie, setQuantiteChoisie] = useState("");
  const [prixAchatChoisi, setPrixAchatChoisi] = useState("");

  const [lignes, setLignes] = useState([]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [resultat, setResultat] = useState(null);

  const [receptions, setReceptions] = useState([]);
  const [chargementHistorique, setChargementHistorique] = useState(false);

  const chargerHistorique = useCallback(async () => {
    setChargementHistorique(true);
    try { setReceptions(await api.receptions.lister(boutique)); } catch (e) { setErreur(e.message); } finally { setChargementHistorique(false); }
  }, [boutique]);
  useEffect(() => { chargerHistorique(); }, [chargerHistorique]);

  const resultatsRecherche = useMemo(() => {
    const q = rechercheArticle.trim().toLowerCase();
    if (!q) return [];
    return (articles || []).filter((a) => a.designation.toLowerCase().includes(q) || a.reference.toLowerCase().includes(q)).slice(0, 8);
  }, [articles, rechercheArticle]);

  const choisirArticle = (a) => {
    setArticleChoisi(a);
    setRechercheArticle("");
    setPointureChoisie("");
    setQuantiteChoisie("");
    setPrixAchatChoisi(a.prixAchat != null ? String(a.prixAchat) : "");
  };

  const ajouterLigne = () => {
    if (!articleChoisi) { setErreur("Choisis un article."); return; }
    if (articleChoisi.famille === "Chaussure" && !pointureChoisie) { setErreur("Choisis une pointure."); return; }
    const quantite = parseInt(quantiteChoisie, 10);
    if (!quantite || quantite <= 0) { setErreur("Indique une quantité valide."); return; }
    setLignes([...lignes, {
      id: uidLocal(), articleId: articleChoisi.id, designation: articleChoisi.designation,
      pointure: articleChoisi.famille === "Chaussure" ? pointureChoisie : "",
      quantite, prixAchat: prixAchatChoisi ? Number(prixAchatChoisi) : null,
    }]);
    setArticleChoisi(null); setPointureChoisie(""); setQuantiteChoisie(""); setPrixAchatChoisi("");
    setErreur("");
  };
  const retirerLigne = (id) => setLignes(lignes.filter((l) => l.id !== id));

  const enregistrer = async () => {
    if (lignes.length === 0) { setErreur("Ajoute au moins une ligne à la réception."); return; }
    if (!boutique) { setErreur("Choisis la boutique concernée par cette réception."); return; }
    setEnvoiEnCours(true); setErreur(""); setResultat(null);
    try {
      const rec = await api.receptions.creer({
        fournisseurId: fournisseurId || undefined,
        fournisseurNomLibre: fournisseurId ? undefined : (fournisseurNomLibre || undefined),
        reference: reference || undefined, boutique, notes: notes || undefined,
        lignes: lignes.map(({ articleId, pointure, quantite, prixAchat }) => ({ articleId, pointure, quantite, prixAchat })),
      });
      setResultat(rec);
      setLignes([]); setFournisseurId(""); setFournisseurNomLibre(""); setReference(""); setNotes("");
      chargerHistorique();
      onApplique();
    } catch (e) { setErreur(e.message); } finally { setEnvoiEnCours(false); }
  };

  return (
    <div>
      <div className="rounded-2xl p-5 mb-6" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
        <p className="font-display text-lg font-semibold mb-4">Nouvelle réception</p>

        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Boutique</label>
            <select value={boutique} onChange={(e) => setBoutique(e.target.value)} style={selectStyle}>
              <option value="">— Choisir —</option>
              {BOUTIQUES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Fournisseur (optionnel)</label>
            <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} style={selectStyle}>
              <option value="">— Non enregistré / ponctuel —</option>
              {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
            {!fournisseurId && (
              <input value={fournisseurNomLibre} onChange={(e) => setFournisseurNomLibre(e.target.value)} style={{ ...selectStyle, marginTop: "6px" }} placeholder="Nom libre (ex : Hispanitas Import)" />
            )}
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Référence bon de livraison (optionnel)</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} style={selectStyle} placeholder="Ex : BL-2026-045" />
          </div>
        </div>

        <div className="rounded-xl p-4 mb-4" style={{ background: "#FAF7F2", border: "1px solid #EFE7D9" }}>
          <p className="text-sm font-medium mb-3">Ajouter un article</p>
          <div className="relative mb-3">
            <input value={rechercheArticle} onChange={(e) => { setRechercheArticle(e.target.value); setArticleChoisi(null); }} placeholder="Rechercher par désignation ou référence…" style={{ ...selectStyle, paddingLeft: "32px" }} />
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
            <div className="grid sm:grid-cols-4 gap-3 items-end">
              <div className="sm:col-span-1">
                <p className="text-xs mb-1" style={{ color: "#6B5D52" }}>Article</p>
                <p className="text-sm font-medium">{articleChoisi.designation}</p>
              </div>
              {articleChoisi.famille === "Chaussure" && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Pointure</label>
                  <select value={pointureChoisie} onChange={(e) => setPointureChoisie(e.target.value)} style={selectStyle}>
                    <option value="">—</option>
                    {POINTURES.map((p) => <option key={p} value={p}>T{p}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Quantité</label>
                <input type="number" min="1" value={quantiteChoisie} onChange={(e) => setQuantiteChoisie(e.target.value)} style={selectStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Prix d'achat (optionnel)</label>
                <input type="number" min="0" value={prixAchatChoisi} onChange={(e) => setPrixAchatChoisi(e.target.value)} style={selectStyle} />
              </div>
              <button onClick={ajouterLigne} className="px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Ajouter à la réception</button>
            </div>
          )}
        </div>

        {erreur && <p className="text-sm mb-4 p-3 rounded-lg" style={{ color: "#B04A3B", background: "#FBEAE7" }}>⚠ {erreur}</p>}
        {resultat && (
          <p className="text-sm mb-4 p-3 rounded-lg" style={{ color: "#3F6B4A", background: "#E9F0EA" }}>
            Réception enregistrée : {resultat.lignes.length} ligne(s), stock mis à jour.
          </p>
        )}

        {lignes.length > 0 && (
          <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F1E9DC", color: "#6B5D52" }}>
                  <th className="text-left px-4 py-2">Article</th>
                  <th className="text-left px-4 py-2">Pointure</th>
                  <th className="text-right px-4 py-2">Quantité</th>
                  <th className="text-right px-4 py-2">Prix d'achat</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id} style={{ borderTop: "1px solid #EFE7D9" }}>
                    <td className="px-4 py-2">{l.designation}</td>
                    <td className="px-4 py-2">{l.pointure ? `T${l.pointure}` : "—"}</td>
                    <td className="text-right px-4 py-2">{l.quantite}</td>
                    <td className="text-right px-4 py-2">{l.prixAchat != null ? `${fmt(l.prixAchat)} F` : "—"}</td>
                    <td className="text-right px-4 py-2"><button onClick={() => retirerLigne(l.id)} style={{ color: "#B04A3B" }}><X size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs mb-1" style={{ color: "#6B5D52" }}>Notes (optionnel)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} style={selectStyle} placeholder="Ex : Colis reçu incomplet, 2 paires manquantes signalées au fournisseur" />
        </div>

        <button onClick={enregistrer} disabled={envoiEnCours || lignes.length === 0} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: envoiEnCours || lignes.length === 0 ? 0.6 : 1 }}>
          {envoiEnCours ? "Enregistrement..." : `Enregistrer la réception (${lignes.length} ligne(s))`}
        </button>
      </div>

      <div className="rounded-2xl p-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
        <p className="font-display text-lg font-semibold mb-4">Historique des réceptions — {boutique}</p>
        {chargementHistorique ? (
          <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement…</p>
        ) : receptions.length === 0 ? (
          <p className="text-sm" style={{ color: "#6B5D52" }}>Aucune réception enregistrée pour l'instant.</p>
        ) : (
          <div className="space-y-3">
            {receptions.map((r) => (
              <div key={r.id} className="rounded-xl p-4" style={{ background: "#FAF7F2", border: "1px solid #EFE7D9" }}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <p className="text-sm font-medium">
                    {r.fournisseur?.nom || r.fournisseurNomLibre || "Fournisseur non précisé"} {r.reference ? `· ${r.reference}` : ""}
                  </p>
                  <p className="text-xs" style={{ color: "#6B5D52" }}>{new Date(r.dateReception).toLocaleDateString("fr-FR")} · {r.effectuePar?.prenom} {r.effectuePar?.nom}</p>
                </div>
                <div className="text-xs space-y-1" style={{ color: "#6B5D52" }}>
                  {r.lignes.map((l) => (
                    <div key={l.id} className="flex justify-between">
                      <span>{l.article?.designation}{l.pointure ? ` T${l.pointure}` : ""} ×{l.quantite}</span>
                      <span>{l.prixAchat != null ? `${fmt(l.prixAchat)} F / unité` : ""}</span>
                    </div>
                  ))}
                </div>
                {r.notes && <p className="text-xs mt-2 italic" style={{ color: "#6B5D52" }}>{r.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
