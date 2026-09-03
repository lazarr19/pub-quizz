import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendPushNotifications } from "@/lib/push/send";
import { NextRequest, NextResponse } from "next/server";

interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Runs once daily in the morning: ensures today's daily challenge exists, then
// notifies every subscribed user that it's ready.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { error: ensureError } = await supabase.rpc("ensure_daily_challenge");
  if (ensureError) {
    return NextResponse.json({ error: ensureError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const targets = (data || []) as PushTarget[];
  if (targets.length === 0) {
    return NextResponse.json({ sent: 0, removed: 0, total: 0 });
  }

  const result = await sendPushNotifications(targets, () => ({
    title: "📅 Novi izazov dana je spreman!",
    body: "Odgovori na 10 pitanja i produži svoj streak.",
    url: "/dnevni-izazov",
    tag: "daily-challenge-ready",
  }));

  return NextResponse.json(result);
}
