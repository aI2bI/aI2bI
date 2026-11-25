// POST /functions/v1/delete-account  { confirm: "DELETE" }
// Apple requires in-app account deletion. Cancels any Stripe subscription, then deletes the user;
// every table cascades from auth.users, so all their meals, photos, health data and tokens go with it.
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const cors = { "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return reply(401, { error: "sign_in_required" });
  let confirm = "";
  try { confirm = (await req.json()).confirm; } catch { /* handled below */ }
  if (confirm !== "DELETE") return reply(400, { error: "confirmation_required" });

  const { data: profile } = await admin.from("profiles").select("stripe_customer_id").eq("user_id", user.id).single();
  if (stripeKey && profile?.stripe_customer_id) {
    const stripe = new Stripe(stripeKey);
    const subs = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: "active" });
    for (const s of subs.data) await stripe.subscriptions.cancel(s.id);
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return reply(500, { error: "delete_failed", message: "Your account couldn't be deleted. Try again or contact support." });
  return reply(200, { deleted: true });
});
