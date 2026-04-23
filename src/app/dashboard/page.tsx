'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type OnboardingStep = 'core-intake' | 'attraction' | 'photos' | 'complete';

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
  coreIntakeData: CoreIntakeData;
  attractionRatings: { [key: string]: 'pass' | 'maybe' | 'like' };
  attractionPhotos: string[];
  userPhotos: string[];
  depthQuestionResponses: { [key: number]: string };
  profileStrength: number;
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

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Core Intake state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [coreIntakeData, setCoreIntakeData] = useState<CoreIntakeData>({});
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
        setAttractionRatings(parsed.attractionRatings || {});
        setUserPhotos(parsed.userPhotos || []);
        setAttractionPhotos(parsed.attractionPhotos || []);
        setDepthResponses(parsed.depthQuestionResponses || {});
      } else if (session.user.id) {
        // Initialize new profile - check if already completed onboarding
        const newProfile: UserProfile = {
          userId: session.user.id,
          onboardingStep: 'core-intake',
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

  const restartOnboarding = () => {
    if (user?.id) {
      // Reset profile to initial onboarding state
      const resetProfile: UserProfile = {
        userId: user.id,
        onboardingStep: 'core-intake',
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

  const advanceCoreIntake = () => {
    if (currentQuestion < 4) {
      // Structured questions
      setCurrentQuestion(currentQuestion + 1);
    } else if (currentQuestion < 10) {
      // Conversational questions
      const qNum = currentQuestion - 4; // 0-5 for Q6-Q10
      const questionNum = 6 + qNum; // 6-10
      const responseKey = `q${questionNum}Response` as keyof CoreIntakeData;
      const updated = { ...coreIntakeData, [responseKey]: contextualText };
      setCoreIntakeData(updated);

      if (currentQuestion === 9) {
        // Complete core intake
        const newProfile: UserProfile = {
          ...profile!,
          coreIntakeData: updated,
          onboardingStep: 'attraction',
          profileStrength: 60,
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
      profileStrength: 60,
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
        profileStrength: 100,
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
      profileStrength: Math.min(100, 100 + Object.keys(updated).length * 4),
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
  if (profile.onboardingStep === 'core-intake') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2E1A47] via-[#3D2557] to-[#D4537E]/10 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-12 pt-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Let's get to know you</h1>
              <p className="text-[#D4537E]/80">Core Intake • Step 1 of 3</p>
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
              className="bg-gradient-to-r from-[#D4537E] to-[#C04870] h-full rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / 10) * 100}%` }}
            ></div>
          </div>

          {/* Questions */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
            {currentQuestion === 0 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#1F2937] mb-1">
                    Do you want children?
                  </h2>
                  <p className="text-[#6B7280] mb-4">Choose what resonates with you</p>
                </div>
                <div className="space-y-3">
                  {[
                    'Yes definitely',
                    'Open to it',
                    'Not sure',
                    'No',
                    'Already have kids, want more',
                    'Already have kids, done',
                  ].map((option) => (
                    <button
                      key={option}
                      onClick={() => handleCoreIntakeChange('wantChildren', option)}
                      className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                        coreIntakeData.wantChildren === option
                          ? 'border-[#D4537E] bg-[#FDE9F0]'
                          : 'border-[#E5E7EB] hover:border-[#D4537E]/50'
                      }`}
                    >
                      <p className="font-semibold text-[#1F2937]">{option}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentQuestion === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#1F2937] mb-1">
                    Where do you live?
                  </h2>
                  <p className="text-[#6B7280] mb-4">And how flexible are you?</p>
                </div>
                <input
                  type="text"
                  value={coreIntakeData.location || ''}
                  onChange={(e) => handleCoreIntakeChange('location', e.target.value)}
                  placeholder="City, State"
                  className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4537E]"
                />
                <div className="space-y-3">
                  {['Rooted here', 'Open to relocating', 'Long-distance OK'].map((option) => (
                    <button
                      key={option}
                      onClick={() => handleCoreIntakeChange('locationFlexibility', option)}
                      className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                        coreIntakeData.locationFlexibility === option
                          ? 'border-[#D4537E] bg-[#FDE9F0]'
                          : 'border-[#E5E7EB] hover:border-[#D4537E]/50'
                      }`}
                    >
                      <p className="font-semibold text-[#1F2937]">{option}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentQuestion === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#1F2937] mb-1">
                    What's your age range preference?
                  </h2>
                  <p className="text-[#6B7280] mb-4">Be realistic but flexible if you want</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#1F2937] mb-2">
                      Minimum Age
                    </label>
                    <input
                      type="number"
                      value={coreIntakeData.ageMin || ''}
                      onChange={(e) => handleCoreIntakeChange('ageMin', parseInt(e.target.value) || undefined)}
                      placeholder="25"
                      className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4537E]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1F2937] mb-2">
                      Maximum Age
                    </label>
                    <input
                      type="number"
                      value={coreIntakeData.ageMax || ''}
                      onChange={(e) => handleCoreIntakeChange('ageMax', parseInt(e.target.value) || undefined)}
                      placeholder="40"
                      className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4537E]"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-3 p-4 border-2 border-[#E5E7EB] rounded-lg hover:border-[#D4537E]/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={coreIntakeData.ageFlexible || false}
                    onChange={(e) => handleCoreIntakeChange('ageFlexible', e.target.checked)}
                    className="w-5 h-5 rounded accent-[#D4537E]"
                  />
                  <span className="font-semibold text-[#1F2937]">I'm flexible about age</span>
                </label>
              </div>
            )}

            {currentQuestion === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#1F2937] mb-1">
                    How important is physical attraction?
                  </h2>
                  <p className="text-[#6B7280] mb-4">There's no wrong answer</p>
                </div>
                <div className="space-y-3">
                  {[
                    'Need strong chemistry',
                    'Important but can grow',
                    'Connection matters more',
                  ].map((option) => (
                    <button
                      key={option}
                      onClick={() => handleCoreIntakeChange('attractionImportance', option)}
                      className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                        coreIntakeData.attractionImportance === option
                          ? 'border-[#D4537E] bg-[#FDE9F0]'
                          : 'border-[#E5E7EB] hover:border-[#D4537E]/50'
                      }`}
                    >
                      <p className="font-semibold text-[#1F2937]">{option}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentQuestion === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#1F2937] mb-1">
                    Any dealbreakers?
                  </h2>
                  <p className="text-[#6B7280] mb-4">Check what matters to you</p>
                </div>
                <div className="space-y-3">
                  {[
                    'No smoking',
                    'Substance use matters',
                    'Drinking matters',
                    'Political alignment',
                    'Faith alignment',
                    'Pets matter',
                  ].map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-3 p-4 border-2 border-[#E5E7EB] rounded-lg hover:border-[#D4537E]/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(coreIntakeData.dealbreakers || []).includes(option)}
                        onChange={(e) => {
                          const current = coreIntakeData.dealbreakers || [];
                          const updated = e.target.checked
                            ? [...current, option]
                            : current.filter((d) => d !== option);
                          handleCoreIntakeChange('dealbreakers', updated);
                        }}
                        className="w-5 h-5 rounded accent-[#D4537E]"
                      />
                      <span className="font-semibold text-[#1F2937]">{option}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1F2937] mb-2">
                    Anything else?
                  </label>
                  <textarea
                    value={coreIntakeData.dealbreakersOther || ''}
                    onChange={(e) => handleCoreIntakeChange('dealbreakersOther', e.target.value)}
                    placeholder="Tell us about any other dealbreakers..."
                    className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4537E] min-h-24"
                  />
                </div>
              </div>
            )}

            {currentQuestion >= 5 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#1F2937] mb-1">
                    {
                      [
                        'What does a really good life look like to you a few years from now?',
                        'When something is bothering you in a relationship, what\'s your instinct — talk about it right away, sit with it, or hope it resolves itself?',
                        'Describe your ideal Saturday — not a vacation, just a regular nothing-special Saturday.',
                        "What's one thing you've learned about yourself from past relationships that changed how you show up now?",
                        'What would make you feel like this process really worked — even if the first match isn\'t \'the one\'?',
                      ][currentQuestion - 5]
                    }
                  </h2>
                  <p className="text-[#6B7280] mb-4">Be honest and thoughtful</p>
                </div>
                <textarea
                  value={contextualText}
                  onChange={(e) => setContextualText(e.target.value)}
                  placeholder="Your answer..."
                  className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4537E] min-h-32"
                />
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-4 mt-8 pt-8 border-t border-[#E5E7EB]">
              <button
                onClick={() => {
                  if (currentQuestion > 0) {
                    setCurrentQuestion(currentQuestion - 1);
                    setContextualText('');
                  }
                }}
                disabled={currentQuestion === 0}
                className="flex-1 py-3 px-4 border border-[#D4537E] text-[#D4537E] font-semibold rounded-lg hover:bg-[#FDE9F0] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
              <button
                onClick={advanceCoreIntake}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#D4537E] to-[#C04870] text-white font-semibold rounded-lg hover:shadow-lg"
              >
                {currentQuestion === 9 ? 'Complete' : 'Next'}
              </button>
            </div>
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
                      className={`w-full aspect-square rounded-2xl flex items-center justify-center text-4xl font-bold transition-all ${
                        rating ? colors[rating] : 'bg-[#F3F0ED] hover:bg-[#E5DFD9]'
                      }`}
                    >
                      {avatar.initials}
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
    <div className="min-h-screen bg-[#FBF9F7]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E1A47] to-[#3D2557] text-white p-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Your Dashboard</h1>
          <p className="text-[#D4537E]">Welcome to AI Matchmaker</p>
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
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E5E7EB]">
              <h2 className="text-2xl font-bold text-[#1F2937] mb-6">Your First Match</h2>
              <div className="bg-gradient-to-br from-[#D4537E]/10 to-[#2E1A47]/10 rounded-lg p-8 text-center">
                <p className="text-[#D4537E] font-semibold mb-2">Your first match is being prepared</p>
                <p className="text-[#6B7280]">We estimate it'll be ready in 2-3 days</p>
              </div>
            </div>

            {/* Sample Match Card */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E5E7EB]">
              <h2 className="text-2xl font-bold text-[#1F2937] mb-6">Sample Match</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Profile Section */}
                <div>
                  <div className="flex gap-4 mb-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-[#D4537E] to-[#2E1A47] rounded-full flex items-center justify-center text-white text-2xl font-bold">
                      S
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-[#1F2937]">Jordan</h3>
                      <p className="text-[#6B7280]">32, Creative Professional</p>
                      <p className="text-sm text-[#D4537E] mt-1">Lives in Portland, OR</p>
                    </div>
                  </div>

                  {/* Photo placeholders */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="w-full aspect-square bg-gradient-to-br from-[#D4537E]/20 to-[#2E1A47]/20 rounded-lg flex items-center justify-center">
                      <p className="text-[#D4537E] text-sm">Photo 1</p>
                    </div>
                    <div className="w-full aspect-square bg-gradient-to-br from-[#2E1A47]/20 to-[#D4537E]/20 rounded-lg flex items-center justify-center">
                      <p className="text-[#2E1A47] text-sm">Photo 2</p>
                    </div>
                  </div>

                  {/* Why You'd Click */}
                  <div className="bg-[#F3F0ED] rounded-lg p-6 mb-6">
                    <h4 className="font-bold text-[#1F2937] mb-3">Why You Two Would Click</h4>
                    <p className="text-sm text-[#6B7280] leading-relaxed">
                      Jordan values deep conversations and travel just like you. Both of you prioritize authenticity in relationships and have similar approaches to life goals. The AI noticed you both appreciate creativity and meaningful connection over surface-level interactions.
                    </p>
                  </div>

                  {/* CTA */}
                  <button className="w-full py-3 bg-gradient-to-r from-[#D4537E] to-[#C04870] text-white font-semibold rounded-lg hover:shadow-lg transition-all">
                    Schedule a Date
                  </button>
                </div>

                {/* Stats */}
                <div className="space-y-4">
                  <div className="border border-[#E5E7EB] rounded-lg p-4">
                    <p className="text-sm text-[#6B7280] mb-1">Compatibility Score</p>
                    <p className="text-3xl font-bold text-[#D4537E]">87%</p>
                  </div>
                  <div className="border border-[#E5E7EB] rounded-lg p-4">
                    <p className="text-sm text-[#6B7280] mb-2">Core Values Alignment</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6B7280]">Life Goals</span>
                        <span className="font-semibold text-[#1F2937]">90%</span>
                      </div>
                      <div className="w-full bg-[#E5E7EB] h-2 rounded-full">
                        <div className="bg-gradient-to-r from-[#D4537E] to-[#C04870] h-full rounded-full" style={{ width: '90%' }}></div>
                      </div>
                    </div>
                    <div className="space-y-2 mt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6B7280]">Lifestyle</span>
                        <span className="font-semibold text-[#1F2937]">85%</span>
                      </div>
                      <div className="w-full bg-[#E5E7EB] h-2 rounded-full">
                        <div className="bg-gradient-to-r from-[#D4537E] to-[#C04870] h-full rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>
                    <div className="space-y-2 mt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6B7280]">Values</span>
                        <span className="font-semibold text-[#1F2937]">82%</span>
                      </div>
                      <div className="w-full bg-[#E5E7EB] h-2 rounded-full">
                        <div className="bg-gradient-to-r from-[#D4537E] to-[#C04870] h-full rounded-full" style={{ width: '82%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
  );
}
