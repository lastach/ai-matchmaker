/**
 * Supabase-backed profile store for Amorlay.
 * Mirrors the prior localStorage shape so existing UI doesn't have to change.
 *
 * Falls back to localStorage if Supabase row hasn't been created yet (offline / before
 * intake completes). On next save, syncs to Supabase.
 */
import { supabase } from './supabase'

export type AmorlayProfile = {
  // From OnboardingChat ChatProfileData + ChatCoreIntakeData (merged)
  name?: string
  birthDate?: string
  gender?: string
  pronouns?: string
  interestedIn?: string
  ownWantChildren?: string
  bio?: string
  wantChildren?: string
  location?: string
  locationFlexibility?: string
  ageMin?: number
  ageMax?: number
  ageFlexible?: boolean
  attractionImportance?: string
  dealbreakers?: string[]
  dealbreakersOther?: string
  q6Response?: string
  q7Response?: string
  q8Response?: string
  q9Response?: string
  q10Response?: string
  topValue?: string
  attachmentSelf?: string
  topLifeGoal?: string
  priorityChoice?: string
  profileStrength?: number
  intakeCompletedAt?: string
}

const fieldMap: Record<string, string> = {
  name: 'name',
  birthDate: 'birth_date',
  gender: 'gender',
  pronouns: 'pronouns',
  interestedIn: 'interested_in',
  ownWantChildren: 'own_want_children',
  bio: 'bio',
  wantChildren: 'want_children',
  location: 'location',
  locationFlexibility: 'location_flexibility',
  ageMin: 'age_min',
  ageMax: 'age_max',
  ageFlexible: 'age_flexible',
  attractionImportance: 'attraction_importance',
  dealbreakers: 'dealbreakers',
  dealbreakersOther: 'dealbreakers_other',
  q6Response: 'q6_response',
  q7Response: 'q7_response',
  q8Response: 'q8_response',
  q9Response: 'q9_response',
  q10Response: 'q10_response',
  topValue: 'top_value',
  attachmentSelf: 'attachment_self',
  topLifeGoal: 'top_life_goal',
  priorityChoice: 'priority_choice',
  profileStrength: 'profile_strength',
  intakeCompletedAt: 'intake_completed_at',
}

function toRow(p: AmorlayProfile, userId: string): Record<string, any> {
  const row: Record<string, any> = { user_id: userId }
  for (const k of Object.keys(p) as Array<keyof AmorlayProfile>) {
    const v = p[k]
    if (v !== undefined) row[fieldMap[k] || k] = v
  }
  return row
}

function fromRow(row: any): AmorlayProfile {
  const p: AmorlayProfile = {}
  for (const [k, dbKey] of Object.entries(fieldMap)) {
    if (row[dbKey] !== undefined && row[dbKey] !== null) (p as any)[k] = row[dbKey]
  }
  return p
}

/** Load the user's profile, preferring Supabase, falling back to localStorage. */
export async function loadProfile(userId: string): Promise<AmorlayProfile> {
  try {
    const { data, error } = await supabase
      .from('matchmaker_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    if (data) return fromRow(data)
  } catch (e) {
    // Table missing or auth issue — fall through to localStorage
  }
  // Fallback: read from per-user localStorage keys
  if (typeof window === 'undefined') return {}
  const profile: AmorlayProfile = {}
  const ls = localStorage.getItem(`amorlay_profile_${userId}`)
  if (ls) try { Object.assign(profile, JSON.parse(ls)) } catch {}
  return profile
}

/** Save (upsert) the user's profile to Supabase + write-through to localStorage. */
export async function saveProfile(userId: string, p: AmorlayProfile): Promise<{ ok: boolean; error?: string }> {
  // Always write-through to localStorage as a session cache
  if (typeof window !== 'undefined') {
    localStorage.setItem(`amorlay_profile_${userId}`, JSON.stringify(p))
  }
  try {
    const row = toRow(p, userId)
    row.updated_at = new Date().toISOString()
    const { error } = await supabase
      .from('matchmaker_profiles')
      .upsert(row, { onConflict: 'user_id' })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Permanently delete the user's profile. Called from /api/account/delete. */
export async function deleteProfile(userId: string): Promise<void> {
  try {
    await supabase.from('matchmaker_profiles').delete().eq('user_id', userId)
  } catch {}
  if (typeof window !== 'undefined') {
    localStorage.removeItem(`amorlay_profile_${userId}`)
  }
}
