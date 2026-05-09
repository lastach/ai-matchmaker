import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const APP_NAME = 'Amorlay'
const APP_HOME = 'https://www.amorlay.com'
const APP_TAGLINE = 'One match. One memo. One date.'
const APP_NEXT_STEP = 'Finish your intake so we can start matching against the right values, attachment style, and life goals - not just a swipe.'

/**
 * POST /api/auth/welcome
 * Idempotent. Sends a one-time welcome email after signup. Skips if user.user_metadata.welcome_sent === true.
 */
export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }) } catch {} },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }) } catch {} },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return NextResponse.json({ skipped: 'no-user' })
  if (user.user_metadata?.welcome_sent) return NextResponse.json({ skipped: 'already-sent' })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ skipped: 'no-resend-key' })

  const from = `${APP_NAME} <welcome@inbox.kidtra.com>`
  const subject = `Welcome to ${APP_NAME}`
  const firstName = (user.user_metadata?.name || user.email.split('@')[0]).split(' ')[0]
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 8px;">Welcome, ${firstName}.</h1>
      <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px;">${APP_TAGLINE}</p>
      <p style="font-size: 14px; line-height: 1.6;">${APP_NEXT_STEP}</p>
      <p style="margin-top: 24px;">
        <a href="${APP_HOME}/dashboard" style="background: #1f2937; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-size: 14px;">Open ${APP_NAME}</a>
      </p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
      <p style="font-size: 12px; color: #9ca3af;">You received this because you created a ${APP_NAME} account. Reply if you have questions - we read everything.</p>
    </div>
  `
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: [user.email], subject, html }),
  })
  if (!r.ok) {
    const err = await r.text()
    return NextResponse.json({ error: 'resend: ' + err.slice(0, 200) }, { status: 502 })
  }

  // Mark welcome_sent in user_metadata
  try {
    await supabase.auth.updateUser({ data: { welcome_sent: true, welcome_sent_at: new Date().toISOString() } })
  } catch {}

  return NextResponse.json({ ok: true })
}
