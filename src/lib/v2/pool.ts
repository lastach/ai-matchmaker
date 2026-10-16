import type { SupabaseClient } from '@supabase/supabase-js'
import { ageFrom } from './server'
import { normalizeWeights, withType, type Member } from './engine'
import type { ProfileRow } from './types'

export function toMember(r: ProfileRow): Member {
  return {
    id: r.user_id,
    basics: r.basics || {},
    age: ageFrom(r.basics?.birthDate),
    cityKey: r.city_key,
    ai: r.ai_profile || {},
    video: r.video || {},
    weights: normalizeWeights(r.weights),
    attraction: r.attraction || {},
  }
}

export function toMemberWithType(r: ProfileRow): Member {
  return withType(toMember(r))
}

/** All members in a city who finished the conversation. */
export async function loadCity(svc: SupabaseClient, city: string): Promise<ProfileRow[]> {
  const { data, error } = await svc.from('amorlay_profiles').select('*').eq('city_key', city).eq('intake_complete', true).limit(2000)
  if (error) throw new Error(error.message)
  return (data || []) as ProfileRow[]
}

