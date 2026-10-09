import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, X, Truck, Receipt, CreditCard, Link2, Unlink } from "lucide-react";
import { api } from "../api.js";
import { fmt } from "../constants.js";
import { Field, ErrorBanner, inputStyle, selectStyle } from "../components/Shared.jsx";

export default function FournisseursSection() {
  const [fournisseurs, setFournisseurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalFournisseur, setModalFournisseur] = useState(null);
  const [ficheId, setFicheId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setFournisseurs(await api.fournisseurs.lister()); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => setModalFournisseur({ isNew: true, nom: "", telephone: "", email: "", adresse: "", notes: "" });
  const openEdit = (f) => setModalFournisseur({ ...f, isNew: false });

  const submit = async (form) => {
    if (!form.nom.trim()) { setError("Le nom du fournisseur est obligatoire."); return; }
    try {
      if (form.isNew) await api.fournisseurs.creer(form);
      else await api.fournisseurs.modifier(form.id, form);
      setModalFournisseur(null);
      load();
    } catch (e) { setError(e.message); }
  };

  if (ficheId) {
    return <FicheFournisseur id={ficheId} onBack={() => { setFicheId(null); load(); }} onEdit={(f) => openEdit(f)} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <p className="font-display text-2xl font-semibold">Fournisseurs</p>
          <p className="text-xs mt-0.5" style={{ color: "#6B5D52" }}>Coordonnées, articles fournis, montants dus et paiements.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>
          <Plus size={16} /> Nouveau fournisseur
        </button>
      </div>

      <ErrorBanner error={error} onClose={() => setError("")} />

      {loading ? (
        <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement…</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {fournisseurs.map((f) => (
            <div key={f.id} className="stitch card-hover rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium leading-tight flex items-center gap-1.5"><Truck size={14} color="#8C3B2E" /> {f.nom}</p>
                  <p className="text-xs mt-1" style={{ color: "#6B5D52" }}>{f.telephone || "— pas de téléphone"}{f.email ? ` · ${f.email}` : ""}</p>
                </div>
                {!f.actif && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "#F1E9DC", color: "#6B5D52" }}>Inactif</span>}
              </div>
              <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid #EFE7D9" }}>
                <div>
                  <p className="text-xs font-mono uppercase tracking-wide" style={{ color: "#8C3B2E" }}>Solde dû</p>
                  <p className="font-display text-lg font-semibold" style={{ color: f.solde > 0 ? "#B04A3B" : "#3F6B4A" }}>{fmt(f.solde)} F</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setFicheId(f.id)} title="Voir la fiche" style={{ color: "#3F6B4A" }}><Receipt size={16} /></button>
                  <button onClick={() => openEdit(f)} title="Modifier" style={{ color: "#8C3B2E" }}><Pencil size={16} /></button>
                </div>
              </div>
            </div>
          ))}
          {fournisseurs.length === 0 && <p className="text-sm" style={{ color: "#6B5D52" }}>Aucun fournisseur enregistré pour l'instant.</p>}
        </div>
      )}

      {modalFournisseur && <FournisseurModal fournisseur={modalFournisseur} onCancel={() => setModalFournisseur(null)} onSubmit={submit} />}
    </div>
  );
}

function FournisseurModal({ fournisseur, onCancel, onSubmit }) {
  const [form, setForm] = useState(fournisseur);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-10" style={{ background: "rgba(43,35,32,0.45)" }}>
      <div className="rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: "#FFFDF9" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-lg font-semibold">{form.isNew ? "Nouveau fournisseur" : "Modifier le fournisseur"}</p>
          <button onClick={onCancel}><X size={18} color="#6B5D52" /></button>
        </div>
        <Field label="Nom *"><input value={form.nom} onChange={(e) => set("nom", e.target.value)} style={inputStyle} /></Field>
        <Field label="Téléphone"><input value={form.telephone || ""} onChange={(e) => set("telephone", e.target.value)} style={inputStyle} /></Field>
        <Field label="Email"><input value={form.email || ""} onChange={(e) => set("email", e.target.value)} style={inputStyle} /></Field>
        <Field label="Adresse"><input value={form.adresse || ""} onChange={(e) => set("adresse", e.target.value)} style={inputStyle} /></Field>
        <Field label="Notes"><input value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} style={inputStyle} /></Field>
        {!form.isNew && (
          <Field label="Statut">
            <select value={form.actif ? "1" : "0"} onChange={(e) => set("actif", e.target.value === "1")} style={inputStyle}>
              <option value="1">Actif</option>
              <option value="0">Inactif</option>
            </select>
          </Field>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm" style={{ color: "#6B5D52" }}>Fermer</button>
          <button onClick={() => onSubmit(form)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function FicheFournisseur({ id, onBack, onEdit }) {
  const [f, setF] = useState(null);
  const [tousArticles, setTousArticles] = useState([]);
  const [error, setError] = useState("");
  const [modalPaiement, setModalPaiement] = useState(false);
  const [articleRecherche, setArticleRecherche] = useState("");

  const load = useCallback(async () => {
    try { setF(await api.fournisseurs.get(id)); } catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.articles.list().then(setTousArticles).catch(() => {}); }, []);

  const dejaLies = new Set((f?.articles || []).map((l) => l.articleId));
  const articlesTrouves = articleRecherche.trim()
    ? tousArticles.filter((a) => !dejaLies.has(a.id) && (a.designation.toLowerCase().includes(articleRecherche.toLowerCase()) || a.reference.toLowerCase().includes(articleRecherche.toLowerCase()))).slice(0, 8)
    : [];

  const lierArticle = async (articleId) => {
    try { await api.fournisseurs.lierArticle(id, articleId); setArticleRecherche(""); load(); } catch (e) { setError(e.message); }
  };
  const delierArticle = async (articleId) => {
    try { await api.fournisseurs.delierArticle(id, articleId); load(); } catch (e) { setError(e.message); }
  };

  const enregistrerPaiement = async (data) => {
    try { await api.fournisseurs.enregistrerPaiement(id, data); setModalPaiement(false); load(); } catch (e) { setError(e.message); }
  };

  if (!f) return <p className="text-sm" style={{ color: "#6B5D52" }}>Chargement…</p>;

  return (
    <div>
      <button onClick={onBack} className="text-xs font-medium mb-4" style={{ color: "#8C3B2E" }}>← Retour à la liste</button>
      <ErrorBanner error={error} onClose={() => setError("")} />

      <div className="rounded-xl p-5 mb-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="font-display text-xl font-semibold flex items-center gap-2"><Truck size={18} color="#8C3B2E" /> {f.nom}</p>
            <p className="text-xs mt-1" style={{ color: "#6B5D52" }}>{f.telephone || "—"}{f.email ? ` · ${f.email}` : ""}{f.adresse ? ` · ${f.adresse}` : ""}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono uppercase tracking-wide" style={{ color: "#8C3B2E" }}>Solde dû</p>
            <p className="font-display text-2xl font-semibold" style={{ color: f.solde > 0 ? "#B04A3B" : "#3F6B4A" }}>{fmt(f.solde)} F</p>
            <p className="text-xs mt-0.5" style={{ color: "#6B5D52" }}>{fmt(f.totalReceptions)} F reçus · {fmt(f.totalPaiements)} F payés</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 pt-4" style={{ borderTop: "1px solid #EFE7D9" }}>
          <button onClick={() => onEdit(f)} className="flex items-center gap-1.5 text-sm" style={{ color: "#8C3B2E" }}><Pencil size={14} /> Modifier la fiche</button>
          <button onClick={() => setModalPaiement(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ml-auto" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>
            <CreditCard size={14} /> Enregistrer un paiement
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
          <p className="font-display text-base font-semibold mb-3">Articles fournis</p>
          <div className="relative mb-3">
            <input value={articleRecherche} onChange={(e) => setArticleRecherche(e.target.value)} placeholder="Chercher un article à associer…" style={inputStyle} />
            {articlesTrouves.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-10" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
                {articlesTrouves.map((a) => (
                  <button key={a.id} onClick={() => lierArticle(a.id)} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2" style={{ borderTop: "1px solid #EFE7D9" }}>
                    <Link2 size={13} color="#3F6B4A" /> {a.designation} <span style={{ color: "#6B5D52" }}>({a.reference})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            {f.articles.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg" style={{ background: "#FAF7F2" }}>
                <span>{l.article.designation} <span style={{ color: "#6B5D52" }}>({l.article.reference})</span></span>
                <button onClick={() => delierArticle(l.article.id)} title="Retirer"><Unlink size={14} color="#B04A3B" /></button>
              </div>
            ))}
            {f.articles.length === 0 && <p className="text-xs" style={{ color: "#6B5D52" }}>Aucun article associé pour l'instant.</p>}
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
          <p className="font-display text-base font-semibold mb-3">Historique des paiements</p>
          <div className="space-y-1.5">
            {f.paiements.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg" style={{ background: "#FAF7F2" }}>
                <div>
                  <p>{fmt(p.montant)} F <span className="text-xs" style={{ color: "#6B5D52" }}>· {p.mode}{p.reference ? ` · ${p.reference}` : ""}</span></p>
                  <p className="text-xs" style={{ color: "#6B5D52" }}>{new Date(p.createdAt).toLocaleDateString("fr-FR")} · {p.effectuePar?.prenom}</p>
                </div>
              </div>
            ))}
            {f.paiements.length === 0 && <p className="text-xs" style={{ color: "#6B5D52" }}>Aucun paiement enregistré pour l'instant.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5 mt-5" style={{ background: "#FFFFFF", border: "1px solid #EAE1D2" }}>
        <p className="font-display text-base font-semibold mb-3">Réceptions</p>
        <div className="space-y-2">
          {f.receptions.map((r) => {
            const total = r.lignes.reduce((s, l) => s + l.quantite * (l.prixAchat || 0), 0);
            return (
              <div key={r.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg" style={{ background: "#FAF7F2" }}>
                <div>
                  <p>{new Date(r.dateReception).toLocaleDateString("fr-FR")} · {r.boutique}{r.reference ? ` · Réf. ${r.reference}` : ""}</p>
                  <p className="text-xs" style={{ color: "#6B5D52" }}>{r.lignes.length} article(s)</p>
                </div>
                <span className="font-mono">{fmt(total)} F</span>
              </div>
            );
          })}
          {f.receptions.length === 0 && <p className="text-xs" style={{ color: "#6B5D52" }}>Aucune réception enregistrée pour l'instant.</p>}
        </div>
      </div>

      {modalPaiement && <PaiementModal solde={f.solde} onCancel={() => setModalPaiement(false)} onSubmit={enregistrerPaiement} />}
    </div>
  );
}

function PaiementModal({ solde, onCancel, onSubmit }) {
  const [montant, setMontant] = useState(solde > 0 ? String(solde) : "");
  const [mode, setMode] = useState("especes");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-20" style={{ background: "rgba(43,35,32,0.45)" }}>
      <div className="rounded-xl p-6 max-w-sm w-full" style={{ background: "#FFFDF9" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-lg font-semibold">Enregistrer un paiement</p>
          <button onClick={onCancel}><X size={18} color="#6B5D52" /></button>
        </div>
        <p className="text-xs mb-3" style={{ color: "#6B5D52" }}>Solde dû actuel : {fmt(solde)} F</p>
        <Field label="Montant"><input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} style={inputStyle} /></Field>
        <Field label="Mode de paiement">
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={inputStyle}>
            <option value="especes">Espèces</option>
            <option value="mobile">Mobile money</option>
            <option value="virement">Virement</option>
            <option value="cheque">Chèque</option>
          </select>
        </Field>
        <Field label="Référence (n° de virement/chèque)"><input value={reference} onChange={(e) => setReference(e.target.value)} style={inputStyle} /></Field>
        <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} /></Field>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm" style={{ color: "#6B5D52" }}>Annuler</button>
          <button onClick={() => onSubmit({ montant: Number(montant), mode, reference, note })} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#8C3B2E", color: "#FBF3EC" }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
