import { useCallback, useMemo, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

export type LocationOption = { value: string; label: string }

type CscModule = typeof import('country-state-city')

async function loadCsc(): Promise<CscModule> {
  return import('country-state-city')
}

/** Lazy-load geo dataset once per session (no external API key). */
export function useLocationDataset() {
  return useQuery({
    queryKey: ['location-dataset'],
    queryFn: loadCsc,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCountryOptions(csc: CscModule | undefined): LocationOption[] {
  return useMemo(() => {
    if (!csc) return []
    return csc.Country.getAllCountries()
      .map((c) => ({
        value: c.isoCode,
        label: `${c.name} (${c.isoCode})`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [csc])
}

/**
 * Resolve a stored or pasted country string to ISO-2.
 * Does NOT treat arbitrary 2-letter fragments (e.g. "Ni" while typing Nigeria) as ISO codes.
 */
export function resolveCountryIso(csc: CscModule, raw: string): string | null {
  const q = raw.trim()
  if (!q) return null

  const countries = csc.Country.getAllCountries()
  const upper = q.toUpperCase()

  const paren = q.match(/^(.+?)\s*\(([A-Z]{2})\)\s*$/i)
  if (paren) {
    const iso = paren[2].toUpperCase()
    return countries.some((c) => c.isoCode === iso) ? iso : null
  }

  if (/^[A-Z]{2}$/i.test(q)) {
    const iso = upper
    return countries.some((c) => c.isoCode === iso) ? iso : null
  }

  const byName = countries.find(
    (c) =>
      c.name.toLowerCase() === q.toLowerCase() ||
      `${c.name} (${c.isoCode})`.toLowerCase() === q.toLowerCase(),
  )
  return byName?.isoCode ?? null
}

/** Human-readable country name for display / saved address text. */
export function countryDisplayName(csc: CscModule | undefined, raw: string): string {
  if (!raw.trim() || !csc) return raw
  const iso = resolveCountryIso(csc, raw)
  if (!iso) return raw
  const c = csc.Country.getAllCountries().find((x) => x.isoCode === iso)
  return c?.name ?? raw
}

/** Label shown in country combobox after a country is selected (ISO stored). */
export function countryComboboxLabel(csc: CscModule | undefined, stored: string): string {
  if (!stored.trim()) return ''
  if (!csc) return stored
  const iso = resolveCountryIso(csc, stored)
  if (!iso) return stored
  const c = csc.Country.getAllCountries().find((x) => x.isoCode === iso)
  return c ? `${c.name} (${c.isoCode})` : stored
}

/** Stable formatter for LocationCombobox `formatCommitted` on country fields. */
export function useCountryComboboxFormatter(csc: CscModule | undefined) {
  return useCallback((stored: string) => countryComboboxLabel(csc, stored), [csc])
}

/**
 * @deprecated Use LocationCombobox with selectOnly instead.
 * Kept for gradual migration — no longer auto-commits while typing.
 */
export function useCountryComboboxDraft(
  storedIso: string,
  csc: CscModule | undefined,
  onStore: (iso: string) => void,
) {
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setDraft(countryComboboxLabel(csc, storedIso) || storedIso || '')
  }, [storedIso, csc])

  const onChange = (raw: string) => {
    setDraft(raw)
    if (!raw.trim()) {
      onStore('')
    }
  }

  const onSelect = (iso: string) => {
    onStore(iso)
    setDraft(countryComboboxLabel(csc, iso))
  }

  return { draft, onChange, onSelect }
}

export function stateDisplayName(
  _csc: CscModule | undefined,
  _countryRaw: string,
  stateRaw: string,
  stateOptions: LocationOption[],
): string {
  if (!stateRaw.trim()) return stateRaw
  const fromOpt = stateOptions.find((s) => s.value === stateRaw || s.label === stateRaw)
  if (fromOpt) return fromOpt.label
  return stateRaw
}

export function useStateOptions(csc: CscModule | undefined, countryRaw: string | undefined): LocationOption[] {
  return useMemo(() => {
    if (!csc) return []
    const iso = resolveCountryIso(csc, countryRaw ?? '')
    if (!iso) return []
    return csc.State.getStatesOfCountry(iso)
      .map((s) => ({
        value: s.isoCode,
        label: s.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [csc, countryRaw])
}

function resolveStateIso(
  csc: CscModule,
  countryIso: string,
  stateRaw: string,
  stateOptions: LocationOption[],
): string | null {
  const q = stateRaw.trim()
  if (!q) return null
  const fromOptions = stateOptions.find(
    (s) => s.value === q || s.label.toLowerCase() === q.toLowerCase(),
  )
  if (fromOptions) return fromOptions.value
  const states = csc.State.getStatesOfCountry(countryIso)
  const match = states.find(
    (s) => s.isoCode === q || s.name.toLowerCase() === q.toLowerCase(),
  )
  return match?.isoCode ?? null
}

export function useCityOptions(
  csc: CscModule | undefined,
  countryRaw: string | undefined,
  stateRaw: string | undefined,
  stateOptions: LocationOption[],
): LocationOption[] {
  return useMemo(() => {
    if (!csc) return []
    const countryIso = resolveCountryIso(csc, countryRaw ?? '')
    if (!countryIso) return []
    const stateIso = resolveStateIso(csc, countryIso, stateRaw ?? '', stateOptions)
    const cities = stateIso
      ? csc.City.getCitiesOfState(countryIso, stateIso)
      : csc.City.getCitiesOfCountry(countryIso)
    return (cities ?? [])
      .map((city) => ({
        value: city.name,
        label: city.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [csc, countryRaw, stateRaw, stateOptions])
}
