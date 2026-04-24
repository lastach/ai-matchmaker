import type { MatchProfile, AttachmentStyle, CommunicationStyle, RelationshipPriority, ChildrenStance } from './matching'

const ATTACHMENTS: AttachmentStyle[] = ['secure', 'secure', 'secure', 'secure', 'anxious', 'anxious', 'avoidant', 'disorganized']
const COMMUNICATIONS: CommunicationStyle[] = ['direct-when-upset', 'sit-with-it', 'hope-it-resolves', 'process-externally']
const PRIORITIES: RelationshipPriority[] = ['actively-looking', 'actively-looking', 'open-and-serious', 'casually-open']
const KIDS: ChildrenStance[] = ['yes', 'maybe', 'no', 'have-and-want-more', 'have-and-done']
const GENDERS = ['Woman', 'Man', 'Nonbinary']
const CITIES = ['New York, NY', 'Los Angeles, CA', 'San Francisco, CA', 'Chicago, IL', 'Boston, MA', 'Austin, TX', 'Seattle, WA', 'Washington, DC']
const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Harper', 'Sage', 'Avery', 'Quinn',
  'Blake', 'Drew', 'Emerson', 'Finley', 'Hayden', 'Jamie', 'Kendall', 'Logan', 'Parker', 'Reese',
  'Rowan', 'Skyler', 'Dakota', 'River', 'Shay', 'Remy', 'Oakley', 'Phoenix', 'Marlowe', 'Indira',
  'Nadia', 'Priya', 'Lena', 'Maya', 'Simone', 'Imani', 'Juno', 'Esme', 'Iris', 'Naomi']
const LIFE_GOAL_KEYS = ['build-career', 'start-family', 'settle-down', 'travel-often', 'financial-indep', 'create-body-of-work', 'community', 'caretaking', 'spiritual-growth']
const VALUE_KEYS = ['honesty', 'ambition', 'family', 'adventure', 'stability', 'intellect', 'spirituality', 'creativity', 'wellness', 'service', 'independence', 'playfulness']

// Deterministic pseudo-random for reproducible seed (we don't want match results to shuffle every request)
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(1729)

function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rand() * arr.length)] }

function makeProfile(idx: number): MatchProfile {
  const gender = pick(GENDERS)
  const interested = pick(['women', 'men', 'nonbinary', 'anyone']) as string
  const age = 28 + Math.floor(rand() * 17) // 28..44
  const valueRatings: Record<string, number> = {}
  for (const k of VALUE_KEYS) valueRatings[k] = 1 + Math.floor(rand() * 5) // 1..5
  const numGoals = 2 + Math.floor(rand() * 3)
  const goals = [...LIFE_GOAL_KEYS].sort(() => rand() - 0.5).slice(0, numGoals)
  return {
    userId: `seed-${idx}`,
    name: FIRST_NAMES[idx % FIRST_NAMES.length],
    age,
    gender,
    interestedIn: interested,
    location: pick(CITIES),
    ownWantChildren: pick(KIDS),
    preferredAgeMin: Math.max(21, age - 7),
    preferredAgeMax: Math.min(60, age + 7),
    ageFlexible: rand() > 0.5,
    valueRatings,
    attachmentStyle: pick(ATTACHMENTS),
    communicationStyle: pick(COMMUNICATIONS),
    lifeGoals: goals,
    relationshipPriority: pick(PRIORITIES),
  }
}

export const SEED_POOL: MatchProfile[] = Array.from({ length: 40 }, (_, i) => makeProfile(i))
