// POST /functions/v1/ai  { image_base64, media_type }  (Authorization: Bearer <user's session token>)
// Reads one food photo with Claude on Snap Snack's own API key. Requires an active trial or subscription,
// enforces a daily cap against abuse, and records tokens and cost for every call.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { analyzePhoto, costUsd, MODELS, type Model, RefusedError } from "../_shared/nutrition.ts";

const MODEL = (Deno.env.get("SNAP_MODEL") ?? "claude-opus-5-5") as Model;      // set after the model test
const DAILY_CAP = Number(Deno.env.get("SNAP_DAILY_PHOTO_CAP") ?? "40");         // stops one account running up the bill
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MEDIA = new Set(["image/jpeg", "image/png", "image/webp"]);

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
  if (!MODELS.includes(MODEL)) return reply(500, { error: "server_misconfigured" });

  // Who is asking?
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return reply(401, { error: "sign_in_required", message: "Sign in to read photos." });

  // Trial or subscription?
  const { data: access } = await admin.rpc("has_access", { uid: user.id });
  if (!access) return reply(402, { error: "subscription_required", message: "Your free week has ended. Subscribe to keep snapping." });

  // Daily cap
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("ai_usage").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("kind", "photo").gte("at", since);
  if ((count ?? 0) >= DAILY_CAP) return reply(429, { error: "daily_limit", message: `You've reached ${DAILY_CAP} photos in 24 hours. Try again later.` });

  // Input
  let body: { image_base64?: string; media_type?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "bad_request", message: "Send JSON." }); }
  const image = body.image_base64 ?? "";
  const media = body.media_type ?? "image/jpeg";
  if (!image || !MEDIA.has(media)) return reply(400, { error: "bad_image", message: "Send a JPEG, PNG or WebP photo." });
  if (image.length * 0.75 > MAX_IMAGE_BYTES) return reply(413, { error: "image_too_large", message: "Resize the photo to under 5 MB." });

  try {
    const r = await analyzePhoto(anthropic, MODEL, image, media as "image/jpeg");
    await admin.from("ai_usage").insert({
      user_id: user.id, kind: "photo", model: r.model, input_tokens: r.inputTokens, output_tokens: r.outputTokens,
      cost_usd: costUsd(MODEL, r.inputTokens, r.outputTokens), ok: true,
    });
    return reply(200, r.result);
  } catch (err) {
    await admin.from("ai_usage").insert({ user_id: user.id, kind: "photo", model: MODEL, ok: false });
    if (err instanceof RefusedError) return reply(422, { error: "not_analyzed", message: "That photo couldn't be read. Add the items by hand." });
    if (err instanceof Anthropic.RateLimitError) return reply(503, { error: "busy", message: "Photo reading is busy. Try again in a minute." });
    if (err instanceof Anthropic.APIError) { console.error("anthropic", err.status, err.message); return reply(502, { error: "ai_error", message: "Photo reading failed. Try again." }); }
    if (err instanceof SyntaxError) return reply(502, { error: "ai_error", message: "Photo reading returned an unreadable answer. Try again." });
    console.error(err);
    return reply(500, { error: "server_error", message: "Something went wrong. Try again." });
  }
});
