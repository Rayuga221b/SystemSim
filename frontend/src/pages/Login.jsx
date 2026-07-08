// Sign in / create account. One page, two modes — no separate register route.
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useStore } from "@/store";

export default function Login() {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const login = useStore((s) => s.login);
  const register = useStore((s) => s.register);
  const authLoading = useStore((s) => s.authLoading);
  const authError = useStore((s) => s.authError);
  const user = useStore((s) => s.user);

  const submit = async (e) => {
    e.preventDefault();
    const fn = mode === "login" ? login : register;
    const ok = await fn(email, password);
    if (ok) navigate(location.state?.from || "/dashboard");
  };

  if (user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-base px-6">
        <div className="text-center">
          <p className="text-muted text-sm mb-3">You're signed in as {user.email}.</p>
          <Link to="/dashboard" className="text-indigo-300 text-sm hover:text-indigo-200">Go to your dashboard →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-base px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="font-display font-semibold text-[1.75rem] text-ink text-center mb-2">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-muted text-sm text-center mb-8">
          {mode === "login"
            ? "Pick up your designs where you left off."
            : "Save designs, track challenge scores, build intuition."}
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="block">
            <span className="block text-[12px] text-muted mb-1.5">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13.5px] text-ink
                         placeholder:text-muted/50 outline-none focus:border-indigo-500/60"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="block text-[12px] text-muted mb-1.5">Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13.5px] text-ink
                         placeholder:text-muted/50 outline-none focus:border-indigo-500/60"
              placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
            />
          </label>

          {authError && <p className="text-[12.5px] text-red-400">{authError}</p>}

          <button
            type="submit"
            disabled={authLoading}
            className="btn-primary flex items-center justify-center gap-2 text-white text-[14px] font-medium rounded-lg px-4 py-2.5 mt-2 disabled:opacity-50"
          >
            {authLoading && <Loader2 size={14} className="animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="text-center text-[13px] text-muted mt-6">
          {mode === "login" ? "New to SystemSim?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-indigo-300 hover:text-indigo-200 font-medium"
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
