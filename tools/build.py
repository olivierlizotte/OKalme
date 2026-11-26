#!/usr/bin/env python3
"""OKalme static generator — run from the repo root:  python3 tools/build.py

Sources                         Outputs
  src/index.html  (template)  ->  index.html, fr/index.html
  src/strings.json            ->  js/i18n.js
  posts/<slug>/meta.json      ->  journal/<slug>/index.html, fr/journal/<slug>/index.html
  posts/<slug>/en.html, fr.html
                              ->  sitemap.xml, robots.txt, llms.txt
"""
import html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://okalme.site'
LANGS = ('en', 'fr')
PREFIX = {'en': '', 'fr': '/fr'}
OG_LOCALE = {'en': 'en_CA', 'fr': 'fr_CA'}
TRACKS = [  # (slug, title, duration) — slug = cover file name = post slug when a story exists
    ('what-will-you-trade', 'What Will You Trade', '4:19'), ('the-other-hand', 'The Other Hand', '3:55'),
    ('feel-it-in-your-guts', 'Feel It In Your Guts', '4:19'), ('heads-little-butterfly', 'Heads, Little Butterfly', '2:37'),
    ('buffed-by-cream-puffs', 'Buffed by Cream Puffs', '3:31'), ('fast-asleep', 'Fast Asleep', '3:19'),
    ('what-do-you-play-for', 'What Do You Play For', '4:04'), ('by-my-side', 'By My Side', '3:22'),
    ('thorn-princess', 'Thorn Princess', '4:02'), ('we-are-here', 'We Are Here', '4:00'),
    ('one-and-done', 'One and Done', '3:10'), ('return-to-me', 'Return to Me', '3:27')]
MONTHS = {'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
          'fr': ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']}

def rd(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()
def wr(p, s):
    p = os.path.join(ROOT, p); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(s)
def esc(s): return html.escape(s, quote=True)
def fdate(d, l):
    y, m, dd = map(int, d.split('-'))
    return f'{MONTHS[l][m-1]} {dd}, {y}' if l == 'en' else f'{dd} {MONTHS[l][m-1]} {y}'
def iso_dur(t): m, s = t.split(':'); return f'PT{int(m)}M{int(s)}S'
def post_url(slug, l): return f'{PREFIX[l]}/journal/{slug}/'
def ld(obj): return '<script type="application/ld+json">\n' + json.dumps(obj, ensure_ascii=False, indent=1) + '\n</script>'

S = json.loads(rd('src/strings.json'))
def t(l, k): return S[l].get(k) or S['en'][k]

# ---------- posts ----------
posts = []
for slug in sorted(os.listdir(os.path.join(ROOT, 'posts'))):
    if not os.path.isfile(os.path.join(ROOT, 'posts', slug, 'meta.json')): continue
    m = json.loads(rd(f'posts/{slug}/meta.json'))
    m['body'] = {l: rd(f'posts/{slug}/{l}.html') for l in LANGS}
    posts.append(m)
posts.sort(key=lambda m: (m['date'], m.get('type') == 'song', -m.get('track', 0)), reverse=True)
by_slug = {p['slug']: p for p in posts}

ARTIST = {'@type': 'MusicGroup', '@id': SITE + '/#okalme', 'name': 'OKalme', 'url': SITE + '/', 'logo': SITE + '/assets/img/sigil.png'}

def alternates(path_en, path_fr):
    return (f'<link rel="canonical" href="{{canon}}">\n'
            f'<link rel="alternate" hreflang="en" href="{SITE}{path_en}">\n'
            f'<link rel="alternate" hreflang="fr" href="{SITE}{path_fr}">\n'
            f'<link rel="alternate" hreflang="x-default" href="{SITE}{path_en}">')

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&family=Shippori+Mincho+B1:wght@600;800&display=swap" rel="stylesheet">')

def post_page(m, l):
    other = 'fr' if l == 'en' else 'en'
    url = SITE + post_url(m['slug'], l)
    title, seo = m['title'][l], m['seo_title'][l]
    eyebrow = ['Journal', t(l, 'j.song' if m['type'] == 'song' else 'j.note'), fdate(m['date'], l)]
    head_extra = ''
    figure = ''
    data = {'@context': 'https://schema.org', '@type': 'BlogPosting', 'headline': title, 'description': m['description'][l],
            'inLanguage': l, 'datePublished': m['date'], 'dateModified': m.get('updated', m['date']), 'url': url,
            'mainEntityOfPage': url, 'image': SITE + m['image'], 'keywords': m['keywords'][l],
            'author': ARTIST, 'publisher': ARTIST, 'isPartOf': {'@type': 'Blog', 'name': 'OKalme Journal', 'url': SITE + PREFIX[l] + '/#/journal'}}
    if m['type'] == 'song':
        eyebrow.insert(2, f"Through Their Eyes · {'Track' if l == 'en' else 'Piste'} {m['track']:02d}")
        rec = {'@type': 'MusicRecording', 'name': m['song'], 'byArtist': ARTIST, 'duration': m['duration'], 'position': m['track'],
               'inAlbum': {'@type': 'MusicAlbum', 'name': 'Through Their Eyes, Vol. 1', 'byArtist': ARTIST}}
        if m.get('about'):
            rec['isBasedOn'] = {'@type': 'CreativeWork', 'name': m['about']}
            data['about'] = [rec, {'@type': 'CreativeWork', 'name': m['about']}]
        else:
            data['about'] = rec
        figure = (f'<figure class="post-cover"><img src="{m["image"]}" alt="{esc(m["song"])} — cover art" width="720" height="720">'
                  f'<figcaption>{esc(m["song"])} · {m["duration_label"]}</figcaption></figure>\n')
    crumbs = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': 'OKalme', 'item': SITE + PREFIX[l] + '/'},
        {'@type': 'ListItem', 'position': 2, 'name': 'Journal', 'item': SITE + PREFIX[l] + '/#/journal'},
        {'@type': 'ListItem', 'position': 3, 'name': title, 'item': url}]}
    nav = (f'<nav class="post-nav"><a href="{PREFIX[l]}/#/journal">{esc(t(l, "post.back"))}</a>'
           f'<a href="{PREFIX[l]}/#/album">{esc(t(l, "post.album"))}</a></nav>')
    return f'''<!DOCTYPE html>
<html lang="{l}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(seo)}</title>
<meta name="description" content="{esc(m['description'][l])}">
<meta name="keywords" content="{esc(m['keywords'][l])}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0b1620">
{alternates(post_url(m['slug'], 'en'), post_url(m['slug'], 'fr')).replace('{canon}', url)}
<link rel="icon" type="image/png" href="/assets/img/favicon.png">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="OKalme">
<meta property="og:locale" content="{OG_LOCALE[l]}">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(m['description'][l])}">
<meta property="og:image" content="{SITE}{m['image']}">
<meta property="article:published_time" content="{m['date']}">
<meta name="twitter:card" content="summary_large_image">
{FONTS}
<link rel="stylesheet" href="/css/style.css">
{ld(data)}
{ld(crumbs)}
</head>
<body class="post-page">
<header class="ui-top">
  <a class="brand" href="{PREFIX[l]}/" aria-label="OKalme"><img src="/assets/img/favicon.png" alt="" width="34" height="34"><span>OKalme</span></a>
  <div class="lang" role="group" aria-label="{esc(t(l, 'ui.language'))}">
    <a href="{post_url(m['slug'], 'en')}" hreflang="en" lang="en"{' aria-current="true"' if l == 'en' else ''}>EN</a>
    <a href="{post_url(m['slug'], 'fr')}" hreflang="fr" lang="fr"{' aria-current="true"' if l == 'fr' else ''}>FR</a>
  </div>
</header>
<main class="post-wrap paper">
<article class="post-body" data-slug="{m['slug']}">
<p class="eyebrow">{' · '.join(esc(e) for e in eyebrow)}</p>
<h1>{esc(title)}</h1>
{figure}{m['body'][l].strip()}
</article>
{nav}
</main>
<footer class="post-foot">© 2026 OKalme · <a href="{PREFIX[l]}/">okalme.site</a></footer>
</body>
</html>
'''

def post_card(m, l):
    kind = t(l, 'j.song' if m['type'] == 'song' else 'j.note')
    return (f'        <a class="post-card{" song" if m["type"] == "song" else ""}" href="{post_url(m["slug"], l)}" data-post="{m["slug"]}">\n'
            f'          <time datetime="{m["date"]}">{esc(kind)} · {fdate(m["date"], l)}</time>\n'
            f'          <h3>{esc(m["title"][l])}</h3>\n'
            f'          <p>{esc(m["excerpt"][l])}</p>\n'
            f'          <span class="more" data-i18n="j.read">{esc(t(l, "j.read"))}</span>\n'
            f'        </a>')

def home(l):
    s = rd('src/index.html')
    s = s.replace('<html lang="en">', f'<html lang="{l}">')
    # {{key}} placeholders (attributes) and data-i18n element text
    s = re.sub(r'\{\{([\w.]+)\}\}', lambda mm: esc(t(l, mm.group(1))), s)
    s = re.sub(r'(<[^>]*\sdata-i18n="([\w.]+)"[^>]*>)([^<]*)(<)', lambda mm: mm.group(1) + esc(t(l, mm.group(2))) + mm.group(4), s)
    s = re.sub(r'data-i18n-aria="([\w.]+)" aria-label="[^"]*"', lambda mm: f'data-i18n-aria="{mm.group(1)}" aria-label="{esc(t(l, mm.group(1)))}"', s)
    s = s.replace('data-lang="' + l + '"', 'data-lang="' + l + '" aria-current="true"')
    # journal cards
    cards = '\n'.join(post_card(m, l) for m in posts)
    cards += f'\n        <div class="post-card ghost"><h3>{esc(t(l, "j.next"))}</h3><p>{esc(t(l, "ws.soon"))}</p></div>'
    s = s.replace('<!--POSTS-->', cards)
    # in-page links to posts → real, crawlable URLs (JS opens them in the reader)
    s = re.sub(r'href="#/journal/([a-z0-9-]+)"', lambda mm: f'href="{post_url(mm.group(1), l)}" data-post="{mm.group(1)}"', s)
    # story links on tracks that have a post
    def track(mm):
        slug = mm.group(1)
        if slug not in by_slug: return mm.group(0)
        return (mm.group(0).replace('</li>', '') +
                f'<a class="story" href="{post_url(slug, l)}" data-post="{slug}" title="{esc(t(l, "album.storyTitle"))}">{esc(t(l, "album.story"))} →</a></li>')
    s = re.sub(r'<li><button type="button" data-cover="([a-z0-9-]+)">.*?</button></li>', track, s)
    # head: canonical, hreflang, og, JSON-LD
    url = SITE + PREFIX[l] + '/'
    album = {'@context': 'https://schema.org', '@type': 'MusicAlbum', '@id': SITE + '/#through-their-eyes',
             'name': 'Through Their Eyes, Vol. 1', 'byArtist': ARTIST, 'numTracks': len(TRACKS), 'inLanguage': 'en',
             'genre': ['Anime', 'Soundtrack', 'Rock', 'Electronic', 'J-rock', 'Darksynth'],
             'description': t(l, 'album.p1'), 'image': SITE + '/assets/img/through-their-eyes.jpg', 'url': url + '#/album',
             'albumProductionType': 'https://schema.org/StudioAlbum', 'albumReleaseType': 'https://schema.org/AlbumRelease',
             'track': {'@type': 'ItemList', 'numberOfItems': len(TRACKS), 'itemListElement': [
                 {'@type': 'ListItem', 'position': i + 1, 'item': dict({'@type': 'MusicRecording', 'name': n, 'duration': iso_dur(d), 'byArtist': ARTIST},
                                                                     **({'url': SITE + post_url(sl, l)} if sl in by_slug else {}))}
                 for i, (sl, n, d) in enumerate(TRACKS)]}}
    site = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'WebSite', '@id': SITE + '/#website', 'name': 'OKalme', 'url': SITE + '/', 'inLanguage': ['en', 'fr'], 'description': t(l, 'meta.description'), 'publisher': {'@id': SITE + '/#okalme'}},
        dict(ARTIST, description=t(l, 'meta.description'), genre=['Anime', 'Rock', 'Electronic']),
        {'@type': 'VideoGame', 'name': 'Geared Spirit', 'description': t(l, 'game.p1'), 'author': {'@id': SITE + '/#okalme'}, 'url': url + '#/geared-spirit', 'gamePlatform': 'TBA'},
        {'@type': 'Blog', 'name': 'OKalme Journal', 'url': url + '#/journal', 'blogPost': [
            {'@type': 'BlogPosting', 'headline': m['title'][l], 'url': SITE + post_url(m['slug'], l), 'datePublished': m['date']} for m in posts]}]}
    head = (alternates('/', '/fr/').replace('{canon}', url) + '\n'
            f'<meta property="og:url" content="{url}">\n<meta property="og:site_name" content="OKalme">\n<meta property="og:locale" content="{OG_LOCALE[l]}">\n'
            + ld(site) + '\n' + ld(album))
    s = s.replace('<!--HEAD-->', head)
    assert '{{' not in s and '<!--' not in s.split('<body>')[0].replace('<!--HEAD-->', ''), 'unresolved placeholder'
    return s

# ---------- write ----------
wr('js/i18n.js', '/* GENERATED by tools/build.py from src/strings.json — edit the JSON, not this file. */\nwindow.OK_I18N = ' + json.dumps(S, ensure_ascii=False, indent=1) + ';\n')
for l in LANGS:
    wr(('' if l == 'en' else 'fr/') + 'index.html', home(l))
    for m in posts:
        wr(post_url(m['slug'], l).lstrip('/') + 'index.html', post_page(m, l))

# sitemap with hreflang alternates
urls = [('/', '/fr/', max([p.get('updated', p['date']) for p in posts] + ['2026-11-25']))]
urls += [(post_url(p['slug'], 'en'), post_url(p['slug'], 'fr'), p.get('updated', p['date'])) for p in posts]
sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
for en, fr, mod in urls:
    for loc in (en, fr):
        sm.append(f'  <url><loc>{SITE}{loc}</loc><lastmod>{mod}</lastmod>'
                  f'<xhtml:link rel="alternate" hreflang="en" href="{SITE}{en}"/><xhtml:link rel="alternate" hreflang="fr" href="{SITE}{fr}"/>'
                  f'<xhtml:link rel="alternate" hreflang="x-default" href="{SITE}{en}"/></url>')
sm.append('</urlset>')
wr('sitemap.xml', '\n'.join(sm) + '\n')

# robots.txt — everyone welcome, AI search & assistants included
bots = ['Googlebot', 'Google-Extended', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
        'PerplexityBot', 'Perplexity-User', 'Applebot', 'Applebot-Extended', 'DuckDuckBot', 'CCBot']
wr('robots.txt', '# okalme.site — search engines and AI assistants are welcome.\n' +
   ''.join(f'User-agent: {b}\nAllow: /\n\n' for b in bots) + 'User-agent: *\nAllow: /\n\nSitemap: ' + SITE + '/sitemap.xml\n')

# llms.txt — a plain-language map for AI assistants
llms = [f'# OKalme', '', '> ' + S['en']['meta.description'], '',
        'OKalme is a family creative label from Quebec, Canada. The site exists in English (default) and French (/fr/).', '',
        '## Through Their Eyes, Vol. 1 (album, coming soon)', '',
        S['en']['album.p1'], 'Concept game for listeners: guess the manga, guess the hero, guess who is singing. Lyrics written by OKalme; music and vocals generated with Suno.', '']
for i, (sl, n, d) in enumerate(TRACKS):
    llms.append(f'- {i+1:02d}. {n} ({d})' + (f' — story: {SITE}{post_url(sl, "en")}' if sl in by_slug else ''))
llms += ['', '## Geared Spirit (upcoming game)', '', S['en']['game.p1'], '', '## Journal — stories behind the songs and the site', '']
for m in posts:
    llms.append(f'- [{m["title"]["en"]}]({SITE}{post_url(m["slug"], "en")}): {m["description"]["en"]} (French: {SITE}{post_url(m["slug"], "fr")})')
llms += ['', '## Links', '', f'- Home: {SITE}/', f'- Accueil (français): {SITE}/fr/', f'- Sitemap: {SITE}/sitemap.xml', '']
wr('llms.txt', '\n'.join(llms))

print(f'built: 2 home pages, {len(posts)} posts × 2 languages, sitemap ({len(urls)*2} urls), robots.txt, llms.txt')
