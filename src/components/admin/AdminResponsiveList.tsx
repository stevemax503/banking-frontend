import type { ReactNode } from 'react'

type AdminResponsiveListProps<T> = {
  rows: T[]
  emptyMessage?: ReactNode
  renderMobileCard: (row: T, index: number) => ReactNode
  table: ReactNode
  mobileClassName?: string
  tableClassName?: string
}

/** Mobile card list + desktop table (table hidden below md). */
export function AdminResponsiveList<T>({
  rows,
  emptyMessage = 'No records found.',
  renderMobileCard,
  table,
  mobileClassName = 'space-y-3 md:hidden',
  tableClassName = 'admin-table-scroll hidden md:block',
}: AdminResponsiveListProps<T>) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-10 text-center text-sm text-gray-500">
        {emptyMessage}
      </p>
    )
  }

  return (
    <>
      <ul className={mobileClassName}>{rows.map((row, index) => renderMobileCard(row, index))}</ul>
      <div className={tableClassName}>{table}</div>
    </>
  )
}

export function AdminMobileCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <li
      className={
        className ??
        'rounded-xl border border-gray-200/90 bg-white p-3.5 shadow-sm sm:p-4'
      }
    >
      {children}
    </li>
  )
}

export function AdminPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={
        className ??
        'overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-sm'
      }
    >
      {children}
    </section>
  )
}

export function AdminFilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50/50 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:px-4">
      {children}
    </div>
  )
}
