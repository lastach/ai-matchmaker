'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DashboardErrorBoundary } from '../ErrorBoundary';
import BasicsStep from './BasicsStep';
import IntakeChat from './IntakeChat';
import VideoInterview from './VideoInterview';
import PhotosStep from './PhotosStep';
import AttractionRound from './AttractionRound';
import Home, { type ProfileState } from './Home';
import { api, Button, Card, Shell } from './ui';

type FullState = ProfileState & {
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>;
  intakeProgress: { covered: number; total: number };
};

/**
 * Member flow: basics -> conversation -> video interview -> photos -> your type (example photos)
 * -> home (waiting for their city, then the planned date, the date coach and the debrief).
 */
function MemberAreaInner({ area }: { area: 'start' | 'dashboard' }) {
  const router = useRouter();
  const [, setUserId] = useState<string | undefined>();
  const [state, setState] = useState<FullState | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const d = await api<FullState>('/api/v2/profile');
      // Onboarding lives at /start; the dashboard is for members who have finished it.
      if (area === 'dashboard' && d.step !== 'ready') { router.replace('/start'); return; }
      if (area === 'start' && d.step === 'ready') { router.replace('/dashboard'); return; }
      setState(d);
      setView(d.step);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [area, router]);

  // Auth, including the magic-link callback (token in the URL hash).
  useEffect(() => {
    const go = (session: any) => {
      if (!session) { router.push('/auth'); return; }
      setUserId(session.user.id);
      reload();
    };
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.slice(1));
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
          if (error || !data?.session) { router.push('/auth'); return; }
          history.replaceState(null, '', window.location.pathname);
          go(data.session);
        }).catch(() => router.push('/auth'));
        return;
      }
    }
    supabase.auth.getSession().then(({ data }) => go(data.session));
  }, [router, reload]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const goTo = async (step: string, restart?: boolean) => {
    try {
      if (restart) {
        await api('/api/v2/intake', { method: 'POST', body: JSON.stringify({ restart: true }) });
      }
      // Editing basics or continuing the conversation after onboarding only changes the view.
      const viewOnly = !restart && state?.intakeComplete && (step === 'intake' || step === 'basics')
      if (!viewOnly) {
        await api('/api/v2/profile', { method: 'POST', body: JSON.stringify({ step }) });
      }
      await reload();
      setView(step);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (error && !state) {
    return (
      <Shell onSignOut={signOut}>
        <Card>
          <p className="text-[#1F2937] font-semibold">We couldn’t load your profile.</p>
          <p className="text-sm text-[#6B7280] mt-1">{error}</p>
          <div className="mt-3"><Button onClick={reload}>Try again</Button></div>
        </Card>
      </Shell>
    );
  }
  if (!state || !view) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBF9F7]">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4537E] to-[#2E1A47] animate-pulse" />
      </div>
    );
  }

  let body: React.ReactNode;
  if (view === 'basics') body = <BasicsStep initial={state.basics || {}} onDone={reload} />;
  else if (view === 'intake') {
    body = (
      <>
        <IntakeChat key={state.conversation.length === 0 ? 'fresh' : 'resume'} initial={state.conversation} progress={state.intakeProgress} onComplete={reload} />
        {state.intakeComplete && state.step !== 'intake' && (
          <div className="mt-3"><Button variant="ghost" onClick={() => setView(state.step)}>Back to my dashboard</Button></div>
        )}
      </>
    );
  } else if (view === 'video') body = <VideoInterview onDone={reload} onSkip={() => goTo('photos')} />;
  else if (view === 'photos') body = <PhotosStep onDone={reload} />;
  else if (view === 'type') body = <AttractionRound onFinished={reload} />;
  else body = <Home state={state} goTo={goTo} reload={reload} />;

  return (
    // Early access is free (see /pricing); the subscription gate returns with checkout.
    <Shell step={view} onSignOut={signOut}>
      {body}
    </Shell>
  );
}

export default function MemberArea({ area }: { area: 'start' | 'dashboard' }) {
  return <DashboardErrorBoundary><MemberAreaInner area={area} /></DashboardErrorBoundary>;
}
