import { useState } from "react";
import { KeyRound, UserCircle2, ShieldCheck, HelpCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

export default function LoginScreen() {
  const { login } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState("login"); // "login" | "demander-question" | "reinitialiser"
  const [resetLoginId, setResetLoginId] = useState("");
  const [question, setQuestion] = useState("");
  const [reponseSecrete, setReponseSecrete] = useState("");
  const [nouveauPin, setNouveauPin] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!loginId.trim() || !pin.trim()) { setError("Identifiant et PIN requis."); return; }
    setLoading(true);
    setError("");
    const ok = await login(loginId.trim(), pin.trim());
    setLoading(false);
    if (!ok) setError("Identifiant ou PIN incorrect.");
  };

  const demanderQuestion = async (e) => {
    e.preventDefault();
    if (!resetLoginId.trim()) { setResetError("Identifiant requis."); return; }
    setResetLoading(true);
    setResetError("");
    try {
      const res = await api.auth.questionSecrete(resetLoginId.trim());
      setQuestion(res.questionSecrete);
      setMode("reinitialiser");
    } catch (err) {
      setResetError(err.message || "Erreur lors de la récupération de la question.");
    } finally {
      setResetLoading(false);
    }
  };

  const reinitialiser = async (e) => {
    e.preventDefault();
    if (!reponseSecrete.trim() || !/^\d{4,6}$/.test(nouveauPin)) {
      setResetError("Réponse et nouveau PIN (4 à 6 chiffres) sont obligatoires.");
      return;
    }
    setResetLoading(true);
    setResetError("");
    try {
      await api.auth.reinitialiserPin({ login: resetLoginId.trim(), reponseSecrete: reponseSecrete.trim(), nouveauPin });
      setResetSuccess(true);
    } catch (err) {
      setResetError(err.message || "Erreur lors de la réinitialisation.");
    } finally {
      setResetLoading(false);
    }
  };

  const retourConnexion = () => {
    setMode("login");
    setResetLoginId(""); setQuestion(""); setReponseSecrete(""); setNouveauPin("");
    setResetError(""); setResetSuccess(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FAF7F2" }} className="flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl p-8" style={{ background: "#FFFDF9", border: "1px solid #EAE1D2" }}>
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: "#F1E9DC" }}>
            <ShieldCheck size={22} color="#8C3B2E" />
          </div>
          <p className="text-xs tracking-[0.2em] uppercase font-mono" style={{ color: "#8C3B2E" }}>Gestion Commerciale & CRM</p>
          <h1 className="font-display text-2xl font-semibold mt-1">
            {mode === "login" ? "Connexion" : "PIN oublié"}
          </h1>
        </div>

        {mode === "login" && (
          <form onSubmit={submit}>
            <label className="text-xs font-mono uppercase tracking-wide" style={{ color: "#8C3B2E" }}>Identifiant</label>
            <div className="flex items-center gap-2 mt-1 mb-4 px-3 py-2 rounded-lg" style={{ border: "1px solid #DDD3C4", background: "#FFFFFF" }}>
              <UserCircle2 size={16} color="#6B5D52" />
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="ex: djenie"
                className="flex-1 outline-none bg-transparent text-sm"
                autoFocus
              />
            </div>

            <label className="text-xs font-mono uppercase tracking-wide" style={{ color: "#8C3B2E" }}>Code PIN</label>
            <div className="flex items-center gap-2 mt-1 mb-2 px-3 py-2 rounded-lg" style={{ border: "1px solid #DDD3C4", background: "#FFFFFF" }}>
              <KeyRound size={16} color="#6B5D52" />
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                type="password"
                inputMode="numeric"
                maxLength={6}
                className="flex-1 outline-none bg-transparent text-sm tracking-widest"
              />
            </div>

            <button type="button" onClick={() => setMode("demander-question")} className="text-xs mb-4 flex items-center gap-1" style={{ color: "#8C3B2E" }}>
              <HelpCircle size={13} /> PIN oublié ?
            </button>

            {error && (
              <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: "#FBEAE7", color: "#8C3B2E", border: "1px solid #E3B6AD" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        )}

        {mode === "demander-question" && (
          <form onSubmit={demanderQuestion}>
            <p className="text-sm mb-4" style={{ color: "#6B5D52" }}>Entre ton identifiant pour récupérer ta question secrète.</p>
            <label className="text-xs font-mono uppercase tracking-wide" style={{ color: "#8C3B2E" }}>Identifiant</label>
            <div className="flex items-center gap-2 mt-1 mb-4 px-3 py-2 rounded-lg" style={{ border: "1px solid #DDD3C4", background: "#FFFFFF" }}>
              <UserCircle2 size={16} color="#6B5D52" />
              <input
                value={resetLoginId}
                onChange={(e) => setResetLoginId(e.target.value)}
                className="flex-1 outline-none bg-transparent text-sm"
                autoFocus
              />
            </div>

            {resetError && (
              <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: "#FBEAE7", color: "#8C3B2E", border: "1px solid #E3B6AD" }}>
                {resetError}
              </p>
            )}

            <button
              type="submit"
              disabled={resetLoading}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium mb-3"
              style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: resetLoading ? 0.7 : 1 }}
            >
              {resetLoading ? "Recherche…" : "Continuer"}
            </button>
            <button type="button" onClick={retourConnexion} className="w-full text-xs flex items-center justify-center gap-1" style={{ color: "#6B5D52" }}>
              <ArrowLeft size={13} /> Retour à la connexion
            </button>
          </form>
        )}

        {mode === "reinitialiser" && !resetSuccess && (
          <form onSubmit={reinitialiser}>
            <p className="text-sm mb-1 font-medium">{question}</p>
            <label className="text-xs font-mono uppercase tracking-wide" style={{ color: "#8C3B2E" }}>Ta réponse</label>
            <div className="flex items-center gap-2 mt-1 mb-4 px-3 py-2 rounded-lg" style={{ border: "1px solid #DDD3C4", background: "#FFFFFF" }}>
              <input
                value={reponseSecrete}
                onChange={(e) => setReponseSecrete(e.target.value)}
                className="flex-1 outline-none bg-transparent text-sm"
                autoFocus
              />
            </div>

            <label className="text-xs font-mono uppercase tracking-wide" style={{ color: "#8C3B2E" }}>Nouveau PIN (4 à 6 chiffres)</label>
            <div className="flex items-center gap-2 mt-1 mb-4 px-3 py-2 rounded-lg" style={{ border: "1px solid #DDD3C4", background: "#FFFFFF" }}>
              <KeyRound size={16} color="#6B5D52" />
              <input
                value={nouveauPin}
                onChange={(e) => setNouveauPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                type="password"
                inputMode="numeric"
                maxLength={6}
                className="flex-1 outline-none bg-transparent text-sm tracking-widest"
              />
            </div>

            {resetError && (
              <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: "#FBEAE7", color: "#8C3B2E", border: "1px solid #E3B6AD" }}>
                {resetError}
              </p>
            )}

            <button
              type="submit"
              disabled={resetLoading}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium mb-3"
              style={{ background: "#8C3B2E", color: "#FBF3EC", opacity: resetLoading ? 0.7 : 1 }}
            >
              {resetLoading ? "Enregistrement…" : "Réinitialiser mon PIN"}
            </button>
            <button type="button" onClick={retourConnexion} className="w-full text-xs flex items-center justify-center gap-1" style={{ color: "#6B5D52" }}>
              <ArrowLeft size={13} /> Retour à la connexion
            </button>
          </form>
        )}

        {mode === "reinitialiser" && resetSuccess && (
          <div>
            <p className="text-sm mb-5 px-3 py-3 rounded-lg" style={{ background: "#E9F0EA", color: "#3F6B4A" }}>
              PIN réinitialisé avec succès ! Tu peux maintenant te connecter avec ton nouveau PIN.
            </p>
            <button
              type="button"
              onClick={retourConnexion}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: "#8C3B2E", color: "#FBF3EC" }}
            >
              Retour à la connexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}