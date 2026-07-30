// Floating global AI assistant — mounted once in App.jsx, so it persists
// across route changes instead of remounting per page. Visible to everyone
// (DECISION 2026-07-30: gate at the point of input, not by hiding the whole
// feature — mirrors SaveDesignModal's pattern) — signed-out visitors see the
// panel and can read it, but sending a message shows a sign-in prompt instead
// of calling the API, since the backend persists/rate-limits per-user.
// Context-aware via the current route + sandbox store state:
//   /case-studies/:slug     → scoped to that case study (same RAG core as the
//                             inline mentor on the page, shared history thread)
//   /learn/roadmap/:slug    → scoped to that roadmap lesson, same idea
//   /sandbox                 → scoped to the current graph + last sim result
//   anything else            → general, platform-wide RAG, no document pin
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { X, Send, Loader2, Sparkles, Maximize2, Minimize2 } from "lucide-react";
import { api } from "@/api/client";
import { useStore } from "@/store";
import SourceChips from "@/components/ui/SourceChips";

function useContext_() {
  const location = useLocation();
  const graph = useStore((s) => s.serializeGraph);
  const simResult = useStore((s) => s.simResult);

  return useMemo(() => {
    const cs = location.pathname.match(/^\/case-studies\/([^/]+)/);
    if (cs) return { type: "case_study", slug: cs[1], label: "This case study" };
    const lesson = location.pathname.match(/^\/learn\/roadmap\/([^/]+)/);
    if (lesson) return { type: "roadmap", slug: lesson[1], label: "This lesson" };
    if (location.pathname.startsWith("/sandbox")) {
      return { type: "sandbox", label: "Your sandbox", graph: graph(), result: simResult };
    }
    return { type: "general", label: "SystemSim" };
  }, [location.pathname, graph, simResult]);
}

function Message({ m }) {
  const isUser = m.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[86%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-indigo-500/90 text-white"
            : "bg-surface border border-hairline/[0.08] text-ink/90"
        }`}
      >
        {m.content}
        {!isUser && <SourceChips sources={m.sources} />}
      </div>
    </div>
  );
}

export default function FloatingChat() {
  const user = useStore((s) => s.user);
  const authReady = useStore((s) => s.authReady);
  const ctx = useContext_();

  const open = useStore((s) => s.chatOpen);
  const setOpen = useStore((s) => s.setChatOpen);
  const [maximized, setMaximized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const scrollRef = useRef(null);

  // History is scoped per context so switching pages shows the relevant
  // thread instead of one undifferentiated log. No history to fetch for a
  // logged-out visitor — there's nothing persisted against no identity.
  useEffect(() => {
    if (!open || !user) return;
    setHistoryLoaded(false);
    api.chatHistory(ctx.type, ctx.slug)
      .then((res) => setMessages(res.messages))
      .catch(() => setMessages([]))
      .finally(() => setHistoryLoaded(true));
  }, [open, user, ctx.type, ctx.slug]);

  // A user switch (logout → null, or a different user logging in in the same
  // tab) must not leak the previous identity's thread into the new session —
  // clear local state so the next `open` refetches cleanly (or shows the
  // empty/signed-out state).
  useEffect(() => {
    setMessages([]);
    setHistoryLoaded(false);
    setNeedsSignIn(false);
  }, [user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  if (!authReady) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (!user) {
      setNeedsSignIn(true);
      return;
    }
    setInput("");
    setError(null);
    setNeedsSignIn(false);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await api.chatSend({
        message: text,
        context_type: ctx.type,
        context_slug: ctx.type === "case_study" || ctx.type === "roadmap" ? ctx.slug : undefined,
        graph: ctx.type === "sandbox" ? ctx.graph : undefined,
        result: ctx.type === "sandbox" ? ctx.result : undefined,
      });
      setMessages((m) => [...m, { role: "assistant", content: res.answer, sources: res.sources }]);
    } catch (e) {
      if (e.status === 429) setError("You've hit the chat limit for now — try again in a few minutes.");
      else if (e.status === 503) setError("The assistant isn't available right now. Try again shortly.");
      else setError(e.detail || e.message);
    } finally {
      setSending(false);
    }
  };

  const panel = (
    <div
      className={maximized
        ? "w-[min(760px,92vw)] h-[min(80vh,780px)] flex flex-col rounded-2xl border border-hairline/[0.1] bg-elevated shadow-2xl shadow-black/50 overflow-hidden"
        : "w-[360px] max-w-[calc(100vw-2.5rem)] h-[500px] max-h-[calc(100vh-8rem)] flex flex-col rounded-2xl border border-hairline/[0.1] bg-elevated shadow-2xl shadow-black/40 overflow-hidden"}
      role="dialog" aria-modal={maximized} aria-label="SystemSim AI assistant"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline/[0.07] bg-surface/60 shrink-0">
        <span className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
          <Sparkles size={13} className="text-indigo-300" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[13px] font-semibold text-ink leading-tight">SystemSim Assistant</p>
          <p className="font-mono text-[9.5px] text-muted/60 uppercase tracking-wider truncate">{ctx.label}</p>
        </div>
        <button
          type="button"
          onClick={() => setMaximized((v) => !v)}
          className="text-muted hover:text-ink p-1 -m-1"
          aria-label={maximized ? "Shrink chat" : "Enlarge chat"}
        >
          {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted hover:text-ink p-1 -m-1"
          aria-label="Close chat"
        >
          <X size={15} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3.5 flex flex-col gap-2.5">
        {!user && (
          <p className="text-[12.5px] text-muted/70 leading-relaxed text-center mt-6 px-2">
            Ask about {ctx.type === "general" ? "anything on SystemSim" : ctx.label.toLowerCase()} —
            I'll ground answers in the platform's own content where I can.
          </p>
        )}
        {user && !historyLoaded && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={16} className="animate-spin text-muted/50" aria-hidden />
          </div>
        )}
        {user && historyLoaded && messages.length === 0 && (
          <p className="text-[12.5px] text-muted/70 leading-relaxed text-center mt-6 px-2">
            Ask about {ctx.type === "general" ? "anything on SystemSim" : ctx.label.toLowerCase()} —
            I'll ground answers in the platform's own content where I can.
          </p>
        )}
        {messages.map((m, i) => <Message key={i} m={m} />)}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3.5 py-2.5 bg-surface border border-hairline/[0.08]">
              <Loader2 size={13} className="animate-spin text-muted" aria-hidden />
            </div>
          </div>
        )}
        {error && <p className="text-[11.5px] text-red-300/90 text-center px-2">{error}</p>}
      </div>

      {/* Input — or a sign-in prompt in place of it, once a send was attempted */}
      {needsSignIn ? (
        <div className="px-4 py-3.5 border-t border-hairline/[0.07] shrink-0">
          <p className="text-[12.5px] text-muted leading-relaxed mb-2.5">
            Sign in to chat with the assistant — your questions and answers are saved to your account.
          </p>
          <Link
            to="/login"
            onClick={() => setOpen(false)}
            className="btn-primary block text-center text-white text-[13px] font-medium rounded-lg px-4 py-2"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex items-end gap-2 px-3 py-3 border-t border-hairline/[0.07] shrink-0"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Ask a question…"
            rows={1}
            className="flex-1 resize-none bg-surface border border-hairline/[0.08] rounded-lg px-3 py-2 text-[12.5px] text-ink
                       placeholder:text-muted/50 outline-none focus:border-indigo-500/60 max-h-24"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="btn-primary shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-white disabled:opacity-40"
            aria-label="Send"
          >
            <Send size={14} />
          </button>
        </form>
      )}
    </div>
  );

  // Bottom-center only on /sandbox, where the default bottom-right spot
  // overlaps the results sidebar that pops up after simulating; everywhere
  // else stays bottom-right, just lifted a bit off the edge.
  const isSandbox = ctx.type === "sandbox";

  return (
    <div className={isSandbox
      ? "fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3"
      : "fixed bottom-8 right-5 z-40 flex flex-col items-end gap-3"}
    >
      {open && maximized && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setMaximized(false)}
        >
          {panel}
        </div>
      )}
      {open && !maximized && panel}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={open
          // Open: compact circular close control, stacked right above the panel.
          ? "w-12 h-12 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-colors shrink-0"
          // Closed: a round icon-only bubble on narrow screens (where the full
          // pill's text would overlap page content), widening into the inviting
          // "ask me something" pill from `sm` up — same glow either way.
          : "group flex items-center justify-center sm:justify-start gap-0 sm:gap-3 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5 w-14 h-14 sm:w-auto sm:h-auto p-0 sm:pl-4 sm:pr-5 sm:py-3 transition-all duration-200"
        }
        aria-label={open ? "Close AI assistant" : "Open AI assistant — ask a question about SystemSim"}
      >
        {open ? (
          <X size={18} />
        ) : (
          <>
            <span className="flex items-center justify-center w-9 h-9 sm:w-9 sm:h-9 rounded-full bg-white/15 shrink-0">
              <Sparkles size={17} className="group-hover:rotate-12 transition-transform duration-200" aria-hidden />
            </span>
            <span className="hidden sm:flex flex-col items-start leading-tight text-left">
              <span className="font-display text-[13.5px] font-semibold">Ask me anything</span>
              <span className="font-sans text-[11px] text-white/75">Curious about something? I've got answers</span>
            </span>
          </>
        )}
      </button>
    </div>
  );
}
