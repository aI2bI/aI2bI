# Snap Snack backend (Supabase)

Lets Snap Snack run on the web and in the App Store and Google Play with no Claude account: our server reads photos with Snap Snack's own Anthropic API key.

Project: `snap-snack` (Supabase organization "SeLFeQuiTy USA", region us-east-1).

## What's here

| Path | What it does |
|---|---|
| `supabase/migrations/` | Database: accounts with a 7-day unlimited trial, subscriptions, each user's meals / daily log / settings, AI usage and cost, wearable data. Every table is private per user. Applied. |
| `supabase/functions/ai` | Reads a food photo with Claude. Checks trial/subscription, caps photos per day (default 40), records tokens and cost. |
| `supabase/functions/create-checkout` | Starts a Stripe subscription on the web: $9.99/month or $49/year. |
| `supabase/functions/stripe-webhook` | Keeps each account's subscription status in sync with Stripe. |
| `supabase/functions/delete-account` | In-app account deletion (an App Store requirement). Cancels Stripe and deletes all the user's data. |
| `supabase/functions/_shared/nutrition.ts` | The photo prompt and answer format, shared with the model test. |
| `eval/` | The photo-model test: accuracy and real cost of Claude Opus 5.5, Sonnet 5.5 and Haiku 5.5 on meals you weighed. |

## Keys to add (Supabase dashboard → Edge Functions → Secrets)

Never paste these into a chat or commit them.

| Secret | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys. Set a monthly spend limit there too. |
| `SNAP_MODEL` | After the model test, e.g. `claude-haiku-5-5`. Defaults to `claude-opus-5-5`. |
| `SNAP_DAILY_PHOTO_CAP` | Optional; defaults to 40 photos per account per 24 hours. |
| `APP_ORIGIN` | The app's web address, e.g. `https://snap.selfequity.org`. |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys (start with the test-mode key). |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | Create one product "Snap Snack" with two recurring prices ($9.99/month, $49/year); copy each price ID. |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → add endpoint `https://sfsedszatxizmyyvezcp.supabase.co/functions/v1/stripe-webhook` for `customer.subscription.*` events. |

## Deploy

```
supabase functions deploy ai create-checkout delete-account --project-ref sfsedszatxizmyyvezcp
supabase functions deploy stripe-webhook --no-verify-jwt --project-ref sfsedszatxizmyyvezcp
```

## Still to build

- App side: sign-in, sync of meals to these tables, calling `ai` for photos, the subscribe screen, account deletion.
- Store purchases (Apple and Google in-app subscriptions) feeding the same `profiles` table.
- Wearables: the multi-brand connection service now; direct Garmin and Fitbit connections once approved.
