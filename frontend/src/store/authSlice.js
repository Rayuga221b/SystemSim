// Supabase auth session.
export const createAuthSlice = (set) => ({
  user: null,
  session: null,
  setSession: (session) => set({ session, user: session?.user ?? null }),
});
