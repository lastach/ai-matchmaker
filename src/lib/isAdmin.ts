/**
 * Admin gate. A user is an admin if their auth email matches any value in
 * the ADMIN_EMAILS env var (comma-separated). If the env var is unset, no
 * user is admin and the route fails closed. Set ADMIN_EMAILS in Vercel for
 * each deployment that needs an admin. We intentionally do NOT hardcode a
 * fallback email here because this repo is public.
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  const env = process.env.ADMIN_EMAILS || ''
  const list = env.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  return list.includes(email.toLowerCase())
}
