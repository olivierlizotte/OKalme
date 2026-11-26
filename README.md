# okalme.site

Static site for OKalme — no framework, no build step. English by default, French via the EN/FR toggle (`?lang=fr`).

## Structure
- `src/index.html` — template of the map page (EN text inline; `data-i18n` keys get translated at build)
- `src/strings.json` — every UI string, EN + FR (source of `js/i18n.js`)
- `posts/<slug>/` — one folder per story: `meta.json`, `en.html`, `fr.html`
- `tools/build.py` — generates `index.html`, `fr/index.html`, `journal/<slug>/`, `fr/journal/<slug>/`, `sitemap.xml`, `robots.txt`, `llms.txt`, `js/i18n.js`
- `css/style.css`, `js/main.js`, `assets/` — hand-written, not generated

**Always run `python3 tools/build.py` before committing.** Never edit generated files by hand.

## Add a song story
1. Copy `posts/what-will-you-trade/` to `posts/<song-slug>/`. The slug must match the cover file name in `assets/covers/` (and the `TRACKS` list in `tools/build.py`).
2. Edit `meta.json` (track, duration, titles, SEO title, description, keywords, `about` = the manga) and write `en.html` / `fr.html` (body only: the title, eyebrow and cover are added by the build).
3. Run the build: the track gets a “Story →” link on the album, a card in the Journal, its own EN/FR pages and sitemap entries.

## Search engines & AI assistants
- Each story is a real static page with canonical, hreflang, Open Graph and JSON-LD (BlogPosting + MusicRecording).
- `robots.txt` explicitly allows Google, Bing, OpenAI, Anthropic, Perplexity and Apple crawlers; `llms.txt` summarizes the site for AI assistants.
- Google Search Console: property `https://okalme.site/` verified (file `googleca1f2260ce614763.html` — never delete it); sitemap submitted.
- Bing & other IndexNow engines: after each deploy, run `python3 tools/indexnow.py` (key file `6e8b3759eb05a8350a634af676bd26ce.txt` — never delete it).
- For a new important page, Search Console › URL inspection › Request indexing speeds things up.
- Cloudflare: make sure AI crawlers are not blocked (Security / AI Crawl Control, "Block AI bots" and managed robots.txt).

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
