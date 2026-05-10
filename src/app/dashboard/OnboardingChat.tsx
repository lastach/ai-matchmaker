'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Conversational onboarding. Replaces the old multi-step form for both the
 * "profile" step and the "core-intake" step with a single chat thread.
 *
 * Principles:
 *  - One question per turn, phrased naturally.
 *  - Structured fields (gender, dating preference, etc.) render quick-reply chips.
 *  - Open-ended fields use a textarea with a min-word counter.
 *  - The assistant acknowledges each answer before moving on.
 *  - Nothing is invented. If the user says "skip" on an optional question, we
 *    save an empty string and proceed. We never fill fields with made-up defaults.
 */

export type ChatProfileData = {
  name?: string;
  birthDate?: string;
  gender?: string;
  pronouns?: string;
  interestedIn?: string;
  ownWantChildren?: string;
  bio?: string;
};

export type ChatCoreIntakeData = {
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
  topValue?: string;
  attachmentSelf?: string;
  topLifeGoal?: string;
  priorityChoice?: string;
};

type Turn = {
  id: string;
  // Storage path: either a profile field or a core-intake field
  target: 'profile' | 'core' | 'derived';
  field: string;
  input: 'text' | 'longtext' | 'choices' | 'date' | 'age-range';
  prompt: (ctx: Ctx) => string;
  choices?: string[];
  optional?: boolean;
  minWords?: number;
  maxWords?: number;
  ack?: (answer: string, ctx: Ctx) => string;
  validate?: (answer: string) => string | null; // returns error message or null
};

type Ctx = { profile: ChatProfileData; core: ChatCoreIntakeData };

type Message = {
  role: 'assistant' | 'user';
  content: string;
  quickReplies?: string[];
};

const MIN_DEEP_WORDS = 20;

const TURNS: Turn[] = [
  // ═══════════════════════════════════════════════════════════
  // PHASE 1 - OPEN-ENDED CONVERSATION (no profile fields yet, no chips).
  // The point: get a real picture in the user's own words BEFORE the form.
  // ═══════════════════════════════════════════════════════════
  {
    id: 'name',
    target: 'profile',
    field: 'name',
    input: 'text',
    prompt: () =>
      "Hey - what should I call you?",
    ack: (a) => `Nice to meet you, ${a.trim().split(/\s+/)[0]}.`,
    validate: (a) => (a.trim().length === 0 ? 'I need something to call you.' : null),
  },
  {
    id: 'bringsYou',
    target: 'core',
    field: 'q6Response',
    input: 'longtext',
    minWords: MIN_DEEP_WORDS,
    prompt: () =>
      "Before we get into any details - what brings you here right now? What made you want to try something different than how dating usually goes?",
    ack: () => "Got it.",
  },
  {
    id: 'challenge',
    target: 'core',
    field: 'q7Response',
    input: 'longtext',
    minWords: MIN_DEEP_WORDS,
    prompt: () =>
      "What's been hard about dating so far? Tell me what hasn't worked, or where it tends to go sideways for you.",
    ack: () => "Got it.",
  },
  {
    id: 'goodLife',
    target: 'core',
    field: 'q8Response',
    input: 'longtext',
    minWords: MIN_DEEP_WORDS,
    prompt: () =>
      "Picture your life a few years from now in a version where things have gone really well - not Instagram-well, just actually well. What does that look like, day to day?",
    ack: () => "Got it.",
  },
  {
    id: 'pastLesson',
    target: 'core',
    field: 'q9Response',
    input: 'longtext',
    minWords: MIN_DEEP_WORDS,
    prompt: () =>
      "What's something you've learned about yourself from past relationships - good or hard - that's changed how you show up now?",
    ack: () => "Got it.",
  },
  {
    id: 'idealSaturday',
    target: 'core',
    field: 'q10Response',
    input: 'longtext',
    minWords: MIN_DEEP_WORDS,
    prompt: () =>
      "Describe a regular Saturday you'd actually want to live - not a vacation, not a highlight reel. The whole picture, who you're with, what you're doing.",
    ack: () => "Got it.",
  },
  {
    id: 'context',
    target: 'profile',
    field: 'bio',
    input: 'longtext',
    optional: true,
    prompt: () =>
      "Anything else about your life right now that I should understand - work, family, where your time goes, what you're navigating? Whatever you'd want me to actually know. (Or say \"skip\".)",
    ack: (a) =>
      a.trim().toLowerCase() === 'skip' || !a.trim()
        ? "All good - you can fill this in later." : "Thanks. That helps the picture.",
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE 2 - PROFILE BASICS (the minimum I need to match anyone at all).
  // ═══════════════════════════════════════════════════════════
  {
    id: 'birthDate',
    target: 'profile',
    field: 'birthDate',
    input: 'date',
    prompt: () => "Now a few quick basics so I can find people in the right spot for you. When were you born?",
    ack: () => "Got it.",
    validate: (a) => {
      if (!a) return 'Please pick a date.';
      const d = new Date(a);
      if (Number.isNaN(d.getTime())) return 'That date didn\'t parse, try again.';
      const now = new Date();
      const age = Math.floor((now.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) return 'Amorlay is 18+ only.';
      if (age > 99) return 'That can\'t be right - give it another shot.';
      return null;
    },
  },
  {
    id: 'gender',
    target: 'profile',
    field: 'gender',
    input: 'choices',
    choices: ['Woman', 'Man', 'Nonbinary', 'Other'],
    prompt: () => "What's your gender?",
    ack: () => "Thanks.",
  },
  {
    id: 'interestedIn',
    target: 'profile',
    field: 'interestedIn',
    input: 'choices',
    choices: ['women', 'men', 'nonbinary', 'anyone'],
    prompt: () => "Who are you looking to date?",
    ack: (a) => `Okay - I'll look for ${a}.`,
  },
  {
    id: 'pronouns',
    target: 'profile',
    field: 'pronouns',
    input: 'text',
    optional: true,
    prompt: () => "What pronouns should I use for you? (Type them, or say \"skip\".)",
    ack: (a) =>
      a.trim().toLowerCase() === 'skip' || !a.trim() ? "No problem." : `Cool - ${a.trim()}.`,
  },
  {
    id: 'location',
    target: 'core',
    field: 'location',
    input: 'text',
    prompt: () =>
      "Where do you live? City, region, or area is fine.",
    ack: (a) => `${a.trim()}. Okay.`,
    validate: (a) => (a.trim().length < 2 ? 'I need at least a city or region.' : null),
  },
  {
    id: 'locationFlexibility',
    target: 'core',
    field: 'locationFlexibility',
    input: 'choices',
    choices: [
      'Only people right here',
      'Within a reasonable drive',
      "I'd consider long-distance for the right person",
      "I'd relocate",
    ],
    prompt: () => "Would you consider someone outside that area?",
    ack: () => "Good to know.",
  },
  {
    id: 'ageRange',
    target: 'derived',
    field: 'ageRange',
    input: 'age-range',
    prompt: () =>
      "Age range you'd actually consider? Give me a span like \"28 to 38\" or \"mid 30s to mid 40s\".",
    ack: (_, ctx) =>
      ctx.core.ageMin && ctx.core.ageMax
        ? `Got it - ${ctx.core.ageMin} to ${ctx.core.ageMax}.`
        : "Got it.",
    validate: (a) => {
      const nums = (a.match(/\d{1,2}/g) || []).map(Number);
      if (nums.length < 2) return 'I need two numbers - a min age and a max age.';
      const [min, max] = [Math.min(...nums), Math.max(...nums)];
      if (min < 18) return 'Minimum age has to be 18 or over.';
      if (max > 99) return 'Max age over 99 isn\'t plausible.';
      if (max - min > 40) return 'That\'s a huge range - narrow it a bit.';
      return null;
    },
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE 3 - STRUCTURED CHOICES (last, after we have the picture).
  // ═══════════════════════════════════════════════════════════
  {
    id: 'priorityChoice',
    target: 'core',
    field: 'priorityChoice',
    input: 'choices',
    choices: [
      'Actively looking for a serious partner',
      'Open to something serious if it clicks',
      'Casually open, not in a rush',
    ],
    prompt: () => "Now a few quick ones to sharpen the match. Where are you with dating right now?",
    ack: () => "Got it.",
  },
  {
    id: 'ownWantChildren',
    target: 'profile',
    field: 'ownWantChildren',
    input: 'choices',
    choices: [
      'Yes, definitely',
      'Maybe / open',
      "No, I don't",
      'I have kids and want more',
      'I have kids and am done',
    ],
    prompt: () => "Where are you on kids?",
    ack: () => "Noted.",
  },
  {
    id: 'topLifeGoal',
    target: 'core',
    field: 'topLifeGoal',
    input: 'choices',
    choices: ['Build career', 'Start a family', 'Travel often', 'Health & wellness', 'Creative work', 'Service / impact'],
    prompt: () => "Biggest life focus over the next few years?",
    ack: (a) => `${a} - that helps.`,
  },
  {
    id: 'topValue',
    target: 'core',
    field: 'topValue',
    input: 'choices',
    choices: ['Honesty', 'Family', 'Adventure', 'Wellness', 'Creativity', 'Spirituality', 'Ambition', 'Independence'],
    prompt: () => "Of these, which matters MOST to you?",
    ack: (a) => `${a} - noted.`,
  },
  {
    id: 'attachmentSelf',
    target: 'core',
    field: 'attachmentSelf',
    input: 'choices',
    choices: [
      'I feel comfortable being close and depending on others',
      'I worry about whether my partner really cares about me',
      'I feel uncomfortable when things get too close',
      'It feels intense and confusing',
    ],
    prompt: () => "When you're in a close relationship, which sounds most like you?",
    ack: () => "Got it.",
  },
  {
    id: 'attractionImportance',
    target: 'core',
    field: 'attractionImportance',
    input: 'choices',
    choices: [
      "Very important - has to be someone I'm drawn to",
      'Matters, but chemistry can grow',
      'Less important than compatibility',
    ],
    prompt: () => "How important is physical attraction to you, really?",
    ack: () => "Thanks for being honest.",
  },
  {
    id: 'dealbreakersOther',
    target: 'core',
    field: 'dealbreakersOther',
    input: 'longtext',
    optional: true,
    prompt: () =>
      "Last one - any absolute dealbreakers? Things you won't budge on. (Type them out, or say \"none\".)",
    ack: (a) =>
      ['none', 'no', 'nope', 'nah'].includes(a.trim().toLowerCase())
        ? "Fair enough - I'll keep things open."
        : "Noted. I'll filter on that.",
  },
];
const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export default function OnboardingChat({
  initialProfile,
  initialCore,
  onComplete,
}: {
  initialProfile: ChatProfileData;
  initialCore: ChatCoreIntakeData;
  onComplete: (p: ChatProfileData, c: ChatCoreIntakeData) => void;
}) {
  const [profile, setProfile] = useState<ChatProfileData>(initialProfile);
  const [core, setCore] = useState<ChatCoreIntakeData>(initialCore);
  const [turnIndex, setTurnIndex] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const turn = TURNS[turnIndex];
  const ctx: Ctx = { profile, core };

  // Seed the first assistant message
  useEffect(() => {
    if (messages.length === 0 && turn) {
      setMessages([
        { role: 'assistant', content: turn.prompt(ctx), quickReplies: turn.choices },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoscroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  if (!turn) return null;

  const submit = async (rawAnswer: string) => {
    setError('');
    const answer = rawAnswer.trim();

    // Validate
    if (!answer && !turn.optional) {
      setError('Your reply can\'t be empty.');
      return;
    }
    if (turn.minWords && answer && countWords(answer) < turn.minWords) {
      setError(`Please give this question at least ${turn.minWords} words - a thoughtful answer is the whole point.`);
      return;
    }
    if (turn.validate) {
      const v = turn.validate(answer);
      if (v) {
        setError(v);
        return;
      }
    }

    // Save
    const newProfile = { ...profile };
    const newCore = { ...core };
    if (turn.target === 'profile') {
      (newProfile as any)[turn.field] = answer;
    } else if (turn.target === 'core') {
      (newCore as any)[turn.field] = answer;
    } else if (turn.target === 'derived' && turn.id === 'ageRange') {
      const nums = (answer.match(/\d{1,2}/g) || []).map(Number);
      newCore.ageMin = Math.min(...nums);
      newCore.ageMax = Math.max(...nums);
    }
    setProfile(newProfile);
    setCore(newCore);

    // Persist progress to localStorage so a page refresh during the intake doesn't lose answers.
    try {
      const allKeys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.includes('-auth-token'));
      const sess = allKeys.length > 0 ? JSON.parse(localStorage.getItem(allKeys[0]) || '{}') : null;
      const uid = sess?.user?.id;
      if (uid) {
        const existing = JSON.parse(localStorage.getItem(`profile_${uid}`) || '{}');
        const persisted = { ...existing, profileData: newProfile, coreIntakeData: newCore };
        localStorage.setItem(`profile_${uid}`, JSON.stringify(persisted));
      }
    } catch {}

    const userMsg: Message = { role: 'user', content: answer || '(skipped)' };

    // Optimistically append the user's message + a typing placeholder for the ack
    const baseMessages: Message[] = [...messages, userMsg];
    setMessages([...baseMessages, { role: 'assistant', content: '…' }]);
    setInput('');

    const nextIdx = turnIndex + 1;
    const nextTurn = TURNS[nextIdx];

    // For longtext (deep) questions, ask the server for a contextual ack that
    // actually reads what the user said. For short structured answers, the
    // canned ack is fine.
    let ack = ''
    const wantsClaudeAck = turn.input === 'longtext' && (answer || '').trim().length > 0
    if (wantsClaudeAck) {
      try {
        const r = await fetch('/api/intake/ack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: turn.prompt({ profile: newProfile, core: newCore }), answer }),
        })
        if (r.ok) {
          const d = await r.json()
          ack = String(d?.ack || '').trim()
        }
      } catch { /* fall back to canned */ }
    }
    if (!ack) {
      ack = turn.ack ? turn.ack(answer, { profile: newProfile, core: newCore }) : ''
    }

    // Build the final message list (replacing the typing placeholder)
    const finalMessages: Message[] = [...baseMessages]
    if (ack) finalMessages.push({ role: 'assistant', content: ack })
    if (nextTurn) {
      finalMessages.push({
        role: 'assistant',
        content: nextTurn.prompt({ profile: newProfile, core: newCore }),
        quickReplies: nextTurn.choices,
      });
    } else {
      finalMessages.push({
        role: 'assistant',
        content:
          "Okay - I've got everything I need from this conversation. I'm going to put it all together and show you what I learned. Hit Continue when you're ready.",
      });
    }
    setMessages(finalMessages);
    setTurnIndex(nextIdx);

    // If this was the last question, immediately advance to the summary view.
    // This avoids the dependency on a manual click that was leaving users stuck
    // on a white screen post-Q21 in production.
    if (!nextTurn) {
      try {
        // Give React a tick to flush the message-update render, then move on.
        setTimeout(() => {
          try { onComplete(newProfile, newCore) } catch (e) { console.error('onComplete failed', e) }
        }, 800)
      } catch {}
    }
  };

  const finished = turnIndex >= TURNS.length;


  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2E1A47] via-[#3D2557] to-[#D4537E]/10 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="pt-6 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Let's talk</h1>
            <p className="text-[#D4537E]/80 text-sm">
              {finished ? 'Chat complete' : `Question ${Math.min(turnIndex + 1, TURNS.length)} of ${TURNS.length}`}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/20 h-2 rounded-full mb-4">
          <div
            className="bg-gradient-to-r from-[#D4537E] to-[#C04870] h-full rounded-full transition-all duration-300"
            style={{ width: `${(Math.min(turnIndex, TURNS.length) / TURNS.length) * 100}%` }}
          />
        </div>

        {/* Chat thread */}
        <div
          ref={scrollRef}
          className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 mb-4 max-h-[65vh] overflow-y-auto"
        >
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 whitespace-pre-wrap leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-[#D4537E] to-[#C04870] text-white rounded-br-sm'
                      : 'bg-[#F3F0ED] text-[#1F2937] rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Input */}
        {!finished ? (
          <div className="bg-white rounded-2xl shadow p-4">
            {error && (
              <p className="text-xs text-red-600 mb-2 font-medium">{error}</p>
            )}

            {turn.input === 'choices' && (
              <div className="flex flex-wrap gap-2">
                {(turn.choices || []).map((c) => (
                  <button
                    key={c}
                    onClick={() => submit(c)}
                    className="px-4 py-2 rounded-full text-sm border border-[#E5E7EB] bg-white hover:border-[#D4537E] hover:bg-[#FDE9F0] transition"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {turn.input === 'date' && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="flex-1 px-4 py-3 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4537E]"
                />
                <button
                  onClick={() => submit(input)}
                  className="px-5 py-3 bg-gradient-to-r from-[#D4537E] to-[#C04870] text-white font-semibold rounded-lg"
                >
                  Send
                </button>
              </div>
            )}

            {(turn.input === 'text' || turn.input === 'age-range') && (
              <form
                onSubmit={(e) => { e.preventDefault(); submit(input); }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your answer…"
                  autoFocus
                  className="flex-1 px-4 py-3 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4537E]"
                />
                <button
                  type="submit"
                  className="px-5 py-3 bg-gradient-to-r from-[#D4537E] to-[#C04870] text-white font-semibold rounded-lg"
                >
                  Send
                </button>
              </form>
            )}

            {turn.input === 'longtext' && (
              <div>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={turn.optional ? "Type your answer, or write \"skip\"…" : "Type your answer…"}
                  rows={4}
                  autoFocus
                  className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4537E]"
                />
                <div className="flex items-center justify-between mt-2">
                  {turn.minWords ? (
                    <span
                      className={`text-xs ${
                        countWords(input) >= turn.minWords ? 'text-green-600' : 'text-[#6B7280]'
                      }`}
                    >
                      {countWords(input)} / {turn.minWords} words
                    </span>
                  ) : <span />}
                  <button
                    onClick={() => submit(input)}
                    disabled={!!turn.minWords && countWords(input) < turn.minWords && input.trim().toLowerCase() !== 'skip'}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#D4537E] to-[#C04870] text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow p-4 text-center">
            <button
              onClick={() => onComplete(profile, core)}
              className="px-6 py-3 bg-gradient-to-r from-[#D4537E] to-[#C04870] text-white font-semibold rounded-lg"
            >
              Continue to your profile summary
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
