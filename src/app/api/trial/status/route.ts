import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * GET /api/trial/status
 *
 * Reads (and creates on first call) the user's user_subscriptions row, then
 * returns the shape TrialGate expects: { startedAt, daysRemaining, expired, plan }.
 *
 * Backed by the user_subscriptions table (see outputs/supabase/user_subscriptions_migration.sql).
 * That table is the single source of truth for access control: trial is just
 * one state of `plan`. Stripe wiring will write to the same row without schema
 * changes.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(toSet) { try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
    },
  });

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Ensure a row exists. trial_started_at defaults to now(), trial_days defaults to 14.
  await supabase
    .from("user_subscriptions")
    .upsert(
      { user_id: user.id },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

  // Read the convenience view.
  const { data: row, error: selectErr } = await supabase
    .from("current_plan")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (selectErr || !row) {
    return NextResponse.json({ error: "Subscription record unavailable" }, { status: 500 });
  }

  const trialEnds = row.trial_ends_at ? new Date(row.trial_ends_at).getTime() : null;
  const daysRemaining = trialEnds
    ? Math.max(0, Math.ceil((trialEnds - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  return NextResponse.json({
    plan: row.plan,              // trialing | active | canceled | past_due | expired
    tier: row.tier,
    billingInterval: row.billing_interval,
    startedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    trialDays: row.trial_days,
    daysRemaining,
    hasAccess: Boolean(row.has_access),
    expired: !row.has_access,
  });
}
