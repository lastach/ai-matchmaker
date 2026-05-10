-- Approved matches awaiting brief generation and delivery.
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending_brief', -- pending_brief, brief_generated, delivered, accepted, declined, expired
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  admin_notes TEXT,
  brief_text TEXT,
  delivered_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, candidate_user_id)
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Users can read their own matches (either side)
CREATE POLICY "Users can read own matches" ON public.matches
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = candidate_user_id);

-- Only service_role inserts/updates (admin-approve and brief pipeline)
CREATE POLICY "service role full access" ON public.matches
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
