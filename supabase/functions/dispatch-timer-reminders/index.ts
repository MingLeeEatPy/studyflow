import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type ClaimedReminder = {
  reminder_id: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  interval_id: string;
  revision: number;
  kind: "focus" | "break" | "meditation";
  attempt_count: number;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (request) => {
  const expectedSecret = Deno.env.get("CRON_SECRET");
  const suppliedSecret = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expectedSecret || suppliedSecret !== expectedSecret) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("WEB_PUSH_VAPID_SUBJECT");
  if (!supabaseUrl || !serviceRoleKey || !publicKey || !privateKey || !subject) return json({ error: "push service is not configured" }, 503);

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await client.rpc("claim_due_timer_reminders", { batch_size: 100 });
  if (error) return json({ error: "claim failed" }, 500);

  let delivered = 0, failed = 0, retried = 0;
  for (const reminder of (data ?? []) as ClaimedReminder[]) {
    try {
      await webpush.sendNotification({ endpoint: reminder.endpoint, keys: { p256dh: reminder.p256dh, auth: reminder.auth } }, JSON.stringify({
        intervalId: reminder.interval_id,
        revision: reminder.revision,
        kind: reminder.kind,
      }), { TTL: 300, urgency: "high" });
      await client.from("timer_reminders").update({ status: "delivered", delivered_at: new Date().toISOString(), lease_until: null, last_error: null, updated_at: new Date().toISOString() }).eq("id", reminder.reminder_id).eq("status", "processing");
      delivered += 1;
    } catch (cause) {
      const statusCode = typeof cause === "object" && cause && "statusCode" in cause ? Number(cause.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) {
        await client.from("push_subscriptions").update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", reminder.subscription_id);
        await client.from("timer_reminders").update({ status: "failed", lease_until: null, last_error: `push endpoint expired (${statusCode})`, updated_at: new Date().toISOString() }).eq("id", reminder.reminder_id).eq("status", "processing");
        failed += 1;
      } else if (reminder.attempt_count < 3) {
        await client.from("timer_reminders").update({ status: "scheduled", due_at: new Date(Date.now() + 60_000).toISOString(), lease_until: null, last_error: `temporary push error (${statusCode || "unknown"})`, updated_at: new Date().toISOString() }).eq("id", reminder.reminder_id).eq("status", "processing");
        retried += 1;
      } else {
        await client.from("timer_reminders").update({ status: "failed", lease_until: null, last_error: `push failed after retries (${statusCode || "unknown"})`, updated_at: new Date().toISOString() }).eq("id", reminder.reminder_id).eq("status", "processing");
        failed += 1;
      }
    }
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  await client.from("timer_reminders").delete().in("status", ["delivered", "cancelled", "failed"]).lt("updated_at", cutoff);
  console.log(JSON.stringify({ claimed: (data ?? []).length, delivered, retried, failed }));
  return json({ claimed: (data ?? []).length, delivered, retried, failed });
});
