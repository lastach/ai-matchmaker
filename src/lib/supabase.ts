import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Use createBrowserClient (from @supabase/ssr) so the auth token is persisted as a
// cookie in addition to localStorage. Without this, /api/admin/users (which uses
// createServerClient and reads from request cookies) sees no session even though the
// client has one stored, returning 'auth required' and forcing /admin to render its
// empty 'Members (0)' state. SSR cookie-aware client on browser, fall back to anon
// createClient on the server (the server-side has its own createServerClient flows).
function buildClient() {
  if (typeof window === 'undefined') {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = buildClient();
