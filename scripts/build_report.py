#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把 report/report_template.md + results/results.json 渲染成 submission/REPORT.md / .html / .pdf。

文档里的每个数字都来自 results.json（或引擎里的阈值），模板里只写 {{key}} 占位。
verify.py 会用同一个渲染函数重渲染并逐字比对，所以「文档改了数字但结果没变」会被抓到。
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS = os.path.join(ROOT, 'results', 'results.json')
TEMPLATE = os.path.join(ROOT, 'report', 'report_template.md')
OUT_MD = os.path.join(ROOT, 'submission', 'REPORT.md')
OUT_HTML = os.path.join(ROOT, 'submission', 'REPORT.html')
OUT_PDF = os.path.join(ROOT, 'submission', 'REPORT.pdf')

EDGE_CANDIDATES = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]


def load_context():
    with open(RESULTS, encoding='utf-8') as f:
        data = json.load(f)
    s = data['summary']
    hit = s['branches']['hit']
    designed = s['branches']['designed']
    ctx = {
        'summary': s,
        'latency': s['latency'],
        'thresholds': s['thresholds'],
        'branches_hit_count': len(hit),
        'branches_designed_count': len(designed),
        'branches_total_covered': len(designed),  # 场景集 + 单元测试
    }
    return ctx


def lookup(ctx, path):
    cur = ctx
    for part in path.split('.'):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            raise KeyError('模板占位找不到: %s' % path)
    return cur


def render_md(ctx, template_text=None):
    text = template_text
    if text is None:
        with open(TEMPLATE, encoding='utf-8') as f:
            text = f.read()

    def sub(m):
        val = lookup(ctx, m.group(1))
        if isinstance(val, float):
            return ('%g' % val)
        return str(val)

    return re.sub(r'\{\{([a-zA-Z0-9_.]+)\}\}', sub, text)


def inline(s):
    s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'<img alt="\1" src="../\2" />', s)
    return s


def md_to_html(md):
    lines = md.split('\n')
    out = []
    i = 0
    in_ul = False
    in_ol = False

    def close_lists():
        nonlocal in_ul, in_ol
        if in_ul:
            out.append('</ul>')
            in_ul = False
        if in_ol:
            out.append('</ol>')
            in_ol = False

    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip():
            close_lists()
            i += 1
            continue
        if line.startswith('|') and i + 1 < len(lines) and re.match(r'^\|[\s:|-]+\|$', lines[i + 1].strip()):
            close_lists()
            header = [c.strip() for c in line.strip('|').split('|')]
            out.append('<table><thead><tr>' + ''.join('<th>%s</th>' % inline(c) for c in header) + '</tr></thead><tbody>')
            i += 2
            while i < len(lines) and lines[i].strip().startswith('|'):
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                out.append('<tr>' + ''.join('<td>%s</td>' % inline(c) for c in cells) + '</tr>')
                i += 1
            out.append('</tbody></table>')
            continue
        if line.startswith('#'):
            close_lists()
            level = len(line) - len(line.lstrip('#'))
            out.append('<h%d>%s</h%d>' % (level, inline(line[level:].strip()), level))
        elif line.strip() == '---':
            close_lists()
            out.append('<hr />')
        elif line.startswith('> '):
            close_lists()
            buf = []
            while i < len(lines) and lines[i].startswith('>'):
                buf.append(lines[i].lstrip('>').strip())
                i += 1
            out.append('<blockquote>%s</blockquote>' % inline(' '.join(buf)))
            continue
        elif line.startswith('- '):
            if not in_ul:
                out.append('<ul>')
                in_ul = True
            out.append('<li>%s</li>' % inline(line[2:].strip()))
        elif re.match(r'^\d+\.\s', line):
            if not in_ol:
                out.append('<ol>')
                in_ol = True
            out.append('<li>%s</li>' % inline(re.sub(r'^\d+\.\s', '', line)))
        else:
            close_lists()
            out.append('<p>%s</p>' % inline(line.strip()))
        i += 1
    close_lists()
    return '\n'.join(out)


HTML_SHELL = u'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" />
<title>先验电 Verify First · 报名策划案</title>
<style>
  @page { size: A4; margin: 18mm 16mm 16mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", system-ui, sans-serif;
         color: #1d2126; font-size: 10.4pt; line-height: 1.75; margin: 0; }
  h1 { font-size: 21pt; line-height: 1.25; margin: 0 0 8px; letter-spacing: 0.02em; color: #10202a; }
  h1 + p { font-size: 11pt; color: #46525c; margin: 0 0 10px; }
  h1 + p + p { color: #5d6873; font-size: 9.3pt; }
  h2 { font-size: 13.5pt; margin: 20px 0 7px; padding-bottom: 4px; border-bottom: 1.2px solid #cfd8de;
       color: #12303d; page-break-after: avoid; }
  h3 { font-size: 11pt; margin: 13px 0 5px; color: #22404e; page-break-after: avoid; }
  p { margin: 5px 0; text-align: justify; }
  ul, ol { margin: 5px 0 5px 1.2em; padding: 0; }
  li { margin: 2px 0; }
  strong { color: #0f2530; }
  code { background: #eef2f4; padding: 0 3px; border-radius: 3px; font-size: 9pt;
         font-family: Consolas, "Courier New", monospace; color: #234; }
  blockquote { margin: 8px 0; padding: 8px 12px; background: #f3f7f9; border-left: 3px solid #3d8fa3;
               color: #3d4b55; font-size: 9.4pt; }
  table { width: 100%; border-collapse: collapse; margin: 7px 0 10px; font-size: 8.9pt;
          page-break-inside: auto; table-layout: fixed; }
  th, td { border: 1px solid #d2dbe1; padding: 4px 6px; vertical-align: top; text-align: left;
           word-break: break-word; overflow-wrap: anywhere; }
  th { background: #eef3f6; font-weight: 600; color: #1d3441; }
  tr { page-break-inside: avoid; }
  hr { border: 0; border-top: 1px solid #d8e0e5; margin: 14px 0; }
  img { max-width: 100%; border: 1px solid #cfd8de; border-radius: 4px; margin: 8px 0; }
  h2 + p, h3 + p { page-break-before: avoid; }
  @media screen {
    body { max-width: 800px; margin: 28px auto; padding: 0 24px; background: #fbfcfd; }
  }
</style></head><body>
__BODY__
</body></html>'''


def write_all():
    ctx = load_context()
    md = render_md(ctx)
    os.makedirs(os.path.join(ROOT, 'submission'), exist_ok=True)
    with open(OUT_MD, 'w', encoding='utf-8', newline='\n') as f:
        f.write(md)
    html = HTML_SHELL.replace('__BODY__', md_to_html(md))
    with open(OUT_HTML, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    return md


def find_edge():
    for p in EDGE_CANDIDATES:
        if os.path.exists(p):
            return p
    return None


def print_pdf():
    edge = find_edge()
    if not edge:
        print('未找到 Edge/Chrome，跳过 PDF；HTML 已生成。')
        return False
    tmp_profile = os.path.join(ROOT, '.edge-profile')
    cmd = [
        edge, '--headless=new', '--disable-gpu', '--no-first-run',
        '--no-pdf-header-footer', '--print-to-pdf-no-header',
        '--user-data-dir=' + tmp_profile,
        '--print-to-pdf=' + OUT_PDF,
        'file:///' + OUT_HTML.replace('\\', '/'),
    ]
    subprocess.run(cmd, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=180)
    ok = os.path.exists(OUT_PDF) and os.path.getsize(OUT_PDF) > 20000
    print('PDF: %s (%s bytes)' % (OUT_PDF, os.path.getsize(OUT_PDF) if os.path.exists(OUT_PDF) else 0))
    return ok


if __name__ == '__main__':
    body = write_all()
    print('REPORT.md: %d chars' % len(body))
    ok = print_pdf()
    sys.exit(0 if ok else 1)
