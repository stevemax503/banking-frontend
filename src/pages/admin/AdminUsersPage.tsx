import { useState, useEffect, type ReactNode } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Users,
  Search,
  Lock,
  Unlock,
  KeyRound,
  ExternalLink,
  Check,
  X,
  Shield,
  Filter,
  Pencil,
  Trash2,
  UserPlus,
  LayoutDashboard,
  ChevronDown,
} from 'lucide-react'
import { adminApi } from '@/api/admin'
import AdminInlineSelect from '@/components/admin/AdminInlineSelect'
import Spinner from '@/components/ui/Spinner'
import { useAuthStore, type User } from '@/store/authStore'
import { AdminMobileCard } from '@/components/admin/AdminResponsiveList'
import { selectShell } from '@/components/forms/StyledSelect'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/format'

type AssignedCustomer = {
  id: string
  full_name: string
  email: string
  account_count: number
}

type AdminUserRow = {
  id: string
  full_name: string
  email: string
  role: string
  kyc_status: string
  is_active: boolean
  is_locked: boolean
  date_joined: string
  admin_account_scope?: string
  phone?: string
}

type CustomerPickerRow = {
  id: string
  full_name: string
  email: string
}

const STAFF_ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
] as const

const SCOPE_OPTIONS = [
  { value: 'ALL', label: 'All customers' },
  { value: 'SELECTED', label: 'Selected customers only' },
] as const

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'ADMIN', label: 'Admins' },
  { value: 'SUPER_ADMIN', label: 'Super Admins' },
] as const

function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function formatRoleLabel(role: string) {
  if (role === 'SUPER_ADMIN') return 'Super Admin'
  if (role === 'ADMIN') return 'Admin'
  if (role === 'CUSTOMER') return 'Customer'
  return role
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
}

function roleBadgeClass(role: string) {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'bg-primary-dark/10 text-primary-dark ring-primary-dark/15'
    case 'ADMIN':
      return 'bg-sky-50 text-sky-800 ring-sky-100'
    case 'CUSTOMER':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
    default:
      return 'bg-gray-50 text-gray-700 ring-gray-100'
  }
}

function kycBadgeClass(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
    case 'REJECTED':
      return 'bg-red-50 text-red-800 ring-red-100'
    case 'SUBMITTED':
      return 'bg-blue-50 text-blue-800 ring-blue-100'
    case 'PENDING':
      return 'bg-amber-50 text-amber-900 ring-amber-100'
    default:
      return 'bg-gray-50 text-gray-600 ring-gray-100'
  }
}

function StatusPill({ user }: { user: AdminUserRow }) {
  const locked = user.is_locked
  const active = user.is_active && !locked

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
        locked
          ? 'bg-red-50 text-red-800 ring-red-100'
          : active
            ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
            : 'bg-gray-100 text-gray-600 ring-gray-200',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          locked ? 'bg-red-500' : active ? 'bg-emerald-500' : 'bg-gray-400',
        )}
        aria-hidden
      />
      {locked ? 'Locked' : active ? 'Active' : 'Inactive'}
    </span>
  )
}

function apiDetail(err: unknown) {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
}

function AdminModal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon: typeof Users
  children: ReactNode
  footer: ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="admin-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[min(92dvh,90vh)] w-full max-w-[min(100%,32rem)] flex-col overflow-hidden rounded-t-2xl border border-gray-200/90 bg-white shadow-[0_24px_48px_-12px_rgba(21,42,30,0.2)] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/90 via-white to-white px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-dark text-accent shadow-sm ring-4 ring-primary-dark/10">
              <Icon size={18} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              {subtitle ? <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition hover:bg-gray-50"
            aria-label="Close"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-4 sm:flex-row sm:px-5">{footer}</div>
      </div>
    </div>
  )
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
      {children}
      {required ? <span className="text-red-600"> *</span> : null}
    </label>
  )
}

function CustomerAssignmentPicker({
  selectedIds,
  onChange,
  customerSearch,
  onSearchChange,
  customers,
  loading,
}: {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  customerSearch: string
  onSearchChange: (v: string) => void
  customers: CustomerPickerRow[]
  loading: boolean
}) {
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  return (
    <div className="space-y-2">
      <FieldLabel>Assigned customers</FieldLabel>
      <input
        type="search"
        className="input-field w-full text-sm"
        placeholder="Search customer name or email…"
        value={customerSearch}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/50">
        {loading ? (
          <p className="px-3 py-4 text-center text-xs text-gray-500">Loading customers…</p>
        ) : customers.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-gray-500">No customers found.</p>
        ) : (
          customers.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 last:border-0 hover:bg-white"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="rounded border-gray-300 text-primary-dark focus:ring-primary-dark"
              />
              <span className="min-w-0 flex-1 text-xs">
                <span className="font-semibold text-gray-800">{c.full_name}</span>
                <span className="text-gray-500"> · {c.email}</span>
              </span>
            </label>
          ))
        )}
      </div>
      <p className="text-[11px] text-gray-500">
        {selectedIds.length} customer(s) selected — admin sees all accounts for each customer.
      </p>
    </div>
  )
}

function MobileActionButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  variant = 'default',
  className,
}: {
  label: string
  icon: typeof Pencil
  onClick?: () => void
  disabled?: boolean
  variant?: 'default' | 'primary' | 'danger' | 'success' | 'warning'
  className?: string
}) {
  const variants = {
    default: 'border-gray-200/90 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
    primary: 'border-primary-dark/20 bg-primary-dark/[0.06] text-primary-dark hover:bg-primary-dark/10',
    danger: 'border-red-200/90 bg-red-50/80 text-red-700 hover:bg-red-100',
    success: 'border-emerald-200/90 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100',
    warning: 'border-amber-200/90 bg-amber-50/80 text-amber-900 hover:bg-amber-100',
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
    >
      <Icon size={14} strokeWidth={2} aria-hidden />
      {label}
    </button>
  )
}

function IconAction({
  label,
  onClick,
  className,
  children,
  disabled,
}: {
  label: string
  onClick?: () => void
  className?: string
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition',
        'hover:border-primary-dark/20 hover:bg-gray-50 hover:text-primary-dark',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-dark',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  )
}

const emptyStaffForm = () => ({
  email: '',
  full_name: '',
  phone: '',
  password: '',
  password_confirm: '',
  role: 'ADMIN',
  admin_account_scope: 'SELECTED' as 'ALL' | 'SELECTED',
  assigned_customer_ids: [] as string[],
})

export default function AdminUsersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState(() => searchParams.get('role') || '')
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null)
  const [deleteUser, setDeleteUser] = useState<AdminUserRow | null>(null)
  const [staffForm, setStaffForm] = useState(emptyStaffForm)
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: '',
    admin_account_scope: 'ALL' as 'ALL' | 'SELECTED',
    assigned_customer_ids: [] as string[],
    is_active: true,
  })
  const [customerSearch, setCustomerSearch] = useState('')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const currentUser = useAuthStore((s) => s.user)
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  useEffect(() => {
    setRoleFilter(searchParams.get('role') || '')
  }, [searchParams])

  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, roleFilter],
    queryFn: () => adminApi.users({ search, ...(roleFilter ? { role: roleFilter } : {}) }),
  })

  const users = (data?.data?.results || data?.data || []) as AdminUserRow[]

  const lockMutation = useMutation({
    mutationFn: (id: string) => adminApi.toggleUserLock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User status updated.')
    },
  })

  const kycMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      adminApi.approveKYC(id, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('KYC decision saved.')
    },
  })

  const impersonateMutation = useMutation({
    mutationFn: (id: string) => adminApi.impersonateCustomer(id),
    onSuccess: (res) => {
      const { access, refresh, user } = res.data
      const state = useAuthStore.getState()
      if (!state.accessToken || !state.refreshToken || !state.user) {
        toast.error('Admin session missing. Sign in again.')
        return
      }
      useAuthStore.getState().startImpersonation(
        { accessToken: state.accessToken, refreshToken: state.refreshToken, user: state.user },
        access,
        refresh,
        user as unknown as User,
      )
      toast.success(`Viewing as ${(user as unknown as User).full_name}`)
      navigate('/dashboard')
    },
    onError: (err: unknown) => toast.error(apiDetail(err) || 'Could not open customer dashboard.'),
  })

  const otpMutation = useMutation({
    mutationFn: ({ id, send_email }: { id: string; send_email: boolean }) => adminApi.issueLoginOtp(id, send_email),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-email-otps'] })
      const otp = (res.data as { otp?: string })?.otp
      toast.success(otp ? `OTP issued: ${otp}` : 'OTP issued and emailed.')
    },
    onError: (err: unknown) => toast.error(apiDetail(err) || 'Could not issue OTP.'),
  })

  const createMutation = useMutation({
    mutationFn: () => adminApi.createStaffUser(staffForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setCreateOpen(false)
      setStaffForm(emptyStaffForm())
      toast.success('Admin user created.')
    },
    onError: (err: unknown) => toast.error(apiDetail(err) || 'Could not create admin user.'),
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editUser) throw new Error('No user')
      const payload: Record<string, unknown> = {
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone,
        is_active: editForm.is_active,
      }
      if (editUser.role !== 'CUSTOMER' && isSuperAdmin) {
        payload.admin_account_scope = editForm.admin_account_scope
        payload.assigned_customer_ids = editForm.assigned_customer_ids
        if (editForm.role) payload.role = editForm.role
      }
      return adminApi.updateUser(editUser.id, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditUser(null)
      toast.success('User updated.')
    },
    onError: (err: unknown) => toast.error(apiDetail(err) || 'Could not update user.'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!deleteUser) throw new Error('No user')
      return adminApi.deleteUser(deleteUser.id)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setDeleteUser(null)
      const detail = (res.data as { detail?: string })?.detail
      toast.success(detail || 'User and linked data removed.')
    },
    onError: (err: unknown) => toast.error(apiDetail(err) || 'Could not delete user.'),
  })

  const { data: editDetail } = useQuery({
    queryKey: ['admin-user-detail', editUser?.id],
    queryFn: () => adminApi.userDetail(editUser!.id),
    enabled: !!editUser,
  })

  useEffect(() => {
    if (!editUser || !editDetail?.data) return
    const d = editDetail.data as AdminUserRow & { assigned_customers?: AssignedCustomer[]; phone?: string }
    setEditForm({
      full_name: d.full_name,
      email: d.email,
      phone: d.phone || '',
      role: d.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : d.role === 'CUSTOMER' ? d.role : 'ADMIN',
      admin_account_scope: (d.admin_account_scope as 'ALL' | 'SELECTED') || 'ALL',
      assigned_customer_ids: (d.assigned_customers || []).map((c) => c.id),
      is_active: d.is_active,
    })
  }, [editUser, editDetail])

  const pickerOpen = createOpen || (!!editUser && editUser.role !== 'CUSTOMER')
  const pickerScope =
    (createOpen && staffForm.role === 'ADMIN' && staffForm.admin_account_scope === 'SELECTED') ||
    (!!editUser && editUser.role !== 'CUSTOMER' && editForm.role === 'ADMIN' && editForm.admin_account_scope === 'SELECTED')

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['admin-customers-picker', customerSearch],
    queryFn: () => adminApi.users({ role: 'CUSTOMER', search: customerSearch }),
    enabled: pickerOpen && pickerScope && isSuperAdmin,
  })

  const pickerCustomers = ((customersData?.data?.results || customersData?.data || []) as CustomerPickerRow[]).map(
    (c) => ({
      id: c.id,
      full_name: c.full_name,
      email: c.email,
    }),
  )

  const openEdit = (u: AdminUserRow) => {
    setCustomerSearch('')
    setEditUser(u)
  }

  const busy =
    lockMutation.isPending ||
    kycMutation.isPending ||
    otpMutation.isPending ||
    impersonateMutation.isPending ||
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending

  const isStaffUser = (role: string) => role !== 'CUSTOMER'

  const activeFilterCount = [roleFilter, search.trim()].filter(Boolean).length

  const setRoleFilterAndUrl = (v: string) => {
    setRoleFilter(v)
    const next = new URLSearchParams(searchParams)
    if (v) next.set('role', v)
    else next.delete('role')
    setSearchParams(next, { replace: true })
  }

  const filterFields = (
    <>
      <div className={cn(selectShell, 'relative min-w-0 flex-1 sm:w-56')}>
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
        <input
          type="search"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl bg-transparent py-2.5 pl-10 pr-3 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
      </div>
      <AdminInlineSelect
        label="Role"
        className="w-full sm:w-[11rem]"
        value={roleFilter}
        options={ROLE_OPTIONS}
        onChange={(e) => setRoleFilterAndUrl(e.target.value)}
      />
    </>
  )

  const renderMobileUserActions = (u: AdminUserRow) => (
    <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
      {u.kyc_status === 'SUBMITTED' && (
        <div className="mb-1 flex gap-2">
          <MobileActionButton
            label="Approve KYC"
            icon={Check}
            variant="success"
            disabled={busy}
            className="flex-1"
            onClick={() => kycMutation.mutate({ id: u.id, decision: 'APPROVED' })}
          />
          <MobileActionButton
            label="Reject KYC"
            icon={X}
            variant="danger"
            disabled={busy}
            className="flex-1"
            onClick={() => kycMutation.mutate({ id: u.id, decision: 'REJECTED' })}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {isSuperAdmin && (
          <>
            <MobileActionButton label="Edit" icon={Pencil} disabled={busy} onClick={() => openEdit(u)} />
            <MobileActionButton
              label="Delete"
              icon={Trash2}
              variant="danger"
              disabled={busy || u.id === currentUser?.id}
              onClick={() => setDeleteUser(u)}
            />
          </>
        )}
        {u.role === 'CUSTOMER' && (
          <MobileActionButton
            label="Dashboard"
            icon={LayoutDashboard}
            variant="primary"
            disabled={busy || u.is_locked || !u.is_active}
            className={isSuperAdmin ? undefined : 'col-span-2'}
            onClick={() => impersonateMutation.mutate(u.id)}
          />
        )}
        <MobileActionButton
          label={u.is_locked ? 'Unlock' : 'Lock'}
          icon={u.is_locked ? Unlock : Lock}
          variant={u.is_locked ? 'success' : 'warning'}
          disabled={busy}
          onClick={() => lockMutation.mutate(u.id)}
        />
        <MobileActionButton
          label="Send OTP"
          icon={KeyRound}
          variant="warning"
          disabled={busy}
          onClick={() => {
            const send = window.confirm(
              'Send OTP to user email as well?\nOK = email + show here\nCancel = desk code only (no email)',
            )
            otpMutation.mutate({ id: u.id, send_email: send })
          }}
        />
        <Link
          to={`/admin/email-otps?user=${encodeURIComponent(u.email)}`}
          className="col-span-2 inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border border-gray-200/90 bg-white px-2.5 py-2 text-[11px] font-semibold text-gray-700 shadow-sm transition hover:border-primary-dark/20 hover:bg-gray-50 hover:text-primary-dark"
        >
          <ExternalLink size={14} aria-hidden />
          View verification codes
        </Link>
      </div>
    </div>
  )

  return (
    <div className="admin-page space-y-6 pb-8">
      <section className="flex flex-col gap-3 rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-dark text-accent shadow-sm ring-4 ring-primary-dark/10">
            <Users size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">User management</h1>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {!isLoading && (
            <p className="text-xs font-semibold tabular-nums text-gray-500 sm:order-last">
              {users.length} {users.length === 1 ? 'user' : 'users'}
            </p>
          )}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                setStaffForm(emptyStaffForm())
                setCustomerSearch('')
                setCreateOpen(true)
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-dark px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark/90 sm:w-auto"
            >
              <UserPlus size={15} aria-hidden />
              Add admin user
            </button>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-10px_rgba(21,42,30,0.1)]">
        <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/90 via-white to-white">
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((o) => !o)}
              className={cn(
                selectShell,
                'mx-4 mt-4 flex w-[calc(100%-2rem)] items-center justify-between gap-2 px-3.5 py-2.5 text-left',
              )}
              aria-expanded={mobileFiltersOpen}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Filter size={15} className="text-primary-dark" aria-hidden />
                Search &amp; filter
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-primary-dark px-2 py-0.5 text-[10px] font-bold text-accent">
                    {activeFilterCount}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                size={18}
                className={cn('shrink-0 text-gray-500 transition-transform', mobileFiltersOpen && 'rotate-180')}
                aria-hidden
              />
            </button>
            {mobileFiltersOpen ? (
              <div className="flex flex-col gap-2.5 px-4 pb-4 pt-3">{filterFields}</div>
            ) : null}
          </div>

          <div className="hidden flex-wrap items-center justify-between gap-3 px-6 py-4 md:flex">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-primary-dark">
              <Filter size={14} aria-hidden />
              Directory
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">{filterFields}</div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : users.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Shield size={32} className="mx-auto text-gray-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-gray-700">No users match your filters</p>
            <p className="mt-1 text-xs text-gray-500">Try a different role or search term.</p>
          </div>
        ) : (
          <>
            <ul className="space-y-3 p-3 md:hidden sm:p-4">
              {users.map((u) => (
                <AdminMobileCard
                  key={u.id}
                  className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-0 shadow-[0_2px_16px_-6px_rgba(21,42,30,0.1)]"
                >
                  <div className="h-1 bg-gradient-to-r from-primary-dark via-primary-dark/80 to-accent/80" aria-hidden />
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-dark text-sm font-bold text-accent shadow-sm"
                        aria-hidden
                      >
                        {userInitials(u.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900">{u.full_name}</p>
                            <p className="truncate text-xs text-gray-500">{u.email}</p>
                          </div>
                          <StatusPill user={u} />
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                              roleBadgeClass(u.role),
                            )}
                          >
                            {formatRoleLabel(u.role)}
                          </span>
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                              kycBadgeClass(u.kyc_status),
                            )}
                          >
                            KYC {u.kyc_status.toLowerCase()}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-gray-400">Joined {formatDate(u.date_joined)}</p>
                      </div>
                    </div>
                    {renderMobileUserActions(u)}
                  </div>
                </AdminMobileCard>
              ))}
            </ul>

            <div className="admin-table-scroll hidden md:block">
          <table className="admin-data-table min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-200/80 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2.5 sm:px-6">User</th>
                <th className="px-3 py-2.5">Role</th>
                <th className="px-3 py-2.5">KYC</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Joined</th>
                <th className="px-4 py-2.5 text-right sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u, i) => (
                  <tr
                    key={u.id}
                    className={cn('transition-colors hover:bg-emerald-50/30', i % 2 === 1 && 'bg-gray-50/40')}
                  >
                    <td className="px-4 py-3.5 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-dark/[0.08] text-xs font-bold text-primary-dark ring-1 ring-primary-dark/10"
                          aria-hidden
                        >
                          {userInitials(u.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900" title={u.full_name}>
                            {u.full_name}
                          </p>
                          <p className="truncate text-xs text-gray-500" title={u.email}>
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                          roleBadgeClass(u.role),
                        )}
                      >
                        {formatRoleLabel(u.role)}
                      </span>
                      {u.role !== 'CUSTOMER' && u.admin_account_scope === 'SELECTED' && (
                        <span className="mt-1 block text-[10px] font-medium text-gray-500">Selected customers</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                            kycBadgeClass(u.kyc_status),
                          )}
                        >
                          {u.kyc_status}
                        </span>
                        {u.kyc_status === 'SUBMITTED' && (
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              title="Approve KYC"
                              disabled={busy}
                              onClick={() => kycMutation.mutate({ id: u.id, decision: 'APPROVED' })}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition hover:bg-emerald-100 disabled:opacity-50"
                            >
                              <Check size={14} aria-hidden />
                            </button>
                            <button
                              type="button"
                              title="Reject KYC"
                              disabled={busy}
                              onClick={() => kycMutation.mutate({ id: u.id, decision: 'REJECTED' })}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-50 text-red-700 ring-1 ring-red-100 transition hover:bg-red-100 disabled:opacity-50"
                            >
                              <X size={14} aria-hidden />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusPill user={u} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-xs tabular-nums text-gray-500">
                      {formatDate(u.date_joined)}
                    </td>
                    <td className="px-4 py-3.5 sm:px-6">
                      <div className="flex items-center justify-end gap-1">
                        {isSuperAdmin && (
                          <>
                            <IconAction
                              label="Edit user"
                              disabled={busy}
                              onClick={() => openEdit(u)}
                            >
                              <Pencil size={15} aria-hidden />
                            </IconAction>
                            <IconAction
                              label="Delete user"
                              disabled={busy || u.id === currentUser?.id}
                              onClick={() => setDeleteUser(u)}
                              className="hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={15} aria-hidden />
                            </IconAction>
                          </>
                        )}
                        {u.role === 'CUSTOMER' && (
                          <IconAction
                            label="View customer dashboard"
                            disabled={busy || u.is_locked || !u.is_active}
                            onClick={() => impersonateMutation.mutate(u.id)}
                            className="hover:border-primary-dark/30 hover:bg-primary-dark/5 hover:text-primary-dark"
                          >
                            <LayoutDashboard size={15} aria-hidden />
                          </IconAction>
                        )}
                        <IconAction
                          label={u.is_locked ? 'Unlock account' : 'Lock account'}
                          disabled={busy}
                          onClick={() => lockMutation.mutate(u.id)}
                          className={cn(
                            u.is_locked
                              ? 'hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                              : 'hover:border-red-200 hover:bg-red-50 hover:text-red-600',
                          )}
                        >
                          {u.is_locked ? <Unlock size={15} aria-hidden /> : <Lock size={15} aria-hidden />}
                        </IconAction>
                        <IconAction
                          label="Issue login OTP"
                          disabled={busy}
                          onClick={() => {
                            const send = window.confirm(
                              'Send OTP to user email as well?\nOK = email + show here\nCancel = desk code only (no email)',
                            )
                            otpMutation.mutate({ id: u.id, send_email: send })
                          }}
                          className="hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                        >
                          <KeyRound size={15} aria-hidden />
                        </IconAction>
                        <Link
                          to={`/admin/email-otps?user=${encodeURIComponent(u.email)}`}
                          title="View verification codes"
                          className={cn(
                            'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition',
                            'hover:border-primary-dark/20 hover:bg-gray-50 hover:text-primary-dark',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-dark',
                          )}
                        >
                          <ExternalLink size={15} aria-hidden />
                          <span className="sr-only">View codes for {u.email}</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
            </div>
          </>
        )}

        {!isLoading && users.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-2.5 text-center text-[11px] text-gray-500 sm:px-6">
            Showing {users.length} {users.length === 1 ? 'user' : 'users'}
            {roleFilter || search.trim() ? ' matching current filters' : ''}
          </div>
        )}
      </section>

      <AdminModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create admin user"
        subtitle="Role and customer access"
        icon={UserPlus}
        footer={
          <>
            <button type="button" className="btn-secondary flex-1" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create user
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <FieldLabel required>Full name</FieldLabel>
            <input
              className="input-field w-full text-sm"
              value={staffForm.full_name}
              onChange={(e) => setStaffForm((f) => ({ ...f, full_name: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel required>Email</FieldLabel>
            <input
              type="email"
              className="input-field w-full text-sm"
              value={staffForm.email}
              onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel>Phone</FieldLabel>
            <input
              className="input-field w-full text-sm"
              value={staffForm.phone}
              onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Password</FieldLabel>
              <input
                type="password"
                className="input-field w-full text-sm"
                value={staffForm.password}
                onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel required>Confirm</FieldLabel>
              <input
                type="password"
                className="input-field w-full text-sm"
                value={staffForm.password_confirm}
                onChange={(e) => setStaffForm((f) => ({ ...f, password_confirm: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <FieldLabel required>Role</FieldLabel>
            <select
              className="input-field w-full text-sm"
              value={staffForm.role}
                onChange={(e) => {
                const role = e.target.value as 'ADMIN' | 'SUPER_ADMIN'
                setStaffForm((f) => ({
                  ...f,
                  role,
                  admin_account_scope: role === 'SUPER_ADMIN' ? 'ALL' : f.admin_account_scope,
                  assigned_customer_ids: role === 'SUPER_ADMIN' ? [] : f.assigned_customer_ids,
                }))
              }}
            >
              {STAFF_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {staffForm.role === 'ADMIN' && (
            <div>
              <FieldLabel required>User access</FieldLabel>
              <select
                className="input-field w-full text-sm"
                value={staffForm.admin_account_scope}
                onChange={(e) =>
                  setStaffForm((f) => ({
                    ...f,
                    admin_account_scope: e.target.value as 'ALL' | 'SELECTED',
                  }))
                }
              >
                {SCOPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-500">
                Selected customers: admin sees every account, transaction, loan, OTP, and fee for those users only.
              </p>
            </div>
          )}
          {staffForm.role === 'ADMIN' && staffForm.admin_account_scope === 'SELECTED' && (
            <CustomerAssignmentPicker
              selectedIds={staffForm.assigned_customer_ids}
              onChange={(ids) => setStaffForm((f) => ({ ...f, assigned_customer_ids: ids }))}
              customerSearch={customerSearch}
              onSearchChange={setCustomerSearch}
              customers={pickerCustomers}
              loading={customersLoading}
            />
          )}
        </div>
      </AdminModal>

      <AdminModal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title="Edit user"
        subtitle={editUser?.email}
        icon={Pencil}
        footer={
          <>
            <button type="button" className="btn-secondary flex-1" onClick={() => setEditUser(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              Save changes
            </button>
          </>
        }
      >
        {editUser && (
          <div className="space-y-3">
            <div>
              <FieldLabel required>Full name</FieldLabel>
              <input
                className="input-field w-full text-sm"
                value={editForm.full_name}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel required>Email</FieldLabel>
              <input
                type="email"
                className="input-field w-full text-sm"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <input
                className="input-field w-full text-sm"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={editForm.is_active}
                onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="rounded border-gray-300 text-primary-dark"
              />
              Active account
            </label>
            {isStaffUser(editUser.role) && isSuperAdmin && (
              <>
                <div>
                  <FieldLabel>Role</FieldLabel>
                  <select
                    className="input-field w-full text-sm"
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        role: e.target.value,
                        admin_account_scope: e.target.value === 'SUPER_ADMIN' ? 'ALL' : f.admin_account_scope,
                      }))
                    }
                  >
                    {STAFF_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                {editForm.role === 'ADMIN' && (
                  <div>
                    <FieldLabel>User access</FieldLabel>
                    <select
                      className="input-field w-full text-sm"
                      value={editForm.admin_account_scope}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          admin_account_scope: e.target.value as 'ALL' | 'SELECTED',
                        }))
                      }
                    >
                      {SCOPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {editForm.role === 'ADMIN' && editForm.admin_account_scope === 'SELECTED' && (
                  <CustomerAssignmentPicker
                    selectedIds={editForm.assigned_customer_ids}
                    onChange={(ids) => setEditForm((f) => ({ ...f, assigned_customer_ids: ids }))}
                    customerSearch={customerSearch}
                    onSearchChange={setCustomerSearch}
                    customers={pickerCustomers}
                    loading={customersLoading}
                  />
                )}
              </>
            )}
          </div>
        )}
      </AdminModal>

      <AdminModal
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        title="Delete user"
        subtitle={deleteUser?.email}
        icon={Trash2}
        footer={
          <>
            <button type="button" className="btn-secondary w-full sm:flex-1" onClick={() => setDeleteUser(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="w-full flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 sm:w-auto"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Force delete
            </button>
          </>
        }
      >
        {deleteUser && (
          <p className="text-sm text-gray-600">
            Permanently remove <strong>{deleteUser.full_name}</strong> and{' '}
            <strong>all linked data</strong> (accounts, transactions, loans, compliance sessions, tickets, and related
            records)? This cannot be undone.
          </p>
        )}
      </AdminModal>
    </div>
  )
}
