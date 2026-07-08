// Auth session: JWT lives in localStorage (via api/client), user in memory.
// initAuth() runs once on app mount to restore a session from a stored token.
import { api, setToken, getToken } from "@/api/client";

export const createAuthSlice = (set) => ({
  user: null,
  authLoading: false,
  authError: null,
  authReady: false, // true once the initial session restore attempt finished

  initAuth: async () => {
    if (!getToken()) {
      set({ authReady: true });
      return;
    }
    try {
      const user = await api.me();
      set({ user, authReady: true });
    } catch {
      setToken(null); // stale/expired token
      set({ user: null, authReady: true });
    }
  },

  login: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const { access_token } = await api.login(email, password);
      setToken(access_token);
      const user = await api.me();
      set({ user, authLoading: false });
      return true;
    } catch (err) {
      set({ authError: err.detail || err.message, authLoading: false });
      return false;
    }
  },

  register: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const { access_token } = await api.register(email, password);
      setToken(access_token);
      const user = await api.me();
      set({ user, authLoading: false });
      return true;
    } catch (err) {
      set({ authError: err.detail || err.message, authLoading: false });
      return false;
    }
  },

  logout: () => {
    setToken(null);
    set({ user: null });
  },
});
