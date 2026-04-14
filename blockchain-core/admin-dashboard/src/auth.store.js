import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null, accessToken: null, isAuthenticated: false,
      setAuth: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () => set({ user: null, accessToken: null, isAuthenticated: false }),
      isAdmin: () => ['ADMIN', 'SUPER_ADMIN'].includes(get().user?.role),
      isAuditor: () => get().user?.role === 'AUDITOR',
    }),
    { name: 'trustledger-auth', partialize: s => ({ user: s.user, accessToken: s.accessToken, isAuthenticated: s.isAuthenticated }) }
  )
)
