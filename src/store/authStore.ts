import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { queryClient } from '@/queryClient'

export interface User {
  id: string
  email: string
  full_name: string
  phone: string
  role: string
  kyc_status: string
  is_mfa_enabled: boolean
  is_locked?: boolean
  profile_picture: string | null
  requires_profile_setup?: boolean
  profile_setup_completed?: boolean
  intended_account_type?: string
  id_document_type?: string
  id_document_number?: string
}

export interface ImpersonationBackup {
  accessToken: string
  refreshToken: string
  user: User
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  impersonation: ImpersonationBackup | null
  /** False until persisted session is restored from localStorage. */
  _hasHydrated: boolean
  setTokens: (access: string, refresh: string) => void
  setUser: (user: User) => void
  startImpersonation: (
    backup: ImpersonationBackup,
    customerAccess: string,
    customerRefresh: string,
    customerUser: User,
  ) => void
  endImpersonation: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      impersonation: null,
      _hasHydrated: false,
      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true }),
      setUser: (user) => set({ user }),
      startImpersonation: (backup, customerAccess, customerRefresh, customerUser) => {
        queryClient.clear()
        set({
          impersonation: backup,
          accessToken: customerAccess,
          refreshToken: customerRefresh,
          user: customerUser,
          isAuthenticated: true,
        })
      },
      endImpersonation: () => {
        set((state) => {
          if (!state.impersonation) return state
          queryClient.clear()
          return {
            impersonation: null,
            accessToken: state.impersonation.accessToken,
            refreshToken: state.impersonation.refreshToken,
            user: state.impersonation.user,
            isAuthenticated: true,
          }
        })
      },
      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          impersonation: null,
        })
        queryClient.clear()
      },
    }),
    {
      name: 'banking-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        impersonation: state.impersonation,
      }),
    },
  ),
)

export function markAuthHydrated() {
  useAuthStore.setState({ _hasHydrated: true })
}

/** Session restored and access token available for API calls. */
export function useAuthReady(): boolean {
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const accessToken = useAuthStore((s) => s.accessToken)
  return hasHydrated && isAuthenticated && Boolean(accessToken)
}

export function useIsImpersonating(): boolean {
  return useAuthStore((s) => s.impersonation !== null)
}
