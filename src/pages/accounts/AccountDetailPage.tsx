import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { accountsApi } from '@/api/accounts'
import { transactionsApi } from '@/api/transactions'
import TransactionRow from '@/components/ui/TransactionRow'
import Spinner from '@/components/ui/Spinner'
import { formatDisplayCurrency } from '@/utils/format'
import { formatAccountTypeLabel } from '@/lib/accountDisplay'
import { formatAccountIdentifierDisplay, formatDomesticAccountNumber } from '@/lib/uaeAccount'

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: accountRes, isLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: () => accountsApi.detail(id!),
  })

  const { data: txRes } = useQuery({
    queryKey: ['transactions', id],
    queryFn: () => transactionsApi.list({ page_size: '10' }),
  })

  const account = accountRes?.data
  const transactions = txRes?.data?.results || txRes?.data || []

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (!account) return <p className="text-gray-400 text-center py-20">Account not found.</p>

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/accounts')} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">{formatAccountTypeLabel(account.account_type)} account</h1>
      </div>

      <div className="card bg-primary-dark text-white">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-white/60 text-sm">{formatAccountTypeLabel(account.account_type)}</p>
          {account.is_primary ? (
            <span className="rounded-full bg-accent/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
              Default account
            </span>
          ) : null}
        </div>
        <p className="text-4xl font-bold mt-1">{formatDisplayCurrency(account.balance)}</p>
        <p className="text-white/50 text-xs mt-1">Available: {formatDisplayCurrency(account.available_balance)}</p>
        <p className="text-white/40 font-mono text-sm mt-4 leading-relaxed">
          IBAN {account.iban ? formatAccountIdentifierDisplay(account) : formatDomesticAccountNumber(account.account_number)}
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-3">Recent Activity</h2>
        {transactions.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">No activity yet.</p>
        ) : (
          <div className="space-y-1 -mx-4">
            {transactions.slice(0, 10).map((tx: Parameters<typeof TransactionRow>[0]['transaction']) => (
              <TransactionRow key={tx.id} transaction={tx} accountId={id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
