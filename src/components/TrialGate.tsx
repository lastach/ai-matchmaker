"use client";

import { useEffect, useState } from "react";

/**
 * Server-backed free-trial gate.
 *
 * Calls /api/trial/status on mount. That endpoint upserts a user_trials row in
 * Supabase (RLS: user only touches their own row) and returns:
 *   { startedAt, daysRemaining, expired, plan, trialDays }
 *
 * The trial clock lives server-side so the user cannot reset it by clearing
 * localStorage / cookies / switching browsers.
 *
 * If the endpoint is unavailable (e.g., migration not yet run, or Supabase
 * misconfigured), we fall back to letting the app render rather than hard
 * blocking — the server call is retried on next page load.
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
    | { state: "loaded"; daysRemaining: number; expired: boolean; plan: string; trialDays: number }
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
          daysRemaining: Number(data.daysRemaining) || 0,
          expired: Boolean(data.expired),
          plan: data.plan || "trial",
          trialDays: Number(data.trialDays) || 14,
        });
      } catch {
        if (!cancelled) setStatus({ state: "unavailable" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // While checking, render nothing new (the app renders around this).
  if (status.state === "loading" || status.state === "unavailable" || !userId) {
    return <>{children}</>;
  }

  if (status.expired && status.plan !== "active") {
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
      {!dismissedBanner && status.daysRemaining > 0 && status.plan === "trial" && (
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
