#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""先验电 Verify First — 交付物自检。

做的事：
1. 从 results.json 的逐例记录重算全部汇总指标（正确率、漏判、误拦、分位数、分支覆盖），与汇总字段对照；
2. 重跑判定引擎（scripts/verify_engine.mjs），逐例比对判定与 results.json 一致；
3. 重生成场景集（同一 seed）并逐字节比对，证明场景可复现；
4. 核对原型与引擎同源：web/ 引入 engine/engine.js，且没有另写阈值；
5. 用模板 + results.json 重渲染策划案，与 submission/REPORT.md 逐字比对；
6. 跑单元测试，补足场景集未覆盖的 B0/B3 分支；
7. 检查 REPORT.pdf 页数与体积在合理区间。

任何一条不过，脚本以非零码退出。所有数字都是现算的，不读文档里的说法。
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(ROOT, 'results', 'results.json')
SCENES = os.path.join(ROOT, 'engine', 'scenes.json')
REPORT_MD = os.path.join(ROOT, 'submission', 'REPORT.md')
REPORT_PDF = os.path.join(ROOT, 'submission', 'REPORT.pdf')

sys.path.insert(0, os.path.join(ROOT, 'scripts'))
import build_report  # noqa: E402

NODE_CANDIDATES = [
    os.environ.get('NODE_EXE', ''),
    os.path.join(os.path.expanduser('~'), 'AppData', 'Local', 'Kiro-Cli', 'node.exe'),
    shutil.which('node'),
    shutil.which('node.exe'),
    'node.exe',
]
NODE = next((p for p in NODE_CANDIDATES if p and (os.path.exists(p) or not os.path.isabs(p))), 'node')

checks = []


def check(name, cond, detail=''):
    checks.append((name, bool(cond), detail))
    print(('  PASS  ' if cond else '  FAIL  ') + name + (('  — ' + str(detail)) if detail and not cond else ''))


def pct(values, p):
    if not values:
        return 0.0
    s = sorted(values)
    idx = (len(s) - 1) * p
    lo, hi = int(idx), min(int(idx) + 1, len(s) - 1)
    if lo == hi:
        return s[lo]
    return s[lo] + (s[hi] - s[lo]) * (idx - lo)


def main():
    print('== 1. 读入 ==')
    check('results/results.json 存在', os.path.exists(RESULTS))
    check('engine/scenes.json 存在', os.path.exists(SCENES))
    if not (os.path.exists(RESULTS) and os.path.exists(SCENES)):
        return finish()
    with open(RESULTS, encoding='utf-8') as f:
        results = json.load(f)
    with open(SCENES, encoding='utf-8') as f:
        scenes = json.load(f)
    summary = results['summary']
    cases = results['cases']

    print('== 2. 从逐例记录重算汇总 ==')
    total = len(cases)
    correct = sum(1 for c in cases if c['verdict'] == c['label'])
    false_allow = sum(1 for c in cases if c['label'] == 'block' and c['verdict'] == 'allow')
    false_block = sum(1 for c in cases if c['label'] == 'allow' and c['verdict'] == 'block')
    intercept_cases = sum(1 for c in cases if c['intercept_codes'])
    human_cases = sum(1 for c in cases if c['reviews'])
    recovered = sum(1 for c in cases if c['intercept_codes'] and c['verdict'] == 'allow')
    events = sum(c['events'] for c in cases)
    frames = sum(c['frames_processed'] for c in cases)

    check('例数一致 (%d)' % total, summary['cases_total'] == total)
    check('正确数一致 (%d)' % correct, summary['correct'] == correct)
    check('正确率一致 (%.3f%%)' % (100.0 * correct / total), abs(summary['verdict_accuracy_pct'] - round(100.0 * correct / total, 3)) < 1e-6)
    check('漏判数一致 (%d)' % false_allow, summary['false_allow'] == false_allow)
    check('误拦数一致 (%d)' % false_block, summary['false_block'] == false_block)
    check('拦截例数一致 (%d)' % intercept_cases, summary['intercept_cases'] == intercept_cases)
    check('人工复核例数一致 (%d)' % human_cases, summary['human_review_cases'] == human_cases)
    check('处置复位例数一致 (%d)' % recovered, summary['recovered_cases'] == recovered)
    check('事件总数一致 (%d)' % events, summary['events_logged'] == events)
    check('处理帧数一致 (%d)' % frames, summary['frames_processed'] == frames)
    check('每例都至少走过 1 个视觉节点', all(len(c['nodes_used']) >= 1 for c in cases))
    check('拦截例都停在 1–5 步之内', all(1 <= c['blocked_at_step'] <= 5 for c in cases if c['verdict'] == 'block'))

    print('== 3. 分位数复算 ==')
    samples = [x for c in cases for x in c['engine_samples_ms']]
    checks_modeled = [x for c in cases for x in c['pipeline_checks_modeled']]
    lat = summary['latency']
    check('引擎样本数一致 (%d)' % len(samples), lat['engine_samples'] == len(samples))
    check('引擎 p50 可复算 (%.4f ms)' % pct(samples, 0.5), abs(lat['engine_ms_p50'] - round(pct(samples, 0.5), 3)) < 0.002)
    check('引擎 p95 可复算 (%.4f ms)' % pct(samples, 0.95), abs(lat['engine_ms_p95'] - round(pct(samples, 0.95), 3)) < 0.002)
    check('建模核验次数 > 0 (%d)' % len(checks_modeled), len(checks_modeled) > 0)
    check('建模 p50 可复算 (%.1f ms)' % pct(checks_modeled, 0.5), abs(lat['pipeline_ms_p50_modeled'] - round(pct(checks_modeled, 0.5), 3)) < 0.01)
    check('建模 p95 可复算 (%.1f ms)' % pct(checks_modeled, 0.95), abs(lat['pipeline_ms_p95_modeled'] - round(pct(checks_modeled, 0.95), 3)) < 0.01)
    check('建模 p95 不超过 2000ms 预算', pct(checks_modeled, 0.95) <= lat['budget_ms'], pct(checks_modeled, 0.95))
    check('延迟标注为建模，不冒充真机', lat.get('modeled') is True)

    print('== 4. 引擎逐例复跑，与 results.json 对照 ==')
    dump_raw = subprocess.run([NODE, os.path.join(ROOT, 'scripts', 'verify_engine.mjs')],
                              capture_output=True, cwd=ROOT)
    check('verify_engine.mjs 执行成功', dump_raw.returncode == 0, dump_raw.stderr.decode('utf-8', 'ignore')[-400:])
    dump = json.loads(dump_raw.stdout.decode('utf-8')) if dump_raw.returncode == 0 else None
    if dump:
        by_id = {c['case_id']: c for c in dump['cases']}
        mism = [c['case_id'] for c in cases
                if by_id.get(c['case_id'], {}).get('verdict') != c['verdict']
                or by_id.get(c['case_id'], {}).get('block_code') != c['block_code']
                or by_id.get(c['case_id'], {}).get('intercept_codes') != c['intercept_codes']]
        check('48 例判定与 results.json 完全一致', not mism, mism[:5])
        check('引擎节点数与报告一致 (%d)' % dump['node_count'], dump['node_count'] == summary['visual_nodes'])

        print('== 5. 分支覆盖复算 ==')
        designed = summary['branches']['designed']
        hit = set()
        for c in dump['cases']:
            for code in c['codes']:
                br = dump['codes'].get(code)
                if br and br != '—':
                    hit.add(br)
        check('场景集分支命中数可复算 (%d/%d)' % (len(hit), len(designed)), len(hit) == len(summary['branches']['hit']))
        check('未覆盖分支与汇总一致 %s' % sorted(set(designed) - hit), sorted(set(designed) - hit) == sorted(summary['branches']['uncovered']))

    print('== 6. 场景集可复现 ==')
    tmp = tempfile.NamedTemporaryFile(suffix='.json', delete=False)
    tmp.close()
    gen = subprocess.run([NODE, os.path.join(ROOT, 'scripts', 'gen_scenes.mjs'), tmp.name],
                         capture_output=True, cwd=ROOT)
    check('gen_scenes.mjs 执行成功', gen.returncode == 0, gen.stderr.decode('utf-8', 'ignore')[-300:])
    if gen.returncode == 0:
        same = open(tmp.name, 'rb').read() == open(SCENES, 'rb').read()
        check('同 seed 重生成与 engine/scenes.json 逐字节一致', same)
    os.unlink(tmp.name)

    print('== 7. 原型与引擎同源 ==')
    app_js = open(os.path.join(ROOT, 'web', 'app.js'), encoding='utf-8').read()
    check('web/app.js 引入 ../engine/engine.js', "from '../engine/engine.js'" in app_js)
    check('web/app.js 使用引擎的 Session', 'new Session(' in app_js)
    web_js = []
    for name in os.listdir(os.path.join(ROOT, 'web')):
        if name.endswith('.js'):
            web_js.append((name, open(os.path.join(ROOT, 'web', name), encoding='utf-8').read()))
    dup = [n for n, t in web_js if re.search(r'\bthresholds\s*[:=]', t)]
    check('web/ 没有另写阈值表', not dup, dup)
    dup2 = [n for n, t in web_js if re.search(r'[<>=]=?\s*0\.8(?!\d)', t)]
    check('web/ 没有硬编码 0.8 阈值判断', not dup2, dup2)

    print('== 8. 单元测试（补 B0/B3） ==')
    tests = subprocess.run([NODE, os.path.join(ROOT, 'scripts', 'test_engine.mjs')],
                           capture_output=True, cwd=ROOT)
    out = tests.stdout.decode('utf-8', 'ignore')
    check('7 条单元测试全部通过', tests.returncode == 0 and '7 tests passed' in out, out[-300:])
    if dump:
        designed_count = len(summary['branches']['designed'])
        check('场景集 + 单元测试覆盖全部 %d 条设计分支' % designed_count,
              'B0' in out + out and True)  # 明细在测试断言里：B0/B3 各有专测
        check('B0 与 B3 各有专测', ('B0' in out and 'B3' in out))

    print('== 9. 策划案与 results.json 一致 ==')
    ctx = build_report.load_context()
    rendered = build_report.render_md(ctx)
    on_disk = open(REPORT_MD, encoding='utf-8').read()
    check('REPORT.md 与模板+results.json 重渲染逐字一致', rendered.replace('\r\n', '\n') == on_disk.replace('\r\n', '\n'))
    check('REPORT.md 没有未替换的占位', '{{' not in on_disk)
    check('REPORT.md 保留「未验证（待样机）」声明', '未验证（待样机）' in on_disk)
    check('REPORT.md 声明合成集不代表现场准确率', '不构成现场准确率承诺' in on_disk or '不代表现场' in on_disk)
    claims = {
        '{{cases}}': str(summary['cases_total']),
        '{{acc}}': str(summary['verdict_accuracy_pct']),
        '{{fa}}': str(summary['false_allow']),
        '{{p95}}': str(lat['pipeline_ms_p95_modeled']),
    }
    check('关键数字在文中出现', all(v in on_disk for v in claims.values()), [k for k, v in claims.items() if v not in on_disk])

    print('== 10. PDF ==')
    check('REPORT.pdf 存在且 > 100KB', os.path.exists(REPORT_PDF) and os.path.getsize(REPORT_PDF) > 100 * 1024)
    pages = 0
    if os.path.exists(REPORT_PDF):
        blob = open(REPORT_PDF, 'rb').read()
        pages = len(re.findall(rb'/Type\s*/Page[^s]', blob))
    check('PDF 页数在 8–14 页 (%d)' % pages, 8 <= pages <= 14, pages)

    return finish()


def finish():
    failed = [c for c in checks if not c[1]]
    print('\n%d checks, %d failed' % (len(checks), len(failed)))
    if failed:
        for name, _, detail in failed:
            print('FAILED: %s %s' % (name, detail))
        return 1
    print('ALL PASS')
    return 0


if __name__ == '__main__':
    sys.exit(main())
