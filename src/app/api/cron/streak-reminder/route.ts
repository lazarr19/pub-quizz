import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendPushNotifications } from "@/lib/push/send";
import { NextRequest, NextResponse } from "next/server";

interface StreakTarget {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  streak: number;
}

// Runs once daily in the evening: nudges users whose streak is alive but who
// haven't played today, so they don't lose it.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("get_streak_reminder_targets");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const targets = (data || []) as StreakTarget[];
  if (targets.length === 0) {
    return NextResponse.json({ sent: 0, removed: 0, total: 0 });
  }

  const result = await sendPushNotifications(targets, (target) => ({
    title: "🔥 Tvoj niz je u opasnosti!",
    body: `Imaš niz od ${target.streak} ${target.streak === 1 ? "dan" : "dana"}. Odigraj danas da ga ne izgubiš.`,
    url: "/dnevni-izazov",
    tag: "streak-reminder",
  }));

  return NextResponse.json(result);
}
