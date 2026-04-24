"use client";

import { useEffect, useState } from "react";

/**
 * Free-trial gating.
 *
 * - On first mount we record trialStartedAt in the user-scoped localStorage key `trial:started`.
 * - While within NEXT_PUBLIC_TRIAL_DAYS (default 14), we render {children} plus a dismissible
 *   banner showing days remaining.
 * - After the trial window elapses, {children} is hidden behind a soft paywall card. The user
 *   can still sign out; no Subscribe button is wired yet because Stripe keys are not configured.
 *
 * Stripe wiring will later replace the onSubscribe stub. That one change flips the app from
 * "placeholder paywall" to "real checkout" without any other UI plumbing.
 */
export default function TrialGate({
  userId,
  children,
  productName,
}: {
  userId: string | undefined;
  children: React.ReactNode;
  productName: string;
}) {
  const [trialStartedAt, setTrialStartedAt] = useState<number | null>(null);
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const days = Number(process.env.NEXT_PUBLIC_TRIAL_DAYS || 14);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const storageKey = `ls:${userId}:trial:started`;
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
      setTrialStartedAt(Number(existing));
    } else {
      const now = Date.now();
      window.localStorage.setItem(storageKey, String(now));
      setTrialStartedAt(now);
    }
  }, [userId]);

  if (!userId || trialStartedAt === null) return <>{children}</>;

  const elapsedMs = Date.now() - trialStartedAt;
  const trialMs = days * 24 * 60 * 60 * 1000;
  const daysRemaining = Math.max(0, Math.ceil((trialMs - elapsedMs) / (24 * 60 * 60 * 1000)));
  const expired = elapsedMs >= trialMs;

  if (expired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your free trial of {productName} has ended</h1>
          <p className="text-gray-600 mb-6">
            You had {days} days to try every feature. To keep using {productName}, subscribe below.
          </p>
          <button
            disabled
            title="Subscribe flow launches once Stripe is connected."
            className="w-full py-3 px-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-semibold rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Subscribe (coming soon)
          </button>
          <p className="text-xs text-gray-500 mt-4">
            Subscription checkout via Stripe will launch shortly. Your profile and data are preserved \u2014 nothing is deleted.
          </p>
          <button
            onClick={() => {
              if (confirm("Sign out? Your data stays attached to this account.")) {
                window.location.href = "/";
              }
            }}
            className="mt-4 text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {!dismissedBanner && daysRemaining > 0 && (
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 border-b border-rose-200">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between text-sm">
            <span className="text-rose-900">
              <strong>{daysRemaining}</strong> day{daysRemaining === 1 ? "" : "s"} left in your free trial of {productName}.
            </span>
            <button
              onClick={() => setDismissedBanner(true)}
              className="text-rose-700 hover:text-rose-900 text-xs"
              aria-label="Dismiss trial banner"
            >
              &times;
            </button>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
