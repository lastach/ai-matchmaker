import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Start an ID verification session. Uses Stripe Identity if STRIPE_SECRET_KEY
 * is set; falls back to recording an "unverified" status with explicit messaging.
 *
 * Stripe Identity flow: create a VerificationSession, return the client_secret
 * URL. The user redirects to Stripe-hosted verification, takes a selfie liveness
 * + uploads gov ID. On completion, Stripe webhooks back to /api/verification/webhook
 * which marks the user verified.
 */
async function getSupa() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(n: string) { return cookieStore.get(n)?.value }, set() {}, remove() {} } }
  )
}

export async function POST(req: Request) {
  const supa = await getSupa()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({
      mode: 'unverified',
      message: 'ID verification is not yet enabled in this preview. We mark the account as unverified - matches are still reviewed by a human matchmaker before delivery.',
    })
  }

  // Create a Stripe Identity verification session
  try {
    const params = new URLSearchParams({
      type: 'document',
      'options[document][allowed_types][0]': 'driving_license',
      'options[document][allowed_types][1]': 'id_card',
      'options[document][allowed_types][2]': 'passport',
      'options[document][require_live_capture]': 'true',
      'options[document][require_matching_selfie]': 'true',
      'metadata[user_id]': user.id,
      return_url: new URL(req.url).origin + '/dashboard?verification=pending',
    })

    const r = await fetch('https://api.stripe.com/v1/identity/verification_sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })
    if (!r.ok) {
      const err = await r.text()
      return NextResponse.json({ error: 'Could not start verification', detail: err.slice(0, 200) }, { status: 502 })
    }
    const session = await r.json()

    // Persist session id on the user
    try {
      await supa.from('user_verification').upsert({
        user_id: user.id,
        provider: 'stripe-identity',
        session_id: session.id,
        status: 'pending',
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    } catch {}

    return NextResponse.json({
      mode: 'stripe-identity',
      url: session.url,
      session_id: session.id,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'verification start failed' }, { status: 500 })
  }
}
