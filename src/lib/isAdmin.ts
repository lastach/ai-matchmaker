/**
 * Admin gate. A user is an admin if their auth email matches any value in
 * the ADMIN_EMAILS env var (comma-separated). Falls back to laurie.stach@gmail.com
 * if no env is set so an out-of-the-box deploy still has one admin.
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  const env = process.env.ADMIN_EMAILS || 'laurie.stach@gmail.com'
  const list = env.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  return list.includes(email.toLowerCase())
}
