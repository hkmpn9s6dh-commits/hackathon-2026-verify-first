#!/usr/bin/env bash
# 一条命令复验：场景可复现 → 单元测试 → 评测 → 全量断言
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 1/5 场景可复现 =="
TMP="$(node -e "console.log(require('os').tmpdir()+'/vf-scenes-'+Date.now()+'.json')")"
node scripts/gen_scenes.mjs "$TMP" >/dev/null
diff <(cat engine/scenes.json) <(cat "$TMP") >/dev/null && echo "scenes: identical"
rm -f "$TMP"

echo "== 2/5 单元测试 =="
node scripts/test_engine.mjs | tail -2

echo "== 3/5 评测 =="
node scripts/run_eval.mjs

echo "== 4/5 重出策划案（数字随 results.json 变） =="
python scripts/build_report.py | sed "s/^/  /"

echo "== 5/5 全量断言 =="
python verify.py
