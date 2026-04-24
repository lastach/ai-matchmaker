/**
 * Matching engine for AI Matchmaker.
 *
 * Based on the product thesis from the investor deck:
 *  - Deep intake: values, attachment style, communication style, life goals, relationship priority
 *  - ONE match per month (not a feed)
 *  - Behavioral feedback loop improves the model
 *
 * Research anchors encoded in the weights:
 *  - Gottman & Levenson: communication patterns predict relationship outcomes at ~90% accuracy.
 *  - Attachment theory: secure + secure pairings correlate with highest satisfaction; avoidant + anxious is the
 *    classic high-conflict combination to avoid.
 *  - Similarity in core values predicts long-term satisfaction better than complementarity on most traits.
 *
 * The compatibility score is a weighted sum in [0, 100]:
 *    values_alignment (30)
 *  + attachment_compat (25)
 *  + communication_compat (20)
 *  + life_goals_overlap  (20)
 *  + relationship_priority_fit (5)
 *
 * Hard filters short-circuit to 0:
 *  - age out of user's requested window (and not "flexible")
 *  - children stance incompatible (e.g., "must not want kids" vs "want kids")
 *  - gender / dating preference mismatch
 */

// -------- TYPES --------

export type AttachmentStyle = 'secure' | 'anxious' | 'avoidant' | 'disorganized';

export type CommunicationStyle =
  | 'direct-when-upset'
  | 'sit-with-it'
  | 'hope-it-resolves'
  | 'process-externally';

export type RelationshipPriority =
  | 'actively-looking'
  | 'open-and-serious'
  | 'casually-open';

export type ChildrenStance =
  | 'yes'
  | 'maybe'
  | 'no'
  | 'have-and-want-more'
  | 'have-and-done';

export interface MatchProfile {
  userId: string;
  name: string;
  age: number;
  gender: string;
  interestedIn: string;
  location: string;
  ownWantChildren: ChildrenStance;
  preferredAgeMin: number;
  preferredAgeMax: number;
  ageFlexible: boolean;
  valueRatings: { [valueKey: string]: number }; // 1..5 on each of a fixed 12-value axis
  attachmentStyle: AttachmentStyle;
  communicationStyle: CommunicationStyle;
  lifeGoals: string[]; // e.g. ['build-career', 'start-family', 'travel-often']
  relationshipPriority: RelationshipPriority;
  dealbreakers?: string[];
}

export interface MatchResult {
  candidate: MatchProfile;
  score: number; // 0..100
  breakdown: {
    values: number;
    attachment: number;
    communication: number;
    lifeGoals: number;
    relationshipPriority: number;
  };
  notes: string[];
}

// -------- CONSTANTS --------

export const CORE_VALUES = [
  { key: 'honesty',       label: 'Honesty & directness' },
  { key: 'ambition',      label: 'Ambition & drive' },
  { key: 'family',        label: 'Family & roots' },
  { key: 'adventure',     label: 'Adventure & novelty' },
  { key: 'stability',     label: 'Stability & routine' },
  { key: 'intellect',     label: 'Intellectual curiosity' },
  { key: 'spirituality',  label: 'Spirituality / meaning' },
  { key: 'creativity',    label: 'Creative expression' },
  { key: 'wellness',      label: 'Health & wellness' },
  { key: 'service',       label: 'Service & giving back' },
  { key: 'independence',  label: 'Independence & autonomy' },
  { key: 'playfulness',   label: 'Play & humor' },
] as const;

export const LIFE_GOALS = [
  { key: 'build-career',    label: 'Build / grow my career' },
  { key: 'start-family',    label: 'Start or grow a family' },
  { key: 'settle-down',     label: 'Settle down somewhere specific' },
  { key: 'travel-often',    label: 'Travel often' },
  { key: 'financial-indep', label: 'Financial independence' },
  { key: 'create-body-of-work', label: 'Create a body of work' },
  { key: 'community',       label: 'Deep roots in a community' },
  { key: 'caretaking',      label: 'Caretake parents or elders' },
  { key: 'spiritual-growth',label: 'Spiritual / inner growth' },
] as const;

// Attachment compatibility matrix (0..1). Based on attachment-theory literature
// (Collins & Read; Mikulincer & Shaver; Hazan & Shaver). Secure+secure highest,
// anxious+avoidant is the well-documented difficult pairing.
const ATTACHMENT_MATRIX: Record<AttachmentStyle, Record<AttachmentStyle, number>> = {
  secure:        { secure: 1.00, anxious: 0.80, avoidant: 0.70, disorganized: 0.55 },
  anxious:       { secure: 0.80, anxious: 0.55, avoidant: 0.30, disorganized: 0.40 },
  avoidant:      { secure: 0.70, anxious: 0.30, avoidant: 0.45, disorganized: 0.35 },
  disorganized:  { secure: 0.55, anxious: 0.40, avoidant: 0.35, disorganized: 0.30 },
};

// Communication-style compatibility. Inspired by Gottman's pos/neg ratio work:
// partners who process similarly (direct↔direct, sit↔sit) do better than mismatches;
// avoidance paired with directness creates the pursue-withdraw pattern.
const COMMUNICATION_MATRIX: Record<CommunicationStyle, Record<CommunicationStyle, number>> = {
  'direct-when-upset':  { 'direct-when-upset': 0.95, 'sit-with-it': 0.70, 'hope-it-resolves': 0.35, 'process-externally': 0.60 },
  'sit-with-it':        { 'direct-when-upset': 0.70, 'sit-with-it': 0.80, 'hope-it-resolves': 0.55, 'process-externally': 0.65 },
  'hope-it-resolves':   { 'direct-when-upset': 0.35, 'sit-with-it': 0.55, 'hope-it-resolves': 0.50, 'process-externally': 0.50 },
  'process-externally': { 'direct-when-upset': 0.60, 'sit-with-it': 0.65, 'hope-it-resolves': 0.50, 'process-externally': 0.75 },
};

// Relationship-priority match. Mismatches on urgency cause churn.
const PRIORITY_MATRIX: Record<RelationshipPriority, Record<RelationshipPriority, number>> = {
  'actively-looking':  { 'actively-looking': 1.00, 'open-and-serious': 0.85, 'casually-open': 0.30 },
  'open-and-serious':  { 'actively-looking': 0.85, 'open-and-serious': 1.00, 'casually-open': 0.55 },
  'casually-open':     { 'actively-looking': 0.30, 'open-and-serious': 0.55, 'casually-open': 0.85 },
};

// -------- SCORING --------

/** Values alignment — cosine-style similarity over the shared value-rating vector. */
export function scoreValues(a: MatchProfile, b: MatchProfile): number {
  let dot = 0, na = 0, nb = 0;
  for (const { key } of CORE_VALUES) {
    const va = a.valueRatings[key] ?? 3;
    const vb = b.valueRatings[key] ?? 3;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  if (na === 0 || nb === 0) return 0;
  const sim = dot / Math.sqrt(na * nb); // 0..1 (since ratings are positive)
  return Math.round(sim * 100) / 100;
}

export function scoreAttachment(a: MatchProfile, b: MatchProfile): number {
  return ATTACHMENT_MATRIX[a.attachmentStyle]?.[b.attachmentStyle] ?? 0.5;
}

export function scoreCommunication(a: MatchProfile, b: MatchProfile): number {
  return COMMUNICATION_MATRIX[a.communicationStyle]?.[b.communicationStyle] ?? 0.5;
}

/** Life-goal overlap — Jaccard-like plus a bonus for the top-priority-like goals aligning. */
export function scoreLifeGoals(a: MatchProfile, b: MatchProfile): number {
  const A = new Set(a.lifeGoals || []);
  const B = new Set(b.lifeGoals || []);
  if (A.size === 0 && B.size === 0) return 0.5;
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0.5 : inter / union;
}

export function scorePriority(a: MatchProfile, b: MatchProfile): number {
  return PRIORITY_MATRIX[a.relationshipPriority]?.[b.relationshipPriority] ?? 0.5;
}

/** Hard filters — return [false, reason] to skip a candidate outright. */
export function passesHardFilters(user: MatchProfile, cand: MatchProfile): { ok: boolean; reason?: string } {
  // Age — within the user's window unless flexible
  const ageOk = user.ageFlexible
    ? Math.abs(cand.age - (user.preferredAgeMin + user.preferredAgeMax) / 2) <= 10
    : cand.age >= user.preferredAgeMin && cand.age <= user.preferredAgeMax;
  if (!ageOk) return { ok: false, reason: 'age out of requested range' };

  // Gender preference — interestedIn is "women" / "men" / "nonbinary" / "anyone"
  if (user.interestedIn && user.interestedIn !== 'anyone') {
    const candGender = (cand.gender || '').toLowerCase();
    const preferred = user.interestedIn.toLowerCase();
    if (preferred === 'women' && candGender !== 'woman') return { ok: false, reason: 'gender preference' };
    if (preferred === 'men' && candGender !== 'man') return { ok: false, reason: 'gender preference' };
    if (preferred === 'nonbinary' && candGender !== 'nonbinary') return { ok: false, reason: 'gender preference' };
  }

  // Children stance — block classic incompatibilities
  const blockedPairs: Array<[ChildrenStance, ChildrenStance]> = [
    ['yes', 'no'],
    ['no', 'yes'],
    ['have-and-want-more', 'no'],
    ['no', 'have-and-want-more'],
  ];
  if (blockedPairs.some(([x, y]) => user.ownWantChildren === x && cand.ownWantChildren === y)) {
    return { ok: false, reason: 'children stance incompatible' };
  }

  return { ok: true };
}

/** Full composite score with breakdown and human-readable notes. */
export function scoreCandidate(user: MatchProfile, cand: MatchProfile): MatchResult | null {
  const filter = passesHardFilters(user, cand);
  if (!filter.ok) return null;

  const values        = scoreValues(user, cand);
  const attachment    = scoreAttachment(user, cand);
  const communication = scoreCommunication(user, cand);
  const lifeGoals     = scoreLifeGoals(user, cand);
  const priority      = scorePriority(user, cand);

  const composite =
    values * 30 +
    attachment * 25 +
    communication * 20 +
    lifeGoals * 20 +
    priority * 5;

  const notes: string[] = [];
  if (user.attachmentStyle === 'secure' && cand.attachmentStyle === 'secure') {
    notes.push('Both secure attachment — strong foundation for steady conflict resolution.');
  } else if (
    (user.attachmentStyle === 'anxious' && cand.attachmentStyle === 'avoidant') ||
    (user.attachmentStyle === 'avoidant' && cand.attachmentStyle === 'anxious')
  ) {
    notes.push('Anxious + avoidant pairing — this combination historically creates pursue-withdraw dynamics. Worth naming early.');
  }
  if (values >= 0.9) notes.push('Exceptional values alignment on the 12-dimension scale.');
  if (communication >= 0.9) notes.push('Very similar conflict-processing styles.');
  if (lifeGoals >= 0.75) notes.push('Life goals substantially overlap.');

  return {
    candidate: cand,
    score: Math.round(composite * 10) / 10,
    breakdown: { values, attachment, communication, lifeGoals, relationshipPriority: priority },
    notes,
  };
}

/** Top N matches from a candidate pool. Filters out hard-blocks and sorts by composite score. */
export function topMatches(user: MatchProfile, pool: MatchProfile[], n: number = 1): MatchResult[] {
  const scored = pool
    .filter((c) => c.userId !== user.userId)
    .map((c) => scoreCandidate(user, c))
    .filter((r): r is MatchResult => r !== null);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n);
}
