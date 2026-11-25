// Stripe → Snap Snack: keeps each profile's subscription status current.
// Deploy with --no-verify-jwt; authenticity comes from Stripe's signature instead.
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const crypto = Stripe.createSubtleCryptoProvider();
const YEARLY = Deno.env.get("STRIPE_PRICE_YEARLY");

const STATUS: Record<string, string> = {
  active: "active", trialing: "active", past_due: "past_due", unpaid: "expired",
  canceled: "canceled", incomplete: "expired", incomplete_expired: "expired", paused: "expired",
};

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), sig, Deno.env.get("STRIPE_WEBHOOK_SECRET")!, undefined, crypto);
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  if (event.type.startsWith("customer.subscription.")) {
    const sub = event.data.object as Stripe.Subscription;
    const item = sub.items.data[0];
    const end = item?.current_period_end;
    const { error } = await admin.from("profiles").update({
      sub_status: event.type === "customer.subscription.deleted" ? "canceled" : (STATUS[sub.status] ?? "expired"),
      plan: item?.price.id === YEARLY ? "yearly" : "monthly",
      current_period_end: end ? new Date(end * 1000).toISOString() : null,
      store: "stripe",
    }).eq("stripe_customer_id", typeof sub.customer === "string" ? sub.customer : sub.customer.id);
    if (error) { console.error(error); return new Response("db error", { status: 500 }); } // Stripe retries
  }
  return new Response("ok");
});
