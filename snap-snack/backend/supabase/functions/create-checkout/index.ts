// POST /functions/v1/create-checkout  { plan: "monthly" | "yearly" }  → { url }
// Web subscriptions through Stripe Checkout ($9.99/month or $49/year; prices live in Stripe).
// Phone-app purchases go through Apple and Google instead (store rules).
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const PRICE = { monthly: Deno.env.get("STRIPE_PRICE_MONTHLY")!, yearly: Deno.env.get("STRIPE_PRICE_YEARLY")! };
const APP = Deno.env.get("APP_ORIGIN") ?? "https://snap.selfequity.org";
const cors = { "Access-Control-Allow-Origin": APP, "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return reply(401, { error: "sign_in_required" });

  let plan: "monthly" | "yearly";
  try { plan = (await req.json()).plan; } catch { return reply(400, { error: "bad_request" }); }
  if (plan !== "monthly" && plan !== "yearly") return reply(400, { error: "bad_plan" });

  // One Stripe customer per account, remembered on the profile.
  const { data: profile } = await admin.from("profiles").select("stripe_customer_id").eq("user_id", user.id).single();
  let customer = profile?.stripe_customer_id as string | null;
  if (!customer) {
    customer = (await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } })).id;
    await admin.from("profiles").update({ stripe_customer_id: customer }).eq("user_id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: PRICE[plan], quantity: 1 }],
    client_reference_id: user.id,
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${APP}/#targets`,
    cancel_url: `${APP}/#targets`,
    automatic_tax: { enabled: true },
  });
  return reply(200, { url: session.url });
});
