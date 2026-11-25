/**
 * 在合成场景集上跑判定引擎，产出 results/results.json。
 *
 * 两类延迟分开记：
 * - engine_p50/p95：本机 Node 上真实测得的引擎判定耗时（微秒级，只说明规则本身不拖后腿）；
 * - pipeline_p50/p95：按端侧管线建模（取帧 + NPU 推理 + 渲染 + 判定），**不是真机实测**，
 *   策划案里必须以「建模」标注。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { CONFIG, CODES, evaluateCase, modelPipelineLatency } from '../engine/engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const dataset = JSON.parse(readFileSync(resolve(ROOT, 'engine/scenes.json'), 'utf8'));

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
};
const r3 = (n) => Number(n.toFixed(3));

const records = [];
const engineSamples = [];
const pipelineSamples = [];
const codeHits = new Set();
const nodeHits = new Set();
let eventsTotal = 0;
let framesUsed = 0;

for (const scene of dataset.cases) {
  // 预热一次，避免首例把 JIT 成本算进去
  evaluateCase(scene);
  const samples = [];
  let result = null;
  for (let i = 0; i < 7; i += 1) {
    const t0 = performance.now();
    result = evaluateCase(scene);
    samples.push(performance.now() - t0);
  }
  samples.shift(); // 丢掉第一次（仍偏冷）
  engineSamples.push(...samples);

  const modeled = modelPipelineLatency(scene, result.steps);
  pipelineSamples.push(...modeled);
  framesUsed += result.frames_processed;
  eventsTotal += result.events.length;
  for (const e of result.events) if (e.code) codeHits.add(e.code);
  for (const n of result.nodes_used) nodeHits.add(n);

  records.push({
    case_id: scene.id,
    category: scene.category,
    label: scene.label,
    verdict: result.verdict,
    correct: result.verdict === scene.label,
    blocked_at_step: result.blocked_at_step,
    block_code: result.block_code,
    intercept_codes: result.intercepts.map((i) => i.code),
    reviews: result.reviews,
    nodes_used: result.nodes_used,
    frames_processed: result.frames_processed,
    events: result.events.length,
    human_confirmed: result.human_confirmed,
    engine_ms: { p50: r3(pct(samples, 0.5)), p95: r3(pct(samples, 0.95)) },
    engine_samples_ms: samples.map((x) => Number(x.toFixed(6))),
    pipeline_checks_modeled: modeled,
    pipeline_ms_modeled_p50: r3(pct(modeled, 0.5)),
    checks_modeled: modeled.length,
  });
}

const total = records.length;
const correct = records.filter((r) => r.correct).length;
const falseAllow = records.filter((r) => r.label === 'block' && r.verdict === 'allow').length;
const falseBlock = records.filter((r) => r.label === 'allow' && r.verdict === 'block').length;
const reviewVerdicts = records.filter((r) => r.verdict === 'review').length;
const interceptCases = records.filter((r) => r.intercept_codes.length > 0).length;
const humanReviewCases = records.filter((r) => r.reviews.length > 0).length;
const recoveredCases = records.filter((r) => r.intercept_codes.length > 0 && r.verdict === 'allow').length;

const perCategory = dataset.categories.map((c) => {
  const rs = records.filter((r) => r.category === c.key);
  return {
    key: c.key,
    name: c.name,
    label: c.label,
    cases: rs.length,
    correct: rs.filter((r) => r.correct).length,
    verdicts: { allow: rs.filter((r) => r.verdict === 'allow').length, block: rs.filter((r) => r.verdict === 'block').length, review: rs.filter((r) => r.verdict === 'review').length },
  };
});

const designedBranches = ['B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'R1', 'R2'];
const hitBranches = [...new Set([...codeHits].filter((c) => CODES[c]).map((c) => CODES[c].branch).filter((b) => b !== '—'))].sort();

const summary = {
  dataset: dataset.name,
  seed: dataset.seed,
  engine_version: CONFIG.version,
  thresholds: CONFIG.thresholds,
  generated_at: new Date().toISOString(),
  cases_total: total,
  categories: dataset.categories.length,
  cases_per_category: dataset.categories[0].count,
  frames_processed: framesUsed,
  events_logged: eventsTotal,
  verdict_accuracy_pct: r3((correct / total) * 100),
  correct,
  false_allow: falseAllow,
  false_block: falseBlock,
  review_verdicts: reviewVerdicts,
  intercept_cases: interceptCases,
  human_review_cases: humanReviewCases,
  recovered_cases: recoveredCases,
  visual_nodes: CONFIG.nodes.length,
  nodes_hit: [...nodeHits].sort(),
  latency: {
    engine_ms_p50: r3(pct(engineSamples, 0.5)),
    engine_ms_p95: r3(pct(engineSamples, 0.95)),
    engine_samples: engineSamples.length,
    pipeline_ms_p50_modeled: r3(pct(pipelineSamples, 0.5)),
    pipeline_ms_p95_modeled: r3(pct(pipelineSamples, 0.95)),
    budget_ms: 2000,
    modeled: true,
  },
  branches: {
    designed: designedBranches,
    hit: hitBranches,
    uncovered: designedBranches.filter((b) => !hitBranches.includes(b)),
    codes_hit: [...codeHits].sort(),
  },
};

const out = { summary, per_category: perCategory, cases: records };
mkdirSync(resolve(ROOT, 'results'), { recursive: true });
writeFileSync(resolve(ROOT, 'results/results.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');

console.log(
  `cases=${total} acc=${summary.verdict_accuracy_pct}% false_allow=${falseAllow} false_block=${falseBlock} ` +
    `engine p50=${summary.latency.engine_ms_p50}ms p95=${summary.latency.engine_ms_p95}ms ` +
    `pipeline p95(m)=${summary.latency.pipeline_ms_p95_modeled}ms branches=${hitBranches.length}/${designedBranches.length}`,
);
