import { useId, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { selectShell } from '@/components/forms/StyledSelect'
import { cn } from '@/utils/cn'

type Option = { value: string; label: string }

type AdminInlineSelectProps = {
  label: string
  options: readonly Option[]
  className?: string
} & SelectHTMLAttributes<HTMLSelectElement>

/** Compact styled select for admin filter bars (matches StyledSelect chevron shell). */
export default function AdminInlineSelect({
  label,
  options,
  className,
  id,
  ...selectProps
}: AdminInlineSelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId

  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={selectId} className="sr-only">
        {label}
      </label>
      <div className={cn(selectShell, 'group relative')}>
        <select
          id={selectId}
          aria-label={label}
          className="w-full min-w-0 cursor-pointer appearance-none rounded-xl bg-transparent py-2.5 pl-3.5 pr-10 text-sm font-medium text-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          {...selectProps}
        >
          {options.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute inset-y-0 right-2.5 flex w-7 items-center justify-center rounded-lg bg-gray-50 text-gray-500 transition-colors group-focus-within:bg-primary-dark/5 group-focus-within:text-primary-dark"
          aria-hidden
        >
          <ChevronDown size={15} strokeWidth={2.25} />
        </span>
      </div>
    </div>
  )
}
