// The ONLY place base URL / headers / error handling live.
// No fetch anywhere else in the frontend.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return res.json();
}

export const api = {
  simulate: (graph, load_rps, failures) =>
    request("/simulate", { method: "POST", body: { graph, load_rps, failures } }),
  listChallenges: () => request("/challenges"),
  listCaseStudies: () => request("/casestudies"),
  getCaseStudy: (slug) => request(`/casestudies/${slug}`),
  explain: (graph, result) =>
    request("/ai/explain", { method: "POST", body: { graph, result } }),
  mentor: (case_study_slug, question) =>
    request("/ai/mentor", { method: "POST", body: { case_study_slug, question } }),
};
