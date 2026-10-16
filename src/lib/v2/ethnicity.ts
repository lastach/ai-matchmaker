/** Self-described backgrounds. Members choose their own; nothing is inferred from photos. */
export const ETHNICITIES = [
  { key: 'black', label: 'Black or African descent' },
  { key: 'east-asian', label: 'East Asian' },
  { key: 'south-asian', label: 'South Asian' },
  { key: 'southeast-asian', label: 'Southeast Asian' },
  { key: 'hispanic', label: 'Hispanic or Latino' },
  { key: 'middle-eastern', label: 'Middle Eastern or North African' },
  { key: 'native', label: 'Native American or Indigenous' },
  { key: 'pacific', label: 'Pacific Islander' },
  { key: 'white', label: 'White' },
  { key: 'other', label: 'Other' },
] as const

const KEYS = new Set<string>(ETHNICITIES.map((e) => e.key))

export function cleanEthnicityList(xs: unknown): string[] {
  return Array.isArray(xs) ? [...new Set(xs.map(String).filter((k) => KEYS.has(k)))] : []
}

/**
 * True when b fits a's background filter. No filter means open to everyone.
 * With a filter, b must have shared a background that is on a's list.
 */
export function fitsEthnicityPref(pref: string[] | undefined, other: string[] | undefined): boolean {
  if (!pref || pref.length === 0) return true
  return (other || []).some((k) => pref.includes(k))
}
