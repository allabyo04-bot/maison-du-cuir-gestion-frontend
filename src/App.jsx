import { ShoppingCart, Heart, Users as UsersIcon, Boxes, ShieldCheck, LogOut, BarChart3, LayoutDashboard, Wallet, Truck, ScrollText, Crown } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import UtilisateursSection from "./sections/UtilisateursSection.jsx";
import StockSection from "./sections/StockSection.jsx";
import ClientsSection from "./sections/ClientsSection.jsx";
import VentesSection from "./sections/VentesSection.jsx";
import RolesSection from "./sections/RolesSection.jsx";
import EtatsSection from "./sections/EtatsSection.jsx";
import DashboardSection from "./sections/DashboardSection.jsx";
import DepensesSection from "./sections/DepensesSection.jsx";
import LivraisonSection from "./sections/LivraisonSection.jsx";
import JournalAuditSection from "./sections/JournalAuditSection.jsx";
import FideliteSection from "./sections/FideliteSection.jsx";
import { useState, useEffect } from "react";
import logo from "./assets/logo.png";
import { api } from "./api.js";
import { LIVRAISON_ACTIF, FIDELITE_ACTIF } from "./constants.js";

function Shell() {
  const { user, loading, logout, permissions } = useAuth();
  const [tab, setTab] = useState("accueil");
  const [ventesSubTabDemande, setVentesSubTabDemande] = useState(null);
  const [nbRemisesEnAttente, setNbRemisesEnAttente] = useState(0);
  const estAdmin = !!user?.role?.systeme;
  useEffect(() => {
    if (!estAdmin) return;
    const rafraichir = async () => {
      try { setNbRemisesEnAttente((await api.remises.list("EN_ATTENTE")).length); } catch { /* ignore */ }
    };
    rafraichir();
    const interval = setInterval(rafraichir, 5000);
    return () => clearInterval(interval);
  }, [estAdmin]);
  if (loading) return <div style={{ minHeight: "100vh", background: "#FAF7F2" }} />;
  if (!user) return <LoginScreen />;
  // Interrupteur temporaire (voir constants.js) : le module Livraison est construit et prêt,
  // mais caché tant que Djenie n'a pas donné le feu vert.
  const NAV = [
    { id: "accueil", label: "Accueil", icon: LayoutDashboard },
    { id: "ventes", label: "Ventes", icon: ShoppingCart, perm: "ventes" },
    // Accessible avec la permission "ventes" (comme avant) OU juste "livraison" (nouveau rôle
    // Livreur, sans accès au reste de Ventes) — voir le filtre plus bas qui gère perm en tableau.
    ...(LIVRAISON_ACTIF ? [{ id: "livraison", label: "Livraison", icon: Truck, perm: ["ventes", "livraison"] }] : []),
    { id: "etats", label: "États", icon: BarChart3, perm: "ventes" },
    { id: "depenses", label: "Dépenses", icon: Wallet, perm: "ventes" },
    { id: "clients", label: "Clients", icon: Heart, perm: "clients" },
    // Chantier en cours, masqué tant que Djenie n'a pas donné le feu vert (voir constants.js).
    ...(estAdmin && FIDELITE_ACTIF ? [{ id: "fidelite", label: "Fidélité", icon: Crown }] : []),
    { id: "stock", label: "Stock", icon: Boxes, perm: "stock" },
    // Réservé à l'administrateur (Djenie) — pas une question de permission par rôle, comme côté
    // serveur qui vérifie directement role.systeme plutôt qu'une permission dédiée.
    ...(estAdmin ? [{ id: "journal-audit", label: "Journal d'audit", icon: ScrollText }] : []),
    // Écrans de configuration/sécurité — en fin de liste, pas de l'usage quotidien.
    { id: "utilisateurs", label: "Utilisateurs", icon: UsersIcon, perm: "utilisateurs" },
    { id: "roles", label: "Rôles", icon: ShieldCheck, perm: "utilisateurs" },
  ].filter((n) => !n.perm || (Array.isArray(n.perm) ? n.perm.some((p) => permissions[p]) : permissions[n.perm]));
  const activeTab = NAV.find((n) => n.id === tab) ? tab : NAV[0]?.id;
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#FAF7F2", minHeight: "100vh", color: "#2B2320", display: "flex" }}>
      <aside className="no-print w-16 md:w-60 shrink-0" style={{ borderRight: "1px solid #DDD3C4", background: "#FFFDF9", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div className="flex flex-col items-center md:items-start px-2 md:px-5 py-4 gap-1" style={{ borderBottom: "1px solid #DDD3C4" }}>
          <img src={logo} alt="La Maison du Cuir by Anaïs" className="h-8 md:h-16 w-auto" />
          <p className="hidden md:block text-[9px] tracking-[0.15em] uppercase font-mono" style={{ color: "#B8A88F" }}>Gestion Commerciale · by Phil</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 md:px-3 py-4 flex flex-col gap-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} title={label} className="relative flex items-center justify-center md:justify-start gap-2.5 px-2 md:px-3 py-2.5 rounded-lg text-sm font-medium text-left"
              style={activeTab === id ? { background: "#2B2320", color: "#FBF3EC" } : { background: "transparent", color: "#6B5D52" }}>
              <Icon size={18} className="shrink-0" /> <span className="truncate hidden md:inline">{label}</span>
              {id === "ventes" && estAdmin && nbRemisesEnAttente > 0 && (
                <span className="md:ml-auto absolute top-0.5 right-0.5 md:static flex items-center justify-center rounded-full text-[10px] font-bold animate-pulse shrink-0"
                  style={{ background: "#B04A3B", color: "#FBF3EC", minWidth: "18px", height: "18px", padding: "0 4px" }}
                  title={`${nbRemisesEnAttente} remise(s) en attente de validation`}>
                  {nbRemisesEnAttente}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="flex items-center justify-center md:justify-between gap-2 px-2 md:px-4 py-4" style={{ borderTop: "1px solid #DDD3C4" }}>
          <span className="text-sm truncate hidden md:inline" style={{ color: "#6B5D52" }}>{user.prenom} {user.nom}</span>
          <button onClick={logout} aria-label="Se déconnecter" title="Se déconnecter" style={{ color: "#8C3B2E" }}><LogOut size={18} /></button>
        </div>
      </aside>
      <div className="flex-1 min-w-0 px-6 sm:px-10 py-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {activeTab === "accueil" && (
            <DashboardSection onNaviguerVentes={(sousOnglet) => { setVentesSubTabDemande(sousOnglet); setTab("ventes"); }} onNaviguerFidelite={() => setTab("fidelite")} />
          )}
          {activeTab === "ventes" && (
            <VentesSection subTabInitial={ventesSubTabDemande} onSubTabInitialConsomme={() => setVentesSubTabDemande(null)} />
          )}
          {activeTab === "livraison" && <LivraisonSection />}
          {activeTab === "etats" && <EtatsSection />}
          {activeTab === "depenses" && <DepensesSection />}
          {activeTab === "clients" && <ClientsSection />}
          {activeTab === "utilisateurs" && <UtilisateursSection />}
          {activeTab === "stock" && <StockSection />}
          {activeTab === "roles" && <RolesSection />}
          {activeTab === "journal-audit" && <JournalAuditSection />}
          {activeTab === "fidelite" && <FideliteSection />}
          {!activeTab && <p className="text-sm" style={{ color: "#6B5D52" }}>Ton rôle ne donne accès à aucun module pour l'instant. Contacte un administrateur.</p>}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}