import { Lock } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-base flex items-center justify-center px-6">
      <div className="text-center max-w-xs">
        <div className="w-12 h-12 rounded-xl bg-elevated border border-white/[0.06] flex items-center justify-center mx-auto mb-6">
          <Lock size={16} className="text-muted" />
        </div>
        <h1 className="font-display font-semibold text-xl text-ink mb-2.5">
          Sign in to track progress
        </h1>
        <p className="text-muted text-sm leading-relaxed mb-7">
          Your saved designs, challenge scores, and completed case studies will appear here.
        </p>
        <button
          type="button"
          className="text-sm font-medium text-ink px-6 py-2.5 rounded-lg border border-white/[0.08] hover:bg-elevated hover:border-indigo-500/30 transition-colors duration-150"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
