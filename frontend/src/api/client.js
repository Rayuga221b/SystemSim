// The ONLY place base URL / headers / error handling live.
// No fetch anywhere else in the frontend.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Resolve a server asset path (e.g. "/static/roadmap/diagrams/x.svg") to a full
// URL. Absolute URLs and data: URIs pass through untouched. Used by the Markdown
// renderer so lesson images served from the API load correctly from any page.
export function assetUrl(path) {
  if (!path) return path;
  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:")) return path;
  return `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

const TOKEN_KEY = "systemsim_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `Request failed (${status})`);
    this.status = status;
    this.detail = detail;
  }
}

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if ((auth || token) && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the SystemSim API. Is the backend running?");
  }

  if (!res.ok) {
    let detail;
    try {
      const data = await res.json();
      detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // ── simulation ────────────────────────────────────────────────────────────
  simulate: (graph, load_rps, { failures, workload } = {}) =>
    request("/simulate", { method: "POST", body: { graph, load_rps, failures, workload } }),

  // ── challenges ────────────────────────────────────────────────────────────
  listChallenges: () => request("/challenges"),
  getChallenge: (slug) => request(`/challenges/${slug}`),
  getChallengeSolution: (slug) => request(`/challenges/${slug}/solution`),
  attemptChallenge: (slug, graph_json) =>
    request(`/challenges/${slug}/attempt`, { method: "POST", body: { graph_json } }),
  listMyAttempts: (slug) => request(`/challenges/${slug}/attempts`, { auth: true }),
  myAttempts: () => request("/me/attempts", { auth: true }),

  // ── case studies ──────────────────────────────────────────────────────────
  listCaseStudies: () => request("/casestudies"),
  getCaseStudy: (slug) => request(`/casestudies/${slug}`),

  // ── roadmap (learn track) ─────────────────────────────────────────────────
  getRoadmap: () => request("/roadmap"),
  getRoadmapLesson: (slug) => request(`/roadmap/${slug}`),

  // ── auth ──────────────────────────────────────────────────────────────────
  register: (email, password) =>
    request("/auth/register", { method: "POST", body: { email, password } }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password } }),
  me: () => request("/auth/me", { auth: true }),

  // ── designs ───────────────────────────────────────────────────────────────
  listDesigns: () => request("/designs", { auth: true }),
  createDesign: (title, mode, graph_json) =>
    request("/designs", { method: "POST", body: { title, mode, graph_json }, auth: true }),
  getDesign: (id) => request(`/designs/${id}`, { auth: true }),
  updateDesign: (id, patch) =>
    request(`/designs/${id}`, { method: "PUT", body: patch, auth: true }),
  deleteDesign: (id) => request(`/designs/${id}`, { method: "DELETE", auth: true }),

  // ── ai ────────────────────────────────────────────────────────────────────
  // → { summary, bottlenecks: [{node_id, label, why, fix}], suggested_fixes }
  // Gemini runs server-side only — the frontend never holds an AI key.
  explain: (graph, result) =>
    request("/ai/explain", { method: "POST", body: { graph, result } }),
  // → { answer, grounded, provider, sources: [{tag, source_type, slug, title,
  //     heading, path, score}] } — sources come from RAG retrieval metadata
  // (server-side), filtered to only what the answer actually cited, so
  // citation chips always both link to real platform content AND back
  // something the answer said.
  mentor: (case_study_slug, question) =>
    request("/ai/mentor", { method: "POST", body: { case_study_slug, question } }),
  // Same contract as mentor(), scoped to a roadmap lesson instead of a case
  // study — mutually exclusive with case_study_slug on the backend.
  mentorRoadmap: (roadmap_slug, question) =>
    request("/ai/mentor", { method: "POST", body: { roadmap_slug, question } }),

  // ── floating global assistant (public — see FloatingChat.jsx; sending a
  // message requires login, gated client-side with a sign-in prompt) ────────
  // Same response shape as mentor(). context_type: "case_study" | "sandbox" |
  // "roadmap" | "general"; pass context_slug for case_study/roadmap, graph/
  // result for sandbox.
  chatSend: (payload) => request("/ai/chat", { method: "POST", body: payload, auth: true }),
  chatHistory: (context_type, context_slug) => {
    const params = new URLSearchParams();
    if (context_type) params.set("context_type", context_type);
    if (context_slug) params.set("context_slug", context_slug);
    const qs = params.toString();
    return request(`/ai/chat/history${qs ? `?${qs}` : ""}`, { auth: true });
  },
};
