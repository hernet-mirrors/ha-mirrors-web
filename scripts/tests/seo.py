#!/usr/bin/env python3
"""Check built HTML without executing JavaScript. Usage: python3 scripts/tests/seo.py _site HOST"""
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

class HTML(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.tags = []
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))
    def attrs(self, tag, **attrs):
        return [a for t,a in self.tags if t == tag and all(a.get(k) == v for k,v in attrs.items())]

root = Path(sys.argv[1] if len(sys.argv) > 1 else '_site')
host = sys.argv[2]
def read(path): return (root/path).read_text()
def check_page(path, canonical):
    text = read(path)
    parsed = HTML(text)
    assert len(re.findall('<title>', text)) == 1, path
    assert parsed.attrs('link', rel='canonical')[0]['href'] == f'https://{host}{canonical}', path
    assert len(parsed.attrs('meta', name='description')) == 1, path
    assert parsed.attrs('meta', name='description')[0]['content'].strip(), path
    assert not parsed.attrs('meta', name='robots'), path
    return text, parsed

home,_ = check_page('index.html','/')
assert re.search(r'<tbody id="mirror-table-body">\s*<tr',home)
assert 'mirror-table-container d-none' not in home
assert '/help/ubuntu/' in home
help_index,_ = check_page('help/index.html','/help/')
assert 'http-equiv="refresh"' not in help_index and 'window.location.replace' not in help_index
assert len(re.findall(r'href="/help/',help_index)) > 50
help_doc,_ = check_page('help/ubuntu/index.html','/help/ubuntu/')
assert '<pre' in help_doc and host in help_doc and 'data-z-code=' in help_doc
article,meta = check_page('news/mirrorz-launched/index.html','/news/mirrorz-launched/')
summary = meta.attrs('meta',name='description')[0]['content']
assert 100 < len(summary) <= 201 and summary.startswith('2026'),summary
assert 'href="https://os.nju.edu.cn"' in article
assert meta.attrs('meta',property='og:type')[0]['content'] == 'article'
assert meta.attrs('meta',property='og:description')[0]['content'] == summary
news,_ = check_page('news/index.html','/news/')
data = json.loads(re.search(r'<script id="news-data"[^>]*>(.*?)</script>', news, re.S)[1])
expected = {item['url'] for item in data}
seen = set()
pages = max(1,(len(data)+9)//10)
for n in range(1,pages+1):
    url = '/news/' if n == 1 else f'/news/page{n}/'
    text,parsed = check_page(url.strip('/')+'/index.html',url)
    cards = re.findall(r'<article\b.*?</article>', text,re.S)
    assert len(cards) == min(10,len(data)-(n-1)*10)
    for card in cards:
        seen.add(HTML(card).attrs('a')[0]['href'])
        assert '<p class="card-text"></p>' not in card
    for i in range(1,pages+1):
        target = '/news/' if i == 1 else f'/news/page{i}/'
        assert parsed.attrs('a',href=target),target
assert seen == expected
css = read('static/css/news.css')
assert not re.search(r'#news-(list|pagination)\s*\{[^}]*display:\s*none',css)
robots = read('robots.txt')
assert f'Sitemap: https://{host}/sitemap.xml' in robots
assert 'Disallow: /ubuntu/\n' in robots
assert 'Disallow: /help' not in robots and 'Disallow: /news' not in robots
urls = [node.text for node in ET.fromstring(read('sitemap.xml')).findall('.//{*}loc')]
for path in ['/', '/help/', '/help/ubuntu/', '/news/', '/news/mirrorz-launched/']:
    assert f'https://{host}{path}' in urls,path
assert all(url.startswith(f'https://{host}/') for url in urls)
assert not any('/fancy-index/' in url or '/404.html' in url or '/maintenance/' in url for url in urls)
feed = ET.fromstring(read('feed.xml'))
assert feed.findall('.//{*}entry')
assert summary in read('feed.xml') or '2026 年 8 月 22 日' in read('feed.xml')
assert (root/'static/img/logo-share.png').is_file()
print(f'PASS {host}: {len(data)} news, {pages} static page(s), {len(urls)} sitemap URLs; metadata, help, robots, feed and fallbacks')
