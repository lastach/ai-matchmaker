import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Admin gate.
 * - First: check ADMIN_EMAILS env var (legacy path, comma-separated emails).
 * - Second: query the public.admins table (post-migration path). This works once the
 *   2026-05-13 migration has applied. The query runs with the caller's JWT, and the
 *   admins_self_select RLS policy lets the caller see their own row iff they are an admin.
 * Either path returning true grants admin.
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  const env = process.env.ADMIN_EMAILS || ''
  const list = env.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  return list.includes(email.toLowerCase())
}

export async function isAdmin(email: string | null | undefined, supa: SupabaseClient): Promise<boolean> {
  if (!email) return false
  if (isAdminEmail(email)) return true
  // Fallback to admins table (RLS-bound to the caller's email)
  try {
    const { data, error } = await supa.from('admins').select('email').eq('email', email.toLowerCase()).maybeSingle()
    if (error) return false
    return !!data
  } catch {
    return false
  }
}
