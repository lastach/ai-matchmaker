"use client";

import { useEffect, useState } from "react";

/**
 * Subscription-aware access gate.
 *
 * Calls /api/trial/status, which reads the server-backed user_subscriptions
 * row (RLS: user only touches their own) and returns:
 *   { plan, daysRemaining, hasAccess, expired, trialEndsAt, ... }
 *
 * While hasAccess is true (trialing with days left OR active paid), render
 * children + a dismissible banner during trial. When hasAccess is false,
 * render the soft paywall. Stripe wiring replaces the disabled button later
 * without touching this component.
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
  const [status, setStatus] = useState<
    | { state: "loading" }
    | { state: "loaded"; plan: string; daysRemaining: number; hasAccess: boolean; trialDays: number }
    | { state: "unavailable" }
  >({ state: "loading" });
  const [dismissedBanner, setDismissedBanner] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trial/status", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (cancelled) return;
        setStatus({
          state: "loaded",
          plan: data.plan || "trialing",
          daysRemaining: Number(data.daysRemaining) || 0,
          hasAccess: Boolean(data.hasAccess),
          trialDays: Number(data.trialDays) || 14,
        });
      } catch {
        if (!cancelled) setStatus({ state: "unavailable" });
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (status.state === "loading" || status.state === "unavailable" || !userId) {
    return <>{children}</>;
  }

  if (!status.hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your free trial of {productName} has ended</h1>
          <p className="text-gray-600 mb-6">
            You had {status.trialDays} days to try every feature. To keep using {productName}, subscribe below. Your data stays attached to your account.
          </p>
          <button
            disabled
            title="Subscribe flow launches once Stripe is connected."
            className="w-full py-3 px-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-semibold rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Subscribe (coming soon)
          </button>
          <p className="text-xs text-gray-500 mt-4">
            Subscription checkout via Stripe will launch shortly.
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
      {!dismissedBanner && status.plan === "trialing" && status.daysRemaining > 0 && (
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 border-b border-rose-200">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between text-sm">
            <span className="text-rose-900">
              <strong>{status.daysRemaining}</strong> day{status.daysRemaining === 1 ? "" : "s"} left in your free trial of {productName}.
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
