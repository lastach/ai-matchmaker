import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * GET /api/trial/status
 *
 * Reads the caller's user_trials row (creating it on first load), then returns:
 *   { startedAt, daysRemaining, expired, plan }
 *
 * The timestamp lives in Supabase with RLS — the user cannot reset it from the
 * client by clearing localStorage / cookies. The Stripe-free paywall reads this
 * and blocks access when expired.
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

  // Upsert the trial row on first call. started_at defaults to now() in the schema.
  await supabase
    .from("user_trials")
    .upsert(
      { user_id: user.id },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

  const { data: row, error: selectErr } = await supabase
    .from("user_trials")
    .select("started_at, plan, trial_days, subscribed_at")
    .eq("user_id", user.id)
    .single();

  if (selectErr || !row) {
    return NextResponse.json({ error: "Trial record unavailable" }, { status: 500 });
  }

  const started = new Date(row.started_at).getTime();
  const days = Number(process.env.NEXT_PUBLIC_TRIAL_DAYS || row.trial_days || 14);
  const trialMs = days * 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - started;
  const daysRemaining = Math.max(0, Math.ceil((trialMs - elapsed) / (24 * 60 * 60 * 1000)));
  const expired = row.plan !== "active" && elapsed >= trialMs;

  return NextResponse.json({
    startedAt: row.started_at,
    daysRemaining,
    expired,
    plan: row.plan,
    trialDays: days,
  });
}
