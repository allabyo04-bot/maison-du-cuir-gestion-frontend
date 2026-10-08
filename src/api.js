// Toutes les requêtes vers le backend passent par ici.
// L'URL du backend se configure via une variable d'environnement au moment du build
// (VITE_API_URL) — voir le .env.example du frontend.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getToken() {
  return localStorage.getItem("gc_token");
}

export function setToken(token) {
  if (token) localStorage.setItem("gc_token", token);
  else localStorage.removeItem("gc_token");
}

async function request(path, { method = "GET", body } = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = data?.error || `Erreur ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  auth: {
    login: (login, pin) => request("/api/auth/login", { method: "POST", body: { login, pin } }),
    me: () => request("/api/auth/me"),
    questionSecrete: (login) => request(`/api/auth/question-secrete/${encodeURIComponent(login)}`),
    reinitialiserPin: (data) => request("/api/auth/reinitialiser-pin", { method: "POST", body: data }),
  },
  users: {
    list: () => request("/api/users"),
    create: (data) => request("/api/users", { method: "POST", body: data }),
    update: (id, data) => request(`/api/users/${id}`, { method: "PUT", body: data }),
    remove: (id, codeConfirmation) => request(`/api/users/${id}`, { method: "DELETE", body: { codeConfirmation } }),
  },
  roles: {
    list: () => request("/api/roles"),
    create: (data) => request("/api/roles", { method: "POST", body: data }),
    update: (id, data) => request(`/api/roles/${id}`, { method: "PUT", body: data }),
    remove: (id, codeConfirmation) => request(`/api/roles/${id}`, { method: "DELETE", body: { codeConfirmation } }),
  },
  securite: {
    changerCode: (codeActuel, nouveauCode) => request("/api/securite/changer-code", { method: "POST", body: { codeActuel, nouveauCode } }),
  },
  fidelite: {
    client: (id) => request(`/api/fidelite/client/${id}`),
    clientsBonusDisponible: () => request("/api/fidelite/clients-bonus-disponible"),
    bonusAccordes: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
      return request(`/api/fidelite/bonus-accordes${qs ? `?${qs}` : ""}`);
    },
    clientsParStatut: (statut) => request(`/api/fidelite/clients-par-statut${statut ? `?statut=${encodeURIComponent(statut)}` : ""}`),
    paliersBonus: () => request("/api/fidelite/paliers-bonus"),
    creerPalierBonus: (data) => request("/api/fidelite/paliers-bonus", { method: "POST", body: data }),
    majPalierBonus: (id, data) => request(`/api/fidelite/paliers-bonus/${id}`, { method: "PUT", body: data }),
    supprimerPalierBonus: (id) => request(`/api/fidelite/paliers-bonus/${id}`, { method: "DELETE" }),
    paliersStatut: () => request("/api/fidelite/paliers-statut"),
    creerPalierStatut: (data) => request("/api/fidelite/paliers-statut", { method: "POST", body: data }),
    majPalierStatut: (id, data) => request(`/api/fidelite/paliers-statut/${id}`, { method: "PUT", body: data }),
    supprimerPalierStatut: (id) => request(`/api/fidelite/paliers-statut/${id}`, { method: "DELETE" }),
    changementsStatut: (tous) => request(`/api/fidelite/changements-statut${tous ? "?tous=1" : ""}`),
    marquerChangementStatutVu: (id) => request(`/api/fidelite/changements-statut/${id}/vu`, { method: "PUT" }),
  },
  journalAudit: {
    list: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
      return request(`/api/journal-audit${qs ? `?${qs}` : ""}`);
    },
    fichesClients: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
      return request(`/api/journal-audit/fiches-clients${qs ? `?${qs}` : ""}`);
    },
    remisesParCaissiere: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
      return request(`/api/journal-audit/remises-par-caissiere${qs ? `?${qs}` : ""}`);
    },
  },
  apiPublique: {
    listerCles: () => request("/api/api-publique/cles"),
    creerCle: (nom, codeConfirmation) => request("/api/api-publique/cles", { method: "POST", body: { nom, codeConfirmation } }),
    toggleCle: (id, actif) => request(`/api/api-publique/cles/${id}`, { method: "PUT", body: { actif } }),
  },
  brands: {
    list: () => request("/api/brands"),
    create: (nom) => request("/api/brands", { method: "POST", body: { nom } }),
    remove: (id) => request(`/api/brands/${id}`, { method: "DELETE" }),
  },
  articles: {
    list: () => request("/api/articles"),
    create: (data) => request("/api/articles", { method: "POST", body: data }),
    update: (id, data) => request(`/api/articles/${id}`, { method: "PUT", body: data }),
    remove: (id) => request(`/api/articles/${id}`, { method: "DELETE" }),
    desactiverTous: () => request("/api/articles/desactiver-tous", { method: "PUT" }),
historiqueMouvements: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/articles/mouvements/historique${qs ? `?${qs}` : ""}`);
    },
    updateStock: (id, boutique, pointure, quantite) =>
      request(`/api/articles/${id}/stock`, { method: "PUT", body: { boutique, pointure, quantite } }),
ajouterStock: (id, boutique, pointure, quantite) =>
      request(`/api/articles/${id}/stock/ajouter`, { method: "POST", body: { boutique, pointure, quantite } }),
    virementStock: (id, boutiqueSource, boutiqueDestination, pointure, quantite) =>
      request(`/api/articles/${id}/stock/virement`, { method: "POST", body: { boutiqueSource, boutiqueDestination, pointure, quantite } }),
    parametresStock: () => request("/api/articles/parametres-stock"),
    majParametresStock: (seuilFixe, seuilPourcentage) =>
      request("/api/articles/parametres-stock", { method: "PUT", body: { seuilFixe, seuilPourcentage } }),
    importApercu: async (formData) => {
      const token = localStorage.getItem("gc_token");
      const res = await fetch(`${API_URL}/api/articles/import/apercu`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      let data;
      try { data = await res.json(); } catch { data = null; }
      if (!res.ok) { const err = new Error(data?.error || `Erreur ${res.status}`); err.status = res.status; throw err; }
      return data;
    },
    importConfirmer: (data) => request("/api/articles/import/confirmer", { method: "POST", body: data }),
  },
  inventaire: {
    // Télécharge la feuille de comptage Excel et déclenche le téléchargement dans le navigateur.
    export: async ({ boutique, marqueId, famille }) => {
      const token = localStorage.getItem("gc_token");
      const qs = new URLSearchParams({ boutique, ...(marqueId ? { marqueId } : {}), ...(famille ? { famille } : {}) }).toString();
      const res = await fetch(`${API_URL}/api/inventaire/export?${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        let data; try { data = await res.json(); } catch { data = null; }
        const err = new Error(data?.error || `Erreur ${res.status}`); err.status = res.status; throw err;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const nomFichier = match ? match[1] : "inventaire.xlsx";
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nomFichier; document.body.appendChild(a); a.click();
      a.remove(); window.URL.revokeObjectURL(url);
    },
    apercu: async (formData) => {
      const token = localStorage.getItem("gc_token");
      const res = await fetch(`${API_URL}/api/inventaire/apercu`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      let data;
      try { data = await res.json(); } catch { data = null; }
      if (!res.ok) { const err = new Error(data?.error || `Erreur ${res.status}`); err.status = res.status; throw err; }
      return data;
    },
    confirmer: (data) => request("/api/inventaire/confirmer", { method: "POST", body: data }),
  },
  denominationsCartesCadeaux: {
    lister: (tous) => request(`/api/denominations-cartes-cadeaux${tous ? "?tous=1" : ""}`),
    creer: (montant) => request("/api/denominations-cartes-cadeaux", { method: "POST", body: { montant } }),
    activer: (id, actif) => request(`/api/denominations-cartes-cadeaux/${id}`, { method: "PUT", body: { actif } }),
    supprimer: (id) => request(`/api/denominations-cartes-cadeaux/${id}`, { method: "DELETE" }),
    stockerNumeros: (id, boutique, numeros) => request(`/api/denominations-cartes-cadeaux/${id}/stocker-numeros`, { method: "POST", body: { boutique, numeros } }),
    verifierCarte: (numero, boutique) => request(`/api/denominations-cartes-cadeaux/verifier/${encodeURIComponent(numero)}${boutique ? `?boutique=${encodeURIComponent(boutique)}` : ""}`),
    resume: () => request("/api/denominations-cartes-cadeaux/resume"),
  },
  receptions: {
    lister: (boutique) => request(`/api/receptions${boutique ? `?boutique=${encodeURIComponent(boutique)}` : ""}`),
    creer: (data) => request("/api/receptions", { method: "POST", body: data }),
  },
  bonsLivraison: {
    lister: ({ statut, boutique, dateDebut, dateFin } = {}) => {
      const qs = new URLSearchParams({ ...(statut ? { statut } : {}), ...(boutique ? { boutique } : {}), ...(dateDebut ? { dateDebut } : {}), ...(dateFin ? { dateFin } : {}) }).toString();
      return request(`/api/bons-livraison${qs ? `?${qs}` : ""}`);
    },
    get: (id) => request(`/api/bons-livraison/${id}`),
    creer: (data) => request("/api/bons-livraison", { method: "POST", body: data }),
    cloturer: (id, data) => request(`/api/bons-livraison/${id}/cloturer`, { method: "POST", body: data }),
    annuler: (id) => request(`/api/bons-livraison/${id}/annuler`, { method: "POST" }),
  },
  soldes: {
    listerArticles: ({ marqueId, famille } = {}) => {
      const qs = new URLSearchParams({ ...(marqueId ? { marqueId } : {}), ...(famille ? { famille } : {}) }).toString();
      return request(`/api/soldes/articles${qs ? `?${qs}` : ""}`);
    },
    lister: () => request("/api/soldes"),
    creer: (data) => request("/api/soldes", { method: "POST", body: data }),
    terminer: (id) => request(`/api/soldes/${id}/terminer`, { method: "POST" }),
  },
  clients: {
    list: () => request("/api/clients"),
    create: (data) => request("/api/clients", { method: "POST", body: data }),
    update: (id, data) => request(`/api/clients/${id}`, { method: "PUT", body: data }),
    remove: (id) => request(`/api/clients/${id}`, { method: "DELETE" }),
    rechercheParCarte: (carte) => request(`/api/clients/recherche?carte=${encodeURIComponent(carte)}`),
    rechercheMulti: (q) => request(`/api/clients/recherche-multi?q=${encodeURIComponent(q)}`),
    historiqueAchats: (id) => request(`/api/clients/${id}/historique-achats`),
  },
  ventes: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/ventes${qs ? `?${qs}` : ""}`);
    },
    create: (data) => request("/api/ventes", { method: "POST", body: data }),
    rechercheParNumero: (numero) => request(`/api/ventes/recherche/${encodeURIComponent(numero)}`),
creditListe: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/ventes/credit/liste${qs ? `?${qs}` : ""}`);
    },
    reglement: (id, data) => request(`/api/ventes/${id}/reglement`, { method: "POST", body: data }),
    annuler: (id, data) => request(`/api/ventes/${id}/annuler`, { method: "POST", body: data }),
  },
  ventesAttente: {
    list: (boutique) => request(`/api/ventes-attente${boutique ? `?boutique=${encodeURIComponent(boutique)}` : ""}`),
    create: (data) => request("/api/ventes-attente", { method: "POST", body: data }),
    remove: (id) => request(`/api/ventes-attente/${id}`, { method: "DELETE" }),
  },
  bonsValeur: {
    list: (type) => request(`/api/bons-valeur${type ? `?type=${encodeURIComponent(type)}` : ""}`),
    create: (data) => request("/api/bons-valeur", { method: "POST", body: data }),
    verifier: (numero) => request(`/api/bons-valeur/${encodeURIComponent(numero)}/verifier`),
    marquerHistorique: (id) => request(`/api/bons-valeur/${id}/marquer-historique`, { method: "PUT" }),
    remove: (id) => request(`/api/bons-valeur/${id}`, { method: "DELETE" }),
    echeancesProches: (jours) => request(`/api/bons-valeur/echeances-proches${jours ? `?jours=${jours}` : ""}`),
    marquerRappel: (id, effectue) => request(`/api/bons-valeur/${id}/rappel`, { method: "PUT", body: { effectue } }),
  },
 retours: {
    list: (boutique) => request(`/api/retours${boutique ? `?boutique=${encodeURIComponent(boutique)}` : ""}`),
    create: (data) => request("/api/retours", { method: "POST", body: data }),
  },
vendeurs: {
    list: (boutique) => request(`/api/vendeurs${boutique ? `?boutique=${encodeURIComponent(boutique)}` : ""}`),
    create: (data) => request("/api/vendeurs", { method: "POST", body: data }),
    update: (id, data) => request(`/api/vendeurs/${id}`, { method: "PATCH", body: data }),
  },
remises: {
    create: (data) => request("/api/remises", { method: "POST", body: data }),
    get: (id) => request(`/api/remises/${id}`),
    list: (statut) => request(`/api/remises${statut ? `?statut=${encodeURIComponent(statut)}` : ""}`),
    traiter: (id, statut) => request(`/api/remises/${id}`, { method: "PATCH", body: { statut } }),
  },
depenses: {
    categories: {
      list: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/api/depenses/categories${qs ? `?${qs}` : ""}`);
      },
      create: (nom) => request("/api/depenses/categories", { method: "POST", body: { nom } }),
      update: (id, data) => request(`/api/depenses/categories/${id}`, { method: "PUT", body: data }),
      remove: (id) => request(`/api/depenses/categories/${id}`, { method: "DELETE" }),
    },
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/depenses${qs ? `?${qs}` : ""}`);
    },
    create: (data) => request("/api/depenses", { method: "POST", body: data }),
    budget: {
      get: (annee, params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/api/depenses/budget/${annee}${qs ? `?${qs}` : ""}`);
      },
      set: (data) => request("/api/depenses/budget", { method: "POST", body: data }),
    },
  },

creancesHistoriques: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/creances-historiques${qs ? `?${qs}` : ""}`);
    },
    create: (data) => request("/api/creances-historiques", { method: "POST", body: data }),
    reglement: (id, data) => request(`/api/creances-historiques/${id}/reglement`, { method: "POST", body: data }),
  },

etats: {
    parDate: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/etats/par-date${qs ? `?${qs}` : ""}`);
    },
    parModePaiement: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/etats/par-mode-paiement${qs ? `?${qs}` : ""}`);
    },
    parType: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/etats/par-type${qs ? `?${qs}` : ""}`);
    },
    fermetureCaisse: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/etats/fermeture-caisse${qs ? `?${qs}` : ""}`);
},
    recapBoutiques: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/etats/recap-boutiques${qs ? `?${qs}` : ""}`);
    },
    parVendeur: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/etats/par-vendeur${qs ? `?${qs}` : ""}`);
    },
    parClient: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/etats/par-client${qs ? `?${qs}` : ""}`);
    },
    auditRemises: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/etats/audit-remises${qs ? `?${qs}` : ""}`);
    },
    livraisonJour: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/etats/livraison-jour${qs ? `?${qs}` : ""}`);
    },
    livraisons: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/etats/livraisons${qs ? `?${qs}` : ""}`);
    },
  },
};
