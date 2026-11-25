# okalme.site

Static site for OKalme — no framework, no build step. English by default, French via the EN/FR toggle (`?lang=fr`).

## Structure
- `index.html` — the whole site (3×3 "ink map"; falls back to a normal scroll without JS)
- `css/style.css` — palette from the family sigil
- `js/i18n.js` — every UI string, EN + FR
- `js/main.js` — map navigation, hash routing (`#/album`, `#/geared-spirit`, `#/workshop`, `#/journal`, `#/journal/<slug>`)
- Blog posts: `<template id="post-<slug>-en|fr">` blocks at the bottom of `index.html`
- `CNAME` (okalme.site), `.nojekyll`, `404.html`, `robots.txt`, `sitemap.xml`

## Add a blog post
1. Copy one `<template id="post-...-en">` / `-fr` pair, change the slug.
2. Add a `.post-card` in the Journal section linking to `#/journal/<slug>` (+ its strings in `js/i18n.js`).

## Deploy (GitHub Pages + Cloudflare)
```
git init && git checkout -b gh-pages
git add . && git commit -m "OKalme v0"
git remote add origin git@github.com:olivierlizotte/okalme.git
git push -u origin gh-pages
```
GitHub › Settings › Pages: source `gh-pages` / root, custom domain `okalme.site`, Enforce HTTPS.

Cloudflare DNS (okalme.site):
- `A @` → 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
- `CNAME www` → olivierlizotte.github.io
- "DNS only" until GitHub issues the certificate, then SSL/TLS mode **Full**.
