import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const body = await req.text()
  let event: any
  try { event = JSON.parse(body) } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  // Stripe Identity events: identity.verification_session.verified | requires_input | canceled
  if (!event?.type?.startsWith('identity.verification_session.')) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const sessionId = event?.data?.object?.id
  const status = event?.type.replace('identity.verification_session.', '')
  if (!sessionId) return NextResponse.json({ error: 'no session id' }, { status: 400 })

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  try {
    await supa.from('user_verification').update({
      status,
      verified_at: status === 'verified' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('session_id', sessionId)
  } catch {}

  return NextResponse.json({ ok: true })
}
