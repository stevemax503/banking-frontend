import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'

export const ACCOUNT_LOCKED_MESSAGE =
  'Your account is locked. Please contact support for assistance.'

export function isAccountLocked(): boolean {
  const user = useAuthStore.getState().user
  return Boolean(user?.is_locked)
}

/** Returns false and toasts if the signed-in customer is locked. */
export function guardUnlockedAccount(): boolean {
  if (!isAccountLocked()) return true
  toast.error(ACCOUNT_LOCKED_MESSAGE)
  return false
}
