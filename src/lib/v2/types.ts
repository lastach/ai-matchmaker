/** Shared types for Amorlay v2. */

export type Gender = 'woman' | 'man' | 'nonbinary' | string

export interface Basics {
  firstName?: string
  birthDate?: string // YYYY-MM-DD
  city?: string
  gender?: Gender
  genderSelfDescribe?: string
  interestedIn?: Array<'women' | 'men' | 'nonbinary' | 'anyone'>
  ageMin?: number
  ageMax?: number
  email?: string // copied from the sign-in, for "matching is open in your city" notes
}

export type Coverage = 'covered' | 'partial' | 'missing'

/** What the AI pulls out of the intake conversation. Every field is optional until covered. */
export interface AiProfile {
  about?: string // two lines in the person's own spirit, used by the date coach
  readiness?: { level?: number; ready?: boolean; notes?: string } // level 0..10
  kids?: { stance?: 'yes' | 'no' | 'maybe' | 'have-and-want-more' | 'have-and-done' | null; flexible?: boolean }
  relationshipGoals?: { summary?: string; marriage?: 'yes' | 'no' | 'open' | null; pace?: string }
  idealPerson?: string
  idealRelationship?: string
  mustHaves?: Array<{ item: string; goodEnough?: string; flexible?: boolean; rank?: number }>
  dealbreakers?: Array<{ item: string; source?: 'stated' | 'past-relationships' }>
  values?: Array<{ value: string; importance?: number; dealLevel?: boolean }>
  feelUnderstood?: string
  exPattern?: { traits?: string; problems?: string }
  personality?: { openness?: number; conscientiousness?: number; extraversion?: number; agreeableness?: number; neuroticism?: number } // 1..10
  attachment?: { anxiety?: number; avoidance?: number } // 1..10
  maximizing?: number // 1..10
  interests?: string[]
  coverage?: Record<string, Coverage>
}

export interface VideoAssessment {
  warmth?: number // 1..10
  energy?: number
  expressiveness?: number
  agreeableness?: number
  extraversion?: number
  neuroticism?: number
  notes?: string
  transcriptAvailable?: boolean
  at?: string
}

export interface Weights {
  mustHaves: number
  values: number
  partnerFit: number
  energy: number
  attraction: number
}

export const DEFAULT_WEIGHTS: Weights = { mustHaves: 25, values: 25, partnerFit: 20, energy: 15, attraction: 15 }

/** Visible characteristics of a photo, used to learn and match someone's physical type. */
export interface Looks {
  age?: string // 20s | 30s | 40s | 50s
  style?: string // polished | casual | edgy | outdoorsy | sporty
  vibe?: string // warm | reserved | playful
  build?: string // slim | average | athletic | fuller
  hair?: string // long | medium | short | bald
  facialHair?: string // none | stubble | beard
  glasses?: string // yes | no
}

/** Ratings of the example library plus the member's own looks (from their photos). */
export interface AttractionData {
  ratings?: Record<string, { photo?: number; about?: number; variant?: 'warm' | 'flat' }>
  looks?: Looks
  looksAt?: string
  done?: boolean
}

export interface ProfileRow {
  user_id: string
  step: string
  basics: Basics
  city_key: string | null
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>
  ai_profile: AiProfile
  video: VideoAssessment
  clip_path: string | null
  share_clip: boolean
  weights: Weights
  intake_complete: boolean
  attraction?: AttractionData
  updated_at?: string
}

/** AI evaluation of one pair, both directions. A and B are the two user ids in pair_key order. */
export interface PairEval {
  aMustHaves: Array<{ item: string; met: number; flexible: boolean }> // A's must-haves judged against B
  bMustHaves: Array<{ item: string; met: number; flexible: boolean }>
  aDealbreakerHit: string | null // A's dealbreaker that B triggers
  bDealbreakerHit: string | null
  valuesAlignment: number // 0..1
  dealLevelValueConflict: string | null
  aRepeatType: number // 0..1 how much B resembles the type behind A's past problems
  bRepeatType: number
  aPartnerFit: number // 0..1 how good a partner B would be for A specifically
  bPartnerFit: number
  why: string // plain-language reason this could work
  dateIdea: string
}
