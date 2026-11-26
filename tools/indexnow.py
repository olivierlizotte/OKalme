#!/usr/bin/env python3
"""Notify Bing (and other IndexNow engines) after a deploy: python3 tools/indexnow.py
Sends every URL in sitemap.xml. Run it once the push to gh-pages is live."""
import json, os, re, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = '6e8b3759eb05a8350a634af676bd26ce'  # must match /<KEY>.txt at the site root
urls = re.findall(r'<loc>(.*?)</loc>', open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8').read())
urls += ['https://okalme.site/llms.txt']
body = json.dumps({'host': 'okalme.site', 'key': KEY, 'keyLocation': f'https://okalme.site/{KEY}.txt', 'urlList': urls}).encode()
req = urllib.request.Request('https://api.indexnow.org/indexnow', body, {'Content-Type': 'application/json; charset=utf-8'})
with urllib.request.urlopen(req, timeout=20) as r:
    print('IndexNow', r.status, f'({len(urls)} urls)')  # 200/202 = accepted
