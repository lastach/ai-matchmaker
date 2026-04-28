'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import OnboardingChat from './OnboardingChat';
import TrialGate from '@/components/TrialGate';

type OnboardingStep = 'profile' | 'core-intake' | 'summary' | 'attraction' | 'photos' | 'complete';

interface ProfileData {
  name?: string;
  birthDate?: string;
  gender?: string;
  pronouns?: string;
  interestedIn?: string; // 'women' | 'men' | 'nonbinary' | 'anyone'
  ownWantChildren?: string;
  bio?: string;
}

interface CoreIntakeData {
  wantChildren?: string;
  location?: string;
  locationFlexibility?: string;
  ageMin?: number;
  ageMax?: number;
  ageFlexible?: boolean;
  attractionImportance?: string;
  dealbreakers?: string[];
  dealbreakersOther?: string;
  q6Response?: string;
  q7Response?: string;
  q8Response?: string;
  q9Response?: string;
  q10Response?: string;
}

interface UserProfile {
  userId: string;
  onboardingStep: OnboardingStep;
  profileData: ProfileData;
  coreIntakeData: CoreIntakeData;
  attractionRatings: { [key: string]: 'pass' | 'maybe' | 'like' };
  attractionPhotos: string[];
  userPhotos: string[];
  depthQuestionResponses: { [key: number]: string };
  profileStrength: number;
}

// Returns a real portrait photo URL from randomuser.me that matches the user's dating preference.
// Two buckets of 99 each (men, women). Nonbinary/anyone rotates between both.
function getAvatarUrl(avatarId: string, interestedIn?: string): string {
  const n = (parseInt(avatarId, 10) % 99) + 1;
  const bucket = (() => {
    switch (interestedIn) {
      case 'men':
        return 'men';
      case 'women':
        return 'women';
      case 'nonbinary':
      case 'anyone':
      default:
        // Alternate men/women so the grid has a mix
        return (parseInt(avatarId, 10) % 2 === 0) ? 'women' : 'men';
    }
  })();
  return `https://randomuser.me/api/portraits/${bucket}/${n}.jpg`;
}

const SAMPLE_AVATARS = [
  { id: '1', name: 'Alex', initials: 'A' },
  { id: '2', name: 'Blake', initials: 'B' },
  { id: '3', name: 'Casey', initials: 'C' },
  { id: '4', name: 'Drew', initials: 'D' },
  { id: '5', name: 'Ellis', initials: 'E' },
  { id: '6', name: 'Finley', initials: 'F' },
  { id: '7', name: 'Gray', initials: 'G' },
  { id: '8', name: 'Harper', initials: 'H' },
  { id: '9', name: 'Indigo', initials: 'I' },
  { id: '10', name: 'Jordan', initials: 'J' },
  { id: '11', name: 'Kennedy', initials: 'K' },
  { id: '12', name: 'Logan', initials: 'L' },
  { id: '13', name: 'Morgan', initials: 'M' },
  { id: '14', name: 'Noble', initials: 'N' },
  { id: '15', name: 'Oak', initials: 'O' },
  { id: '16', name: 'Parker', initials: 'P' },
  { id: '17', name: 'Quinn', initials: 'Q' },
  { id: '18', name: 'Riley', initials: 'R' },
  { id: '19', name: 'Sky', initials: 'S' },
  { id: '20', name: 'Taylor', initials: 'T' },
];

const DEPTH_QUESTIONS = [
  { id: 11, text: 'What does your ideal week look like in terms of social time vs. alone time?' },
  { id: 12, text: 'How do you typically handle conflict or disagreement?' },
  { id: 13, text: 'What role does humor play in your life and relationships?' },
  { id: 14, text: 'Describe your approach to health and wellness.' },
  { id: 15, text: 'What does financial security or abundance mean to you?' },
  { id: 16, text: 'How important is creativity or artistic expression in your life?' },
  { id: 17, text: 'What\'s your relationship with ambition and career?' },
  { id: 18, text: 'How do you like to spend quality time with someone you care about?' },
  { id: 19, text: 'What\'s something you\'ve changed your mind about in the past few years?' },
  { id: 20, text: 'What would a really fulfilling partnership look like to you?' },
];

function MatchPanel({ profileData, coreIntakeData, userId }: { profileData: any; coreIntakeData: any; userId: string | undefined }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Translate the existing intake into a MatchProfile. Missing fields get conservative defaults
  // so the engine can still produce a ranked pool even before the full research-backed intake ships.
  const buildProfile = () => {
    if (!userId) return null;
    const birthDate = profileData?.birthDate;
    const today = new Date();
    const age = birthDate ? Math.floor((today.getTime() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 35;
    // Default all 12 values to 3 (neutral). Bump the user's selected top value to 5 (essential).
    const valueRatings: Record<string, number> = {
      honesty: 3, ambition: 3, family: 3, adventure: 3, stability: 3, intellect: 3,
      spirituality: 3, creativity: 3, wellness: 3, service: 3, independence: 3, playfulness: 3,
    };
    const topValueKey = (coreIntakeData?.topValue || '').toLowerCase().replace(/[^a-z]/g, '');
    if (topValueKey && valueRatings[topValueKey] !== undefined) valueRatings[topValueKey] = 5;
    // Map attachment self-report to engine label
    const attachmentMap: Record<string, string> = {
      'i feel comfortable being close and depending on others': 'secure',
      'i worry about whether my partner really cares about me': 'anxious',
      'i feel uncomfortable when things get too close': 'avoidant',
      'it feels intense and confusing': 'disorganized',
    };
    const attachmentStyle = (attachmentMap[(coreIntakeData?.attachmentSelf || '').toLowerCase()] || 'secure') as 'secure' | 'anxious' | 'avoidant' | 'disorganized';
    // Map life goal label to engine slug
    const goalMap: Record<string, string> = {
      'build career': 'build-career',
      'start a family': 'start-family',
      'travel often': 'travel-often',
      'health & wellness': 'wellness',
      'creative work': 'creative-work',
      'service / impact': 'service-impact',
    };
    const lifeGoals = coreIntakeData?.topLifeGoal && goalMap[coreIntakeData.topLifeGoal.toLowerCase()] ? [goalMap[coreIntakeData.topLifeGoal.toLowerCase()]] : [];
    // Map priority choice
    const priorityMap: Record<string, string> = {
      'actively looking for a serious partner': 'actively-looking',
      'open to something serious if it clicks': 'open-and-serious',
      'casually open, not in a rush': 'casually-open',
    };
    const relationshipPriority = (priorityMap[(coreIntakeData?.priorityChoice || '').toLowerCase()] || 'open-and-serious') as 'actively-looking' | 'open-and-serious' | 'casually-open';
    return {
      userId,
      name: profileData?.name || 'You',
      age,
      gender: profileData?.gender || 'Other',
      interestedIn: profileData?.interestedIn || 'anyone',
      location: coreIntakeData?.location || '',
      ownWantChildren: (profileData?.ownWantChildren || 'maybe').replace(/\s.*$/, '').toLowerCase().startsWith('yes')
        ? 'yes'
        : (profileData?.ownWantChildren || 'maybe'),
      preferredAgeMin: coreIntakeData?.ageMin || Math.max(21, age - 7),
      preferredAgeMax: coreIntakeData?.ageMax || Math.min(65, age + 7),
      ageFlexible: true,
      valueRatings,
      attachmentStyle,
      communicationStyle: (coreIntakeData?.q7Response && coreIntakeData.q7Response.toLowerCase().includes('right away')) ? 'direct-when-upset' : 'sit-with-it',
      lifeGoals,
      relationshipPriority,
    };
  };

  const fetchMatch = async () => {
    const profile = buildProfile();
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/match/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, n: 1 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to compute match'); return; }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMatch(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  const m = result?.matches?.[0];

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E5E7EB]">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-2xl font-bold text-[#1F2937]">Your Current Top Match</h2>
        {result && <p className="text-xs text-[#6B7280]">Scored against {result.pool_size} candidates</p>}
      </div>
      {loading && <p className="text-[#6B7280]">Scoring compatibility across attachment style, values, communication, and life goals…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {m && !loading && (
        <div className="bg-gradient-to-br from-[#D4537E]/10 to-[#2E1A47]/10 rounded-lg p-6">
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-xl font-semibold text-[#2E1A47]">{m.candidate.name}, {m.candidate.age}</p>
            <span className="text-2xl font-bold text-[#D4537E]">{m.score}</span>
          </div>
          <p className="text-sm text-[#6B7280] mb-4">{m.candidate.gender} in {m.candidate.location}. Attachment: {m.candidate.attachmentStyle}. Priority: {m.candidate.relationshipPriority.replace(/-/g, ' ')}.</p>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {[
              { label: 'Values', v: m.breakdown.values, w: 30 },
              { label: 'Attach.', v: m.breakdown.attachment, w: 25 },
              { label: 'Comm.', v: m.breakdown.communication, w: 20 },
              { label: 'Goals', v: m.breakdown.lifeGoals, w: 20 },
              { label: 'Priority', v: m.breakdown.relationshipPriority, w: 5 },
            ].map((b) => (
              <div key={b.label} className="text-center">
                <p className="text-xs text-[#6B7280]">{b.label}</p>
                <p className="text-sm font-semibold text-[#1F2937]">{Math.round(b.v * 100)}%</p>
                <div className="w-full bg-[#E5E7EB] h-1 rounded mt-1"><div className="bg-gradient-to-r from-[#D4537E] to-[#C04870] h-full rounded" style={{ width: `${Math.round(b.v * 100)}%` }} /></div>
              </div>
            ))}
          </div>
          {m.notes.length > 0 && (
            <ul className="text-sm text-[#6B7280] space-y-1 list-disc list-inside">
              {m.notes.map((n: string, i: number) => (<li key={i}>{n}</li>))}
            </ul>
          )}
          <div className="mt-4 pt-4 border-t border-[#E5E7EB] text-xs text-[#6B7280]">
            Computed from a 40-profile demo pool. Once real users complete intake, this panel will score against them with the same engine.
          </div>
        </div>
      )}
      {!m && !loading && !error && (
        <p className="text-[#6B7280] text-sm">Finish your intake to see your first scored match.</p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Core Intake state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [coreIntakeData, setCoreIntakeData] = useState<CoreIntakeData>({});
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [contextualText, setContextualText] = useState('');

  // Attraction state
  const [attractionRatings, setAttractionRatings] = useState<{ [key: string]: 'pass' | 'maybe' | 'like' }>({});

  // Photos state
  const [userPhotos, setUserPhotos] = useState<string[]>([]);
  const [attractionPhotos, setAttractionPhotos] = useState<string[]>([]);
  const [uploadedPhotosCount, setUploadedPhotosCount] = useState(0);

  // Tab state for post-onboarding
  const [activeTab, setActiveTab] = useState<'home' | 'improve' | 'settings'>('home');
  const [currentDepthQuestion, setCurrentDepthQuestion] = useState(0);
  const [depthResponses, setDepthResponses] = useState<{ [key: number]: string }>({});

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      setUser(session.user);

      // Load profile from localStorage
      const savedProfile = localStorage.getItem(`profile_${session.user.id}`);
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        setProfile(parsed);
        setCoreIntakeData(parsed.coreIntakeData || {});
        setProfileData(parsed.profileData || {});
        setAttractionRatings(parsed.attractionRatings || {});
        setUserPhotos(parsed.userPhotos || []);
        setAttractionPhotos(parsed.attractionPhotos || []);
        setDepthResponses(parsed.depthQuestionResponses || {});
      } else if (session.user.id) {
        // Initialize new profile - check if already completed onboarding
        const newProfile: UserProfile = {
          userId: session.user.id,
          onboardingStep: 'profile',
          profileData: {},
          coreIntakeData: {},
          attractionRatings: {},
          attractionPhotos: [],
          userPhotos: [],
          depthQuestionResponses: {},
          profileStrength: 0,
        };
        setProfile(newProfile);
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  const saveProfile = (updatedProfile: UserProfile) => {
    if (user?.id) {
      localStorage.setItem(`profile_${user.id}`, JSON.stringify(updatedProfile));
      setProfile(updatedProfile);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleProfileChange = (field: keyof ProfileData, value: string) => {
    setProfileData({ ...profileData, [field]: value });
  };

  const advanceFromProfile = () => {
    const errors: string[] = [];
    if (!profileData.name?.trim()) errors.push('name');
    if (!profileData.birthDate) errors.push('birthDate');
    if (!profileData.gender) errors.push('gender');
    if (!profileData.interestedIn) errors.push('interestedIn');
    if (!profileData.ownWantChildren) errors.push('ownWantChildren');
    if (errors.length > 0) {
      alert('Please fill in: ' + errors.join(', '));
      return;
    }
    const newProfile: UserProfile = {
      ...profile!,
      profileData,
      onboardingStep: 'core-intake',
      profileStrength: 20,
    };
    saveProfile(newProfile);
  };

  const restartOnboarding = () => {
    if (user?.id) {
      // Reset profile to initial onboarding state
      const resetProfile: UserProfile = {
        userId: user.id,
        onboardingStep: 'profile',
        profileData: {},
        coreIntakeData: {},
        attractionRatings: {},
        attractionPhotos: [],
        userPhotos: [],
        depthQuestionResponses: {},
        profileStrength: 0,
      };
      saveProfile(resetProfile);
      setCurrentQuestion(0);
      setContextualText('');
    }
  };

  // Core Intake Handlers
  const handleCoreIntakeChange = (field: string, value: any) => {
    const updated = { ...coreIntakeData, [field]: value };
    setCoreIntakeData(updated);
  };

  const MIN_WORDS_PER_CONVERSATIONAL = 20;
  const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  const advanceCoreIntake = () => {
    if (currentQuestion < 3) {
      // Structured questions (Q1-Q4 in the old numbering, now 0-3)
      setCurrentQuestion(currentQuestion + 1);
    } else if (currentQuestion < 9) {
      // Conversational questions (Q5-Q9, indices 3-8 after removing the old Q1)
      // Enforce minimum word count before moving on
      if (currentQuestion >= 3 && countWords(contextualText) < MIN_WORDS_PER_CONVERSATIONAL) {
        alert(`Please give this question at least ${MIN_WORDS_PER_CONVERSATIONAL} words. A thoughtful answer is the whole point of the process.`);
        return;
      }
      const qNum = currentQuestion - 3; // 0-5 for Q6-Q10 in original semantic numbering
      const questionNum = 6 + qNum;
      const responseKey = `q${questionNum}Response` as keyof CoreIntakeData;
      const updated = { ...coreIntakeData, [responseKey]: contextualText };
      setCoreIntakeData(updated);

      if (currentQuestion === 8) {
        // Complete core intake
        const newProfile: UserProfile = {
          ...profile!,
          coreIntakeData: updated,
          onboardingStep: 'attraction',
          profileStrength: 50,
        };
        saveProfile(newProfile);
        setCurrentQuestion(0);
        setContextualText('');
      } else {
        setCurrentQuestion(currentQuestion + 1);
        setContextualText('');
      }
    }
  };

  const completeCoreIntake = () => {
    const newProfile: UserProfile = {
      ...profile!,
      coreIntakeData,
      onboardingStep: 'attraction',
      profileStrength: 50,
    };
    saveProfile(newProfile);
    setCurrentQuestion(0);
  };

  // Attraction Handlers
  const rateAttraction = (avatarId: string, rating: 'pass' | 'maybe' | 'like') => {
    const updated = { ...attractionRatings, [avatarId]: rating };
    setAttractionRatings(updated);
  };

  const completeAttractionStep = () => {
    const ratingsCount = Object.keys(attractionRatings).length;
    if (ratingsCount < 5) {
      alert('Please rate at least 5 people before continuing.');
      return;
    }
    const newProfile: UserProfile = {
      ...profile!,
      attractionRatings,
      attractionPhotos,
      onboardingStep: 'photos',
      profileStrength: 70,
    };
    saveProfile(newProfile);
  };

  // Photo handlers
  const handleUserPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files) {
      const newPhotos = [...userPhotos];
      for (let i = 0; i < Math.min(files.length, 3); i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            newPhotos.push(event.target.result as string);
            setUserPhotos(newPhotos.slice(0, 3));
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleAttractionPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files) {
      const newPhotos = [...attractionPhotos];
      for (let i = 0; i < Math.min(files.length, 5); i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            newPhotos.push(event.target.result as string);
            setAttractionPhotos(newPhotos.slice(0, 5));
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const completePhotosStep = () => {
    if (userPhotos.length > 0) {
      const newProfile: UserProfile = {
        ...profile!,
        userPhotos,
        onboardingStep: 'complete',
        profileStrength: 70,
      };
      saveProfile(newProfile);
    }
  };

  // Depth question handlers
  const handleDepthResponse = (questionId: number, response: string) => {
    const updated = { ...depthResponses, [questionId]: response };
    setDepthResponses(updated);

    // Save to profile
    const newProfile: UserProfile = {
      ...profile!,
      depthQuestionResponses: updated,
      profileStrength: Math.min(100, 70 + Object.keys(updated).filter(k => (updated as any)[k]?.trim?.().length > 0).length * 3),
    };
    saveProfile(newProfile);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBF9F7]">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#D4537E] to-[#2E1A47] rounded-full mx-auto mb-4 animate-pulse"></div>
          <p className="text-[#6B7280]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  // ONBOARDING FLOWS
  if (profile.onboardingStep === 'profile' || profile.onboardingStep === 'core-intake') {
    return (
      <OnboardingChat
        initialProfile={profileData}
        initialCore={coreIntakeData}
        onComplete={(newProfile, newCore) => {
          setProfileData(newProfile);
          setCoreIntakeData(newCore);
          const updated: UserProfile = {
            ...profile!,
            profileData: newProfile,
            coreIntakeData: newCore,
            onboardingStep: 'summary',
            profileStrength: 50,
          };
          saveProfile(updated);
        }}
      />
    );
  }

  if (profile.onboardingStep === 'summary') {
    const today = new Date();
    const birth = profileData.birthDate ? new Date(profileData.birthDate) : null;
    const age = birth ? Math.floor((today.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
    const kidsLabelMap: { [k: string]: string } = {
      'yes': 'Yes, definitely',
      'Yes, definitely': 'Yes, definitely',
      'maybe': 'Maybe / open',
      'Maybe / open': 'Maybe / open',
      'no': "No, doesn't want kids",
      "No, I don't": "No, doesn't want kids",
      'have-and-want-more': 'Has kids and wants more',
      'I have kids and want more': 'Has kids and wants more',
      'have-and-done': 'Has kids and is done',
      'I have kids and am done': 'Has kids and is done',
    };
    const kidsDisplay = profileData.ownWantChildren ? (kidsLabelMap[profileData.ownWantChildren] || profileData.ownWantChildren) : '—';
    const deepAnswers: Array<[string, string | undefined]> = [
      ['Ideal future', coreIntakeData.q6Response],
      ['Handling conflict', coreIntakeData.q7Response],
      ['Ideal Saturday', coreIntakeData.q8Response],
      ['Past-relationship lesson', coreIntakeData.q9Response],
      ['What success looks like', coreIntakeData.q10Response],
    ];

    const sectionCard = (title: string, rows: Array<[string, string | null | undefined]>) => (
      <div className="bg-white rounded-2xl shadow p-6 mb-4">
        <h3 className="text-lg font-semibold text-[#1F2937] mb-3">{title}</h3>
        <dl className="divide-y divide-[#E5E7EB]">
          {rows.map(([label, val], i) => (
            <div key={i} className="py-2 grid grid-cols-1 sm:grid-cols-3 gap-1">
              <dt className="text-sm font-medium text-[#6B7280]">{label}</dt>
              <dd className="text-sm text-[#1F2937] sm:col-span-2 whitespace-pre-wrap">{val && val.toString().trim() ? val : <span className="text-[#9CA3AF] italic">not provided</span>}</dd>
            </div>
          ))}
        </dl>
      </div>
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2E1A47] via-[#3D2557] to-[#D4537E]/10 p-4">
        <div className="max-w-3xl mx-auto pt-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white">Here's what I learned about you</h1>
            <p className="text-[#D4537E]/80 text-sm mt-1">Review and refine before we move on to visual preferences.</p>
          </div>

          {sectionCard('You', [
            ['Name', profileData.name],
            ['Age', age !== null ? String(age) : null],
            ['Gender', profileData.gender],
            ['Pronouns', profileData.pronouns],
            ['Interested in dating', profileData.interestedIn],
            ['Own stance on kids', kidsDisplay],
            ['Self-description', profileData.bio],
          ])}

          {sectionCard('What you\'re looking for', [
            ['Location', coreIntakeData.location],
            ['Location flexibility', coreIntakeData.locationFlexibility],
            ['Age range', (coreIntakeData.ageMin && coreIntakeData.ageMax) ? `${coreIntakeData.ageMin} to ${coreIntakeData.ageMax}` : null],
            ['Physical attraction', coreIntakeData.attractionImportance],
            ['Dealbreakers', coreIntakeData.dealbreakersOther],
          ])}

          {sectionCard('Deeper picture', deepAnswers.map(([k, v]) => [k, v]))}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                const updated: UserProfile = {
                  ...profile!,
                  onboardingStep: 'profile',
                  profileStrength: 0,
                };
                saveProfile(updated);
              }}
              className="flex-1 py-3 px-4 border border-white/40 text-white font-semibold rounded-lg hover:bg-white/10"
            >
              Restart the conversation
            </button>
            <button
              onClick={() => {
                const updated: UserProfile = {
                  ...profile!,
                  onboardingStep: 'attraction',
                  profileStrength: 55,
                };
                saveProfile(updated);
              }}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-[#D4537E] to-[#C04870] text-white font-semibold rounded-lg hover:shadow-lg"
            >
              Looks right — continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (profile.onboardingStep === 'attraction') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2E1A47] via-[#3D2557] to-[#D4537E]/10 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-12 pt-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Show us your type</h1>
              <p className="text-[#D4537E]/80">Attraction Training • Step 2 of 3</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-white/60 hover:text-white text-sm font-medium"
            >
              Logout
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-white/20 h-2 rounded-full mb-8">
            <div
              className="bg-gradient-to-r from-[#D4537E] to-[#C04870] h-full rounded-full"
              style={{ width: '70%' }}
            ></div>
          </div>

          {/* Attraction Grid */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-[#1F2937] mb-2">Rate their vibe</h2>
            <p className="text-[#6B7280] mb-8">
              Click to rate each person. Your ratings help us find your match.
            </p>

            <div className="grid grid-cols-4 gap-4 mb-12 max-w-2xl">
              {SAMPLE_AVATARS.map((avatar) => {
                const rating = attractionRatings[avatar.id];
                const colors: { [key: string]: string } = {
                  pass: 'bg-[#E5E7EB]',
                  maybe: 'bg-[#FCD34D]',
                  like: 'bg-[#86EFAC]',
                };
                return (
                  <div key={avatar.id} className="text-center">
                    <button
                      onClick={() => {
                        // Cycle through ratings
                        if (rating === 'like') {
                          rateAttraction(avatar.id, 'pass');
                        } else if (rating === 'maybe') {
                          rateAttraction(avatar.id, 'like');
                        } else {
                          rateAttraction(avatar.id, 'maybe');
                        }
                      }}
                      className={`w-full aspect-square rounded-2xl overflow-hidden transition-all border-4 ${
                        rating === 'like'
                          ? 'border-green-400'
                          : rating === 'maybe'
                          ? 'border-yellow-400'
                          : rating === 'pass'
                          ? 'border-gray-300 opacity-60'
                          : 'border-transparent hover:border-[#D4537E]/40'
                      }`}
                    >
                      <img
                        src={getAvatarUrl(avatar.id, profileData.interestedIn)}
                        alt={`Person ${avatar.id}`}
                        className="w-full h-full object-cover bg-[#F3F0ED]"
                        loading="lazy"
                      />
                    </button>
                    <p className="text-sm text-[#6B7280] mt-2">
                      {rating === 'like' ? '💚' : rating === 'maybe' ? '💛' : rating === 'pass' ? '⚪' : ''}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* File Upload */}
            <div className="border-t border-[#E5E7EB] pt-8">
              <h3 className="text-xl font-bold text-[#1F2937] mb-4">
                Show us photos of your type (3-5 people)
              </h3>
              <p className="text-[#6B7280] mb-4">
                Upload photos of people you find attractive. This helps us understand your preferences better.
              </p>
              <label className="block border-2 border-dashed border-[#D4537E]/30 rounded-lg p-8 text-center hover:border-[#D4537E]/60 cursor-pointer transition-all">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleAttractionPhotoUpload}
                  className="hidden"
                />
                <p className="text-[#D4537E] font-semibold">Click to upload or drag and drop</p>
                <p className="text-[#6B7280] text-sm">PNG, JPG up to 10MB</p>
              </label>

              {attractionPhotos.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-semibold text-[#1F2937] mb-3">
                    Uploaded ({attractionPhotos.length}/5):
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    {attractionPhotos.map((photo, idx) => (
                      <div key={idx} className="relative w-24 h-24">
                        <img
                          src={photo}
                          alt={`Attraction ${idx + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-4 mt-8 pt-8 border-t border-[#E5E7EB]">
              <button
                onClick={() => {
                  const newProfile: UserProfile = {
                    ...profile,
                    onboardingStep: 'core-intake',
                  };
                  saveProfile(newProfile);
                }}
                className="flex-1 py-3 px-4 border border-[#D4537E] text-[#D4537E] font-semibold rounded-lg hover:bg-[#FDE9F0]"
              >
                Back
              </button>
              <button
                onClick={completeAttractionStep}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#D4537E] to-[#C04870] text-white font-semibold rounded-lg hover:shadow-lg"
              >
                Next: Upload Photos
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (profile.onboardingStep === 'photos') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2E1A47] via-[#3D2557] to-[#D4537E]/10 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-12 pt-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Your photos</h1>
              <p className="text-[#D4537E]/80">Profile Setup • Step 3 of 3</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-white/60 hover:text-white text-sm font-medium"
            >
              Logout
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-white/20 h-2 rounded-full mb-8">
            <div
              className="bg-gradient-to-r from-[#D4537E] to-[#C04870] h-full rounded-full"
              style={{ width: '85%' }}
            ></div>
          </div>

          {/* Photos Section */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-[#1F2937] mb-2">Upload 2-3 photos</h2>
            <p className="text-[#6B7280] mb-8">
              Choose photos that show your face, style, and personality. These will be visible to matches.
            </p>

            {/* Photo Requirements */}
            <div className="bg-[#F3F0ED] rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-[#1F2937] mb-3">Photo tips:</h3>
              <ul className="text-sm text-[#6B7280] space-y-2">
                <li>• One clear headshot where we can see your face</li>
                <li>• One full-body or partial body shot</li>
                <li>• One that shows your personality or interests</li>
              </ul>
            </div>

            {/* File Upload */}
            <label className="block border-2 border-dashed border-[#D4537E]/30 rounded-lg p-12 text-center hover:border-[#D4537E]/60 cursor-pointer transition-all mb-8">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleUserPhotoUpload}
                className="hidden"
              />
              <p className="text-[#D4537E] font-semibold mb-2">Click to upload or drag and drop</p>
              <p className="text-[#6B7280] text-sm">PNG, JPG up to 10MB each</p>
            </label>

            {/* Uploaded Photos */}
            {userPhotos.length > 0 && (
              <div className="mb-8">
                <p className="text-sm font-semibold text-[#1F2937] mb-4">
                  Your photos ({userPhotos.length}/3):
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {userPhotos.map((photo, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={photo}
                        alt={`Your photo ${idx + 1}`}
                        className="w-full h-40 object-cover rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {userPhotos.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
                <p className="text-sm text-yellow-800">
                  You need at least 1 photo to continue
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-4 pt-8 border-t border-[#E5E7EB]">
              <button
                onClick={() => {
                  const newProfile: UserProfile = {
                    ...profile,
                    onboardingStep: 'attraction',
                  };
                  saveProfile(newProfile);
                }}
                className="flex-1 py-3 px-4 border border-[#D4537E] text-[#D4537E] font-semibold rounded-lg hover:bg-[#FDE9F0]"
              >
                Back
              </button>
              <button
                onClick={completePhotosStep}
                disabled={userPhotos.length === 0}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#D4537E] to-[#C04870] text-white font-semibold rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // POST-ONBOARDING DASHBOARD
  return (
    <TrialGate userId={user?.id} productName="Amorlay">
    <div className="min-h-screen bg-[#FBF9F7]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E1A47] to-[#3D2557] text-white p-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Your Dashboard</h1>
          <p className="text-[#D4537E]">Welcome to Amorlay</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-semibold transition-all"
        >
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E5E7EB] bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 flex gap-6">
          {(['home', 'improve', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-2 font-semibold border-b-2 transition-all capitalize ${
                activeTab === tab
                  ? 'border-[#D4537E] text-[#D4537E]'
                  : 'border-transparent text-[#6B7280] hover:text-[#D4537E]'
              }`}
            >
              {tab === 'home' ? 'Home' : tab === 'improve' ? 'Improve Profile' : 'Settings'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {activeTab === 'home' && (
          <div className="space-y-8">
            {/* Profile Strength */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E5E7EB]">
              <h2 className="text-2xl font-bold text-[#1F2937] mb-6">Profile Strength</h2>
              <div className="flex items-center gap-6">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="#E5E7EB"
                      strokeWidth="8"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="url(#gradient)"
                      strokeWidth="8"
                      strokeDasharray={`${(profile.profileStrength / 100) * 314} 314`}
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#D4537E" />
                        <stop offset="100%" stopColor="#C04870" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-[#1F2937]">{profile.profileStrength}%</p>
                      <p className="text-xs text-[#6B7280]">Complete</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[#6B7280] mb-4">
                    Your profile is {profile.profileStrength >= 100 ? 'complete!' : 'almost ready for matches!'}
                  </p>
                  {profile.profileStrength < 100 && (
                    <button
                      onClick={() => setActiveTab('improve')}
                      className="px-6 py-2 bg-gradient-to-r from-[#D4537E] to-[#C04870] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                    >
                      Answer Depth Questions
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Match Status */}
            <MatchPanel profileData={profileData} coreIntakeData={coreIntakeData} userId={user?.id} />

</div>
        )}

        {activeTab === 'improve' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-[#1F2937] mb-2">Deepen Your Profile</h2>
              <p className="text-[#6B7280]">
                Answer a few more questions to improve match quality. Each answer increases your profile strength.
              </p>
            </div>

            {/* Depth Questions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {DEPTH_QUESTIONS.map((question) => {
                const answered = depthResponses[question.id];
                return (
                  <div
                    key={question.id}
                    onClick={() => setCurrentDepthQuestion(question.id)}
                    className={`bg-white rounded-2xl p-6 shadow-sm border-2 cursor-pointer transition-all hover:border-[#D4537E] ${
                      answered
                        ? 'border-[#86EFAC] bg-[#F0FDF4]'
                        : 'border-[#E5E7EB]'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D4537E] to-[#2E1A47] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {question.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#1F2937] text-sm leading-snug mb-2">
                          {question.text}
                        </p>
                        {answered ? (
                          <div className="text-xs text-[#6B7280] bg-white/50 rounded p-2 line-clamp-2">
                            {answered}
                          </div>
                        ) : (
                          <p className="text-xs text-[#9CA3AF]">Not answered</p>
                        )}
                      </div>
                      {answered && (
                        <div className="text-xl">✓</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal for answering */}
            {currentDepthQuestion > 0 && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8">
                  <h3 className="text-2xl font-bold text-[#1F2937] mb-4">
                    {DEPTH_QUESTIONS.find((q) => q.id === currentDepthQuestion)?.text}
                  </h3>
                  <textarea
                    value={depthResponses[currentDepthQuestion] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleDepthResponse(currentDepthQuestion, value);
                    }}
                    placeholder="Your thoughtful answer here..."
                    className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4537E] min-h-40 mb-6"
                  />
                  <div className="flex gap-4">
                    <button
                      onClick={() => setCurrentDepthQuestion(0)}
                      className="flex-1 py-3 px-4 border border-[#D4537E] text-[#D4537E] font-semibold rounded-lg hover:bg-[#FDE9F0]"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8 max-w-2xl">
            <div>
              <h2 className="text-3xl font-bold text-[#1F2937] mb-6">Profile Settings</h2>
            </div>

            {/* Basic Info */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E5E7EB]">
              <h3 className="text-xl font-bold text-[#1F2937] mb-6">Basic Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#1F2937] mb-2">Email</label>
                  <p className="text-[#6B7280]">{user?.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1F2937] mb-2">Location</label>
                  <p className="text-[#6B7280]">{coreIntakeData.location || 'Not set'}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1F2937] mb-2">Your Photos</label>
                  <p className="text-[#6B7280] mb-4">{userPhotos.length} uploaded</p>
                  {userPhotos.length > 0 && (
                    <div className="flex gap-3 flex-wrap">
                      {userPhotos.map((photo, idx) => (
                        <div key={idx} className="w-20 h-20">
                          <img
                            src={photo}
                            alt={`Your photo ${idx + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Account */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E5E7EB]">
              <h3 className="text-xl font-bold text-[#1F2937] mb-6">Account</h3>
              <div className="flex gap-3">
                <button
                  onClick={restartOnboarding}
                  className="px-6 py-3 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 transition-all"
                >
                  Restart Setup Guide
                </button>
                <button
                  onClick={handleLogout}
                  className="px-6 py-3 bg-red-50 text-red-700 font-semibold rounded-lg hover:bg-red-100 transition-all"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </TrialGate>
  );
}
