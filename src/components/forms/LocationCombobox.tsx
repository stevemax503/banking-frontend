import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { LocationOption } from '@/lib/locationData'

type Props = {
  label: string
  /** Committed value (e.g. ISO code for country, or free text for city). */
  value: string
  onChange: (value: string) => void
  options: LocationOption[]
  error?: string
  placeholder?: string
  hint?: string
  disabled?: boolean
  loading?: boolean
  className?: string
  inputClassName?: string
  /** When picking from the list, store the country name instead of ISO code. */
  preferLabel?: boolean
  /**
   * When true, typing only filters the list — value commits on list selection (or clear).
   * Use for country fields. State/city can stay free-text (false).
   */
  selectOnly?: boolean
  /** How to show the committed value when the field is not being edited. */
  formatCommitted?: (value: string) => string
}

function defaultFormatCommitted(value: string): string {
  return value
}

export function LocationCombobox({
  label,
  value,
  onChange,
  options,
  error,
  placeholder,
  hint = 'Type freely or choose from suggestions',
  disabled,
  loading,
  className,
  inputClassName,
  preferLabel = false,
  selectOnly = false,
  formatCommitted = defaultFormatCommitted,
}: Props) {
  const safeValue = value ?? ''
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const committedDisplay = useMemo(
    () => formatCommitted(safeValue) || safeValue,
    [safeValue, formatCommitted],
  )

  /** User is searching: focused, or draft text no longer matches the committed label. */
  const isSearching = focused || draft !== committedDisplay

  // Sync draft when the committed value changes externally (e.g. form reset), not while editing.
  useEffect(() => {
    if (!focused && !isSearching) {
      setDraft(committedDisplay)
    }
  }, [committedDisplay, focused, isSearching])

  const filterText = (isSearching ? draft : committedDisplay).trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!filterText) return options.slice(0, 50)
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(filterText) ||
          o.value.toLowerCase().includes(filterText),
      )
      .slice(0, 50)
  }, [filterText, options])

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const inputValue = isSearching ? draft : committedDisplay

  const handleDraftChange = (next: string) => {
    setDraft(next)
    setOpen(true)

    if (!selectOnly) {
      onChange(next)
      return
    }

    if (!next.trim()) {
      onChange('')
      return
    }

    // Clear committed selection while the user edits away from the chosen label.
    if (next !== committedDisplay && safeValue) {
      onChange('')
    }
  }

  const commitSelection = (opt: LocationOption) => {
    const next = preferLabel
      ? opt.label.replace(/\s*\([A-Z]{2}\)\s*$/i, '').trim()
      : opt.value
    const display = preferLabel ? next : opt.label
    onChange(next)
    setDraft(display)
    setOpen(false)
    // Keep focus so the user can backspace immediately after a mistaken pick.
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <div ref={rootRef} className={cn('relative space-y-1', className)}>
      {label ? <label className="block text-sm font-medium text-gray-700">{label}</label> : null}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled || loading}
          placeholder={loading ? 'Loading locations…' : placeholder}
          autoComplete="off"
          onChange={(e) => handleDraftChange(e.target.value)}
          onFocus={() => {
            setFocused(true)
            setDraft(committedDisplay)
            setOpen(true)
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setFocused(false)
              setOpen(false)
              if (selectOnly) {
                setDraft(committedDisplay)
              }
            }, 120)
          }}
          className={cn(
            'input-field w-full pr-10',
            error && 'border-red-300 focus:border-red-400 focus:ring-red-100',
            inputClassName,
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || loading}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            inputRef.current?.focus()
            setOpen((o) => !o)
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-700 disabled:opacity-40"
          aria-label="Show suggestions"
        >
          <ChevronDown size={18} strokeWidth={2} className={cn(open && 'rotate-180 transition-transform')} />
        </button>
      </div>
      {open && !disabled && !loading && filtered.length > 0 ? (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {filtered.map((opt) => (
            <li key={`${opt.value}-${opt.label}`} role="option">
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-gray-900 hover:bg-emerald-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commitSelection(opt)}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {hint && !error ? <p className="text-[11px] text-gray-400">{hint}</p> : null}
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  )
}
