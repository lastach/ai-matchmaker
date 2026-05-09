import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/cron/check-cohort-thresholds
 * Runs daily. For each location whose member count has just crossed the
 * COHORT_THRESHOLD, notify all unnotified members in that cohort that their
 * cohort is open. Marks each profile's cohort_notified_at to be idempotent.
 *
 * Falls back gracefully when:
 *  - matchmaker_profiles table doesn't exist (migration not yet run)
 *  - cohort_notified_at column doesn't exist
 *  - RESEND_API_KEY missing (skip notifications, return summary only)
 *
 * Auth: vercel cron passes a Bearer with CRON_SECRET. Reject otherwise.
 */
const COHORT_THRESHOLD = 50
const APP_HOME = 'https://www.amorlay.com'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization') || ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ skipped: 'no-service-key' })

  const admin = createClient(url, serviceKey)

  // Pull every profile that has a location (we only notify location-bound users)
  const { data: profiles, error } = await admin
    .from('matchmaker_profiles')
    .select('user_id, location, cohort_notified_at')
    .not('location', 'is', null)
  if (error) {
    if (/does not exist|relation|column/i.test(error.message)) {
      return NextResponse.json({ skipped: 'table-or-column-missing', note: error.message })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Bucket profiles by normalized first-token of location (matching the waitlist logic)
  const bucket = new Map<string, Array<{ user_id: string; cohort_notified_at: string | null }>>()
  for (const p of profiles || []) {
    const loc = (p.location || '').trim()
    if (!loc) continue
    const token = (loc.split(/[\s,]/).filter(Boolean)[0] || loc).toLowerCase()
    if (!bucket.has(token)) bucket.set(token, [])
    bucket.get(token)!.push({ user_id: p.user_id, cohort_notified_at: p.cohort_notified_at })
  }

  const apiKey = process.env.RESEND_API_KEY
  const summary: Array<{ token: string; size: number; notified: number; skipped: number }> = []

  for (const [token, members] of bucket.entries()) {
    if (members.length < COHORT_THRESHOLD) {
      summary.push({ token, size: members.length, notified: 0, skipped: members.length })
      continue
    }
    // Threshold met. Notify every member with no cohort_notified_at yet.
    let notified = 0
    let skipped = 0
    for (const m of members) {
      if (m.cohort_notified_at) { skipped++; continue }

      // Pull email from auth via admin
      let email: string | null = null
      let firstName = 'there'
      try {
        const { data: u } = await admin.auth.admin.getUserById(m.user_id)
        email = u?.user?.email || null
        const nm = u?.user?.user_metadata?.name
        if (typeof nm === 'string' && nm.trim()) firstName = nm.trim().split(/\s+/)[0]
      } catch { /* keep going */ }
      if (!email) { skipped++; continue }

      if (apiKey) {
        const subject = `Your Amorlay cohort is open`
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; color: #1f2937;">
            <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 8px;">Your cohort is open, ${firstName}.</h1>
            <p style="font-size: 14px; line-height: 1.6; color: #374151;">
              Enough thoughtful people in your area have signed up - Amorlay is opening matching for your cohort.
              Open the app to confirm your intake is complete; we'll start drafting your first match memo this week.
            </p>
            <p style="margin-top: 24px;">
              <a href="${APP_HOME}/dashboard" style="background: #c8102e; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-size: 14px;">Open Amorlay</a>
            </p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
            <p style="font-size: 12px; color: #9ca3af;">Amorlay - one match, one memo, one date.</p>
          </div>
        `
        try {
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              from: 'Amorlay <welcome@inbox.kidtra.com>',
              to: [email],
              subject,
              html,
            }),
          })
          if (!r.ok) { skipped++; continue }
        } catch { skipped++; continue }
      }
      // Mark notified (idempotent)
      const { error: updErr } = await admin
        .from('matchmaker_profiles')
        .update({ cohort_notified_at: new Date().toISOString() })
        .eq('user_id', m.user_id)
      if (updErr) { skipped++; continue }
      notified++
    }
    summary.push({ token, size: members.length, notified, skipped })
  }

  return NextResponse.json({ ok: true, threshold: COHORT_THRESHOLD, cohorts: summary })
}
