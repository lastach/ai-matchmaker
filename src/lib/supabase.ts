import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Use createBrowserClient (from @supabase/ssr) so the auth token is persisted as a
// cookie in addition to localStorage. Without this, /api/admin/users (which uses
// createServerClient and reads from request cookies) sees no session even though the
// client has one stored, returning 'auth required' and forcing /admin to render its
// empty 'Members (0)' state.
function buildClient() {
  if (typeof window === 'undefined') {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = buildClient();

// One-time migration: if the user has a session stored in localStorage (from the
// previous bare-createClient era) but no cookie, force a refreshSession() so the
// SSR client writes the auth token into the cookie jar. After this runs once,
// server-side /api/* routes will see the JWT.
if (typeof window !== 'undefined') {
  (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data?.session;
      const hasCookie = document.cookie.split(';').some(c => c.trim().startsWith('sb-'));
      if (hasSession && !hasCookie) {
        // Force the SSR client to write the cookie by triggering a refresh.
        await supabase.auth.refreshSession();
      }
    } catch {
      // ignore - this is best-effort
    }
  })();
}
