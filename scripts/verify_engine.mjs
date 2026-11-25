/** 把引擎对全部场景的逐例判定导成 JSON，供 verify.py 与 results.json 对照。 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG, CODES, evaluateCase } from '../engine/engine.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataset = JSON.parse(readFileSync(resolve(ROOT, 'engine/scenes.json'), 'utf8'));

const cases = dataset.cases.map((scene) => {
  const r = evaluateCase(scene);
  return {
    case_id: scene.id,
    category: scene.category,
    label: scene.label,
    verdict: r.verdict,
    block_code: r.block_code,
    intercept_codes: r.intercepts.map((i) => i.code),
    review_steps: r.reviews.map((x) => x.step),
    steps_passed: r.steps.length,
    events: r.events.length,
    codes: [...new Set(r.events.map((e) => e.code).filter(Boolean))],
    human_confirmed: r.human_confirmed,
  };
});

const out = {
  engine_version: CONFIG.version,
  thresholds: CONFIG.thresholds,
  node_count: CONFIG.nodes.length,
  node_keys: CONFIG.nodes.map((n) => n.key),
  codes: Object.fromEntries(Object.entries(CODES).map(([k, v]) => [k, v.branch])),
  cases,
};

process.stdout.write(JSON.stringify(out));
