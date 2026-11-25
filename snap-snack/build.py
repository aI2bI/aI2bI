"""Build outputs from index.html (the single source):
  - snap-snack-share.html : standalone copy with Chart.js embedded (works offline, own data per device)
  - <out_dir>/snap-snack.html : body-only page for publishing as a claude.ai artifact
Usage: python3 build.py <path to chart.umd.js 4.4.1> [artifact_out_dir]"""
import sys, os
src = open("index.html").read()
chart = open(sys.argv[1]).read().replace("</script", "<\\/script")
tag = '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>'
assert src.count(tag) == 1
icon = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23FF5A36'/%3E"
        "%3Cpath d='M14 24h8l5-8h10l5 8h8v26H14z' fill='none' stroke='white' stroke-width='4' stroke-linejoin='round'/%3E"
        "%3Ccircle cx='32' cy='36' r='8' fill='none' stroke='white' stroke-width='4'/%3E%3C/svg%3E")
share = src.replace(tag, "<script>/* Chart.js 4.4.1 (MIT License, chartjs.org), embedded so this file works offline */\n" + chart + "\n</script>")
share = share.replace("</head>", f'''<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Snap Snack">
<link rel="icon" href="{icon}">
</head>''', 1).replace("<!--ARTIFACT-START-->\n", "").replace("<!--ARTIFACT-END-->\n", "")
open("snap-snack-share.html", "w").write(share)
# Snap Snack's Supabase project. The publishable key is meant to ship in apps: the database's per-user rules
# decide what it can reach. Only the hosted site gets it, so it reads photos through Snap Snack's own server.
SERVER_URL = "https://sfsedszatxizmyyvezcp.supabase.co"
SERVER_KEY = "sb_publishable_ObSsn5r9buLuqq5eHVznuA_Zyne3O2q"
# Installable web app for hosting on a domain (site/): manifest, icons, offline service worker, install prompt.
site = share.replace('<link rel="icon" href="' + icon + '">', """<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="icon" type="image/svg+xml" href="icons/icon.svg">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<script>window.SNAP_SERVER = {url: "%s", key: "%s"};</script>""" % (SERVER_URL, SERVER_KEY), 1)
site = site.replace("</body>", open("install.inc.html").read() + "</body>", 1)
os.makedirs("site", exist_ok=True)
open("site/index.html", "w").write(site)
if len(sys.argv) > 2:
    a = src.index("<!--ARTIFACT-START-->\n") + len("<!--ARTIFACT-START-->\n")
    open(os.path.join(sys.argv[2], "snap-snack.html"), "w").write(src[a:src.index("<!--ARTIFACT-END-->")])
print("built")
