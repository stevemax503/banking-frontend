import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Building2, CreditCard, Sparkles } from 'lucide-react'
import { accountsApi } from '@/api/accounts'
import CardWidget from '@/components/ui/CardWidget'
import PageShell from '@/components/layout/PageShell'
import Spinner from '@/components/ui/Spinner'
import { useAuthStore } from '@/store/authStore'
import { DISPLAY_CURRENCY_SYMBOL, formatDisplayCurrency } from '@/utils/format'
import { accountIdentifierLastFour, maskAccountIdentifier } from '@/lib/uaeAccount'
import { SettingsToggle } from '@/components/settings/SettingsControls'

export default function SettingsLinkedAccountsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(),
  })
  const accounts = data?.data?.results || data?.data || []
  const primary = accounts[0]

  return (
    <PageShell
      badge="Settings"
      title="Linked accounts"
      backTo="/settings"
      description={
        <div className="space-y-4">
          <nav className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <Link to="/settings" className="transition-colors hover:text-primary-dark">
              All settings
            </Link>
            <ChevronRight size={12} className="text-gray-300" aria-hidden />
            <span className="text-gray-700">Linked accounts</span>
          </nav>
          <p className="text-sm leading-relaxed text-gray-600">
            Accounts and cards connected to this profile. Open an account or manage cards below.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => navigate('/accounts')}
              className="btn-outline inline-flex items-center gap-2 py-2.5 text-sm"
            >
              <Plus size={16} strokeWidth={2} />
              Add account
            </button>
            <button
              type="button"
              onClick={() => navigate('/cards')}
              className="btn-primary inline-flex items-center gap-2 py-2.5 text-sm"
            >
              <CreditCard size={16} strokeWidth={2} />
              View cards
            </button>
          </div>
        </div>
      }
      contentClassName="!space-y-6"
    >
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : accounts.length === 0 ? (
        <div className="settings-panel">
          <div className="settings-panel-pad py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-primary-dark">
              <Building2 size={28} strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-sm font-medium text-gray-800">No accounts linked yet</p>
            <p className="mt-1 text-sm text-gray-500">Open an account to see it here.</p>
            <button type="button" onClick={() => navigate('/accounts')} className="btn-accent mx-auto mt-6 text-sm">
              Go to accounts
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {primary && (
            <section className="settings-panel">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/50 px-6 py-4 sm:px-7">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-accent" size={16} aria-hidden />
                  <h2 className="text-sm font-semibold tracking-tight text-gray-900">Primary card</h2>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                  Active
                </span>
              </div>
              <div className="settings-panel-pad">
                <div className="mx-auto max-w-md">
                  <div className="rounded-2xl p-1 ring-1 ring-gray-200/80 ring-offset-2 ring-offset-gray-50/50">
                    <CardWidget
                      accountNumber={maskAccountIdentifier(primary)}
                      cardHolder={user?.full_name || 'ACCOUNT HOLDER'}
                      accountType={primary.account_type}
                      balance={primary.balance}
                      currencySymbol={DISPLAY_CURRENCY_SYMBOL}
                    />
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Show on dashboard</p>
                    <p className="text-xs text-gray-500">Surface this balance on your home view</p>
                  </div>
                  <SettingsToggle checked onChange={() => {}} />
                </div>
              </div>
            </section>
          )}

          <section className="settings-panel">
            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4 sm:px-7">
              <h2 className="text-sm font-semibold tracking-tight text-gray-900">All accounts</h2>
              <p className="mt-0.5 text-xs text-gray-500">Tap a row for transactions and details</p>
            </div>
            <ul className="divide-y divide-gray-100">
              {accounts.map((a: { id: string; account_type: string; account_number: string; iban?: string | null; balance: string }) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/accounts/${a.id}`)}
                    className="group flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-gray-50/90 sm:px-7"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-primary-dark ring-1 ring-gray-200/80 transition-colors group-hover:bg-white">
                      <Building2 size={18} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">{a.account_type}</p>
                      <p className="font-mono text-xs text-gray-500">····{accountIdentifierLastFour(a)}</p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-gray-900">{formatDisplayCurrency(a.balance)}</p>
                    <ChevronRight size={18} className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-400" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </PageShell>
  )
}
