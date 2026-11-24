# Put Snap Snack on selfequity.org as an installable app

The `site/` folder is the whole app. Upload its contents (not the folder itself) to any static host with HTTPS.

```
site/
  index.html              the app (charts built in, works offline)
  manifest.webmanifest    name, colors, icons → makes it installable
  sw.js                   offline support
  icons/                  home-screen, Android and browser-tab icons
```

Rebuild after changing `index.html`: `python3 build.py <path to chart.umd.js 4.4.1>`

## Recommended address: snap.selfequity.org

A subdomain keeps the app separate from whatever is on selfequity.org now. The root domain works too, but uploading there replaces the current homepage.

## Option A: Netlify (no code, about 5 minutes)

1. Go to app.netlify.com/drop and drag in `snap-snack-site.zip` (or the `site/` folder).
2. Site settings → Domain management → Add a domain → `snap.selfequity.org`.
3. At your domain registrar's DNS settings, add the record Netlify shows you, usually:
   `CNAME  snap  →  <your-site-name>.netlify.app`
4. Wait for Netlify to show "HTTPS certificate provisioned" (minutes to an hour).

## Option B: Cloudflare Pages

Workers & Pages → Create → Pages → Upload assets → upload `site/` → Custom domains → `snap.selfequity.org`. If the domain's DNS is already on Cloudflare, the record is added for you.

## Option C: GitHub Pages (once the repo push works)

Serve `snap-snack/site` with a `CNAME` file containing `snap.selfequity.org`, and add the DNS record `CNAME snap → <github-user>.github.io`.

## Installing on a phone

- **iPhone:** open the link in Safari → Share → Add to Home Screen. The app shows a one-time tip with these steps.
- **Android:** open in Chrome → tap **Install** on the banner (or ⋮ → Install app).

It then opens full-screen from its own icon, with no browser bar, and works offline. Each phone keeps its own private log.

## Photo reading on your own domain

On selfequity.org there is no Claude sign-in, so photo reading needs an Anthropic API key. Each person adds their own under Targets → Photo AI (console.anthropic.com → API keys). It is stored only on their phone, and they pay for their own usage, roughly a cent or two per photo. Everything else works without a key.

Never put your own key into the files: anyone could read it from the page and spend on your account.
