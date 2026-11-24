import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const TIMEOUT_MS = 5000;

// Uptime-monitor target: does one tiny database read and answers 200 if it
// completes in time, 503 otherwise. Deliberately returns no error details.
export async function GET() {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Own client with an explicit no-store fetch: Next's data cache would
    // otherwise replay the first successful response and report "ok" during
    // an outage, which defeats the whole point of the check.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: {
          fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
        },
      },
    );

    const { error } = await supabase
      .from("categories")
      .select("id")
      .limit(1)
      .abortSignal(controller.signal);

    if (error) throw error;

    return NextResponse.json(
      { ok: true, ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, ms: Date.now() - started },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    clearTimeout(timer);
  }
}
