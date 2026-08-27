import { Link } from 'react-router-dom'
import { BANK_SUPPORT_EMAIL } from '@/lib/brand'
import { useAuthStore } from '@/store/authStore'

export default function AccountLockedBanner() {
  const isLocked = useAuthStore((s) => Boolean(s.user?.is_locked))
  if (!isLocked) return null

  return (
    <div
      className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <p className="font-semibold">Your account is locked</p>
      <p className="mt-1 leading-relaxed">
        You cannot make transfers, submit loan applications, or process loan payouts. Please contact{' '}
        <a className="font-semibold underline" href={`mailto:${BANK_SUPPORT_EMAIL}`}>
          {BANK_SUPPORT_EMAIL}
        </a>{' '}
        or open a <Link className="font-semibold underline" to="/support">support ticket</Link>.
      </p>
    </div>
  )
}
