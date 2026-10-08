export const FAMILLES = ["Chaussure", "Sac", "Article d'entretien"];
// Anaïs n'a pas de boutique physique pour l'instant (vente en ligne/sur commande) —
// une seule entrée ici ; à adapter si un point de vente physique ouvre plus tard.
export const BOUTIQUES = ["Boutique Principale"];

export const INFOS_BOUTIQUE = {
  "Boutique Principale": {
    nom: "LA MAISON DU CUIR BY ANAÏS",
    ligne2: "ÉLÉGANCE - QUALITÉ - CONFORT",
    adresse: "[Adresse à compléter]",
    telephone: "[Téléphone à compléter]",
  },
};

export const MESSAGE_FIN_TICKET = "Aucun remboursement n'est effectué après achat. Les articles ne sont ni échangés, ni retournés au-delà de dix (10) jours. Passé ce délai, aucune réclamation ne sera acceptée.\n\nMerci pour votre visite";

export const POINTURES = ["35", "36", "36.5", "37", "37.5", "38", "38.5", "39", "39.5", "40", "40.5", "41", "41.5", "42", "42.5", "43", "43.5", "44", "44.5", "45", "45.5", "46", "46.5", "47", "47.5", "48"];
export const MODES_VENTE = ["Boutique", "Expédition"];
export const MODES_PAIEMENT = [
  { id: "especes", label: "Espèces", liquide: true },
  { id: "moov_money", label: "Moov Money", liquide: false },
  { id: "mtn_money", label: "MTN Money", liquide: false },
  { id: "orange_money", label: "Orange Money", liquide: false },
  { id: "wave", label: "Wave", liquide: false },
  { id: "carte", label: "Carte bancaire", liquide: false },
  { id: "bon_achat", label: "Carte cadeau", liquide: false },
{ id: "avoir", label: "Avoir", liquide: false },
];
export const CIVILITES = ["Monsieur", "Madame", "Mademoiselle"];
export const JOURS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
export const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
export const COMMUNES = ["Abobo", "Adjamé", "Anyama", "Attécoubé", "Bingerville", "Cocody", "Koumassi", "Marcory", "Plateau", "Port-Bouët", "Songon", "Treichville", "Yopougon"];
export const CLIENT_POINTURES = POINTURES;
export const PAYS_LIST = ["Côte d'Ivoire", "France", "Mali", "Burkina Faso", "Sénégal", "Bénin", "Togo", "Ghana", "Nigeria", "Autre"];

// Indicatif téléphonique par pays, et si le zéro de tête d'un numéro local doit être conservé
// en format international (confirmé pour la Côte d'Ivoire uniquement — vérifié via un vrai reçu
// local : "+225 07 15 49 81 87"). Pour les autres pays, on applique la convention la plus
// courante (zéro retiré) par défaut, à vérifier au cas par cas si besoin.
export const PAYS_INDICATIF = {
  "Côte d'Ivoire": { code: "225", garderZero: true },
  "France": { code: "33", garderZero: false },
  "Mali": { code: "223", garderZero: false },
  "Burkina Faso": { code: "226", garderZero: false },
  "Sénégal": { code: "221", garderZero: false },
  "Bénin": { code: "229", garderZero: false },
  "Togo": { code: "228", garderZero: false },
  "Ghana": { code: "233", garderZero: false },
  "Nigeria": { code: "234", garderZero: false },
  // "Autre" volontairement absent : indicatif inconnu, on ne devine pas.
};

export const QUARTIERS_PAR_COMMUNE = {
  "Abobo": ["Abobo Gare", "Anonkoua-Kouté", "Avocatier", "Baoulé", "Belleville", "Derrière-Rail", "Dokui", "Kennedy", "N'Dotré", "Sagbé", "Sogefiha"],
  "Adjamé": ["220 Logements", "Bracodi", "Liberté", "Marché Gouro", "Mirador", "Williamsville"],
  "Anyama": ["Akoupé-Zeudji", "Centre-ville", "Ebimpé", "Mafessé", "Nouveau Quartier"],
  "Attécoubé": ["Abattoir", "Agban", "Locodjro", "Santé", "Sébroko", "Toit Rouge"],
  "Bingerville": ["Adjinkro", "Centre-ville", "Feh-Kessé", "Résidentiel", "Santé 2"],
  "Cocody": ["II Plateaux", "Angré", "Ambassades", "Attoban", "Blockhauss", "Cité des Arts", "Danga", "Deux Plateaux Vallon", "M'Badon", "Mermoz", "Riviera"],
  "Koumassi": ["Campement", "Divo Quartier", "Grand Marché", "Prodomo", "Remblais", "Sicogi", "Zone Industrielle"],
  "Marcory": ["Aliodan", "Anoumabo", "Biétry", "Résidentiel", "Zone 4"],
  "Plateau": ["Cité Administrative", "Indénié", "Résidentiel", "Sorbonne", "Vallon"],
  "Port-Bouët": ["Adjouffou", "Aéroport", "Gonzagueville", "Jean Folly", "Vridi"],
  "Songon": ["Songon Agban", "Songon Kassemblé", "Songon Té"],
  "Treichville": ["Arras", "Avenue 16", "Belleville", "Biafra", "Zone 3"],
  "Yopougon": ["Andokoi", "Gesco", "Koweit", "Maroc", "Niangon", "Sicogi", "Sideci", "Toits Rouges", "Wassakara"],
};

export function fmt(n) {
  return Number(n || 0).toLocaleString("fr-FR");
}

// Interrupteur temporaire : le module Livraison (bons de livraison, sortie provisoire de stock)
// est construit et prêt, mais caché tant que Djenie n'a pas donné le feu vert (le temps de bien
// expliquer aux caissières) — repasser à true dès qu'elle donne l'accord. Contrôle à la fois
// l'onglet dans la navigation (App.jsx) et l'encart correspondant sur le tableau de bord.
export const LIVRAISON_ACTIF = true;
// Interrupteur temporaire (voir App.jsx) : le programme de fidélité "Cendrillon" vient du code de
// La Pointure (seuils en FCFA et nom propres à Djenie) — masqué tant qu'Anaïs n'a pas décidé si
// elle veut un programme de fidélité, et avec quels paliers/nom.
export const FIDELITE_ACTIF = false;