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
  ;(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const hasCookie = document.cookie.split(';').some(c => c.trim().startsWith('sb-'));
      // Case A: session in store (cookie or new localStorage), no cookie yet -> refresh to write cookie.
      if (data?.session && !hasCookie) {
        await supabase.auth.refreshSession();
        return;
      }
      // Case B: no session via the new SSR client, but the OLD bare-createClient
      // stored a token under sb-<project>-auth-token in localStorage. Read it and
      // call setSession() so the SSR client adopts it AND writes the cookie.
      if (!data?.session && !hasCookie) {
        const projectRef = (supabaseUrl.match(/https:\/\/([^\.]+)\./) || [])[1];
        if (projectRef) {
          const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              const access_token = parsed?.access_token || parsed?.currentSession?.access_token;
              const refresh_token = parsed?.refresh_token || parsed?.currentSession?.refresh_token;
              if (access_token && refresh_token) {
                await supabase.auth.setSession({ access_token, refresh_token });
              }
            } catch {}
          }
        }
      }
    } catch {
      // best-effort - ignore
    }
  })();
}
