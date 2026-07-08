// The ONLY place base URL / headers / error handling live.
// No fetch anywhere else in the frontend.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
  explain: (graph, result) =>
    request("/ai/explain", { method: "POST", body: { graph, result } }),
  mentor: (case_study_slug, question) =>
    request("/ai/mentor", { method: "POST", body: { case_study_slug, question } }),
};
