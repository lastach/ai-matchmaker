import type { SupabaseClient } from '@supabase/supabase-js'
import { ageFrom } from './server'
import type { Member, RatingMap } from './engine'
import { DEFAULT_WEIGHTS, type ProfileRow } from './types'

export function toMember(r: ProfileRow): Member {
  return {
    id: r.user_id,
    basics: r.basics || {},
    age: ageFrom(r.basics?.birthDate),
    cityKey: r.city_key,
    ai: r.ai_profile || {},
    video: r.video || {},
    weights: { ...DEFAULT_WEIGHTS, ...(r.weights || {}) },
  }
}

/** All members in a city who finished the conversation. */
export async function loadCity(svc: SupabaseClient, city: string): Promise<ProfileRow[]> {
  const { data, error } = await svc.from('amorlay_profiles').select('*').eq('city_key', city).eq('intake_complete', true).limit(2000)
  if (error) throw new Error(error.message)
  return (data || []) as ProfileRow[]
}

export async function loadRatings(svc: SupabaseClient, ids: string[]): Promise<RatingMap> {
  const map: RatingMap = {}
  if (ids.length === 0) return map
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    const { data, error } = await svc.from('amorlay_ratings').select('rater_id, target_id, photo_rating, video_rating').in('rater_id', chunk)
    if (error) throw new Error(error.message)
    for (const r of data || []) {
      ;(map[r.rater_id] ||= {})[r.target_id] = { photo: r.photo_rating, video: r.video_rating }
    }
  }
  return map
}
