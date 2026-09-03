import webPush from "web-push";
import { createServiceRoleClient } from "@/lib/supabase/server";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

if (publicKey && privateKey && subject) {
  webPush.setVapidDetails(subject, publicKey, privateKey);
}

interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// Sends to every target; self-heals by deleting subscriptions the push service
// reports as gone (404/410) so we stop wasting sends on dead endpoints.
// `buildPayload` lets callers personalize the message per target (e.g. streak count).
export async function sendPushNotifications<T extends PushTarget>(
  targets: T[],
  buildPayload: (target: T) => PushPayload,
) {
  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID keys are not configured");
  }

  const supabase = createServiceRoleClient();
  let sent = 0;
  let removed = 0;

  await Promise.all(
    targets.map(async (target) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          JSON.stringify(buildPayload(target)),
        );
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", target.endpoint);
          removed++;
        } else {
          console.error("[push] send failed for", target.endpoint, err);
        }
      }
    }),
  );

  return { sent, removed, total: targets.length };
}
