import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Client-side error logger. Browser code POSTs caught errors here so we
 * have a record beyond raw browser console. Best-effort - errors here
 * never throw back to the client.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const cookieStore = await cookies()
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(n: string) { return cookieStore.get(n)?.value }, set() {}, remove() {} } }
    )
    const { data: { user } } = await supa.auth.getUser()
    const ua = req.headers.get('user-agent') || ''
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'anon'
    const row: any = {
      user_id: user?.id || null,
      message: typeof body.message === 'string' ? body.message.slice(0, 500) : null,
      stack: typeof body.stack === 'string' ? body.stack.slice(0, 4000) : null,
      url: typeof body.url === 'string' ? body.url.slice(0, 500) : null,
      route: typeof body.route === 'string' ? body.route.slice(0, 200) : null,
      level: ['error', 'warn', 'info'].includes(body.level) ? body.level : 'error',
      user_agent: ua.slice(0, 300),
      ip,
      created_at: new Date().toISOString(),
    }
    try { await supa.from('client_errors').insert(row) } catch {}
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
