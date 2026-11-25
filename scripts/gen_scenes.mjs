/**
 * 合成场景集生成器（确定性：同一 seed 出同一份 engine/scenes.json）
 *
 * 六个场景族，各 8 例，共 48 例。合成数据只用于证明「链路通、阈值可标、分支可覆盖」，
 * 不代表现场准确率——策划案里按这个口径写。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SEED = 20261125;

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const rnd = lcg(SEED);
const jitter = (base, spread) => Number((base + (rnd() * 2 - 1) * spread).toFixed(3));

/** 柜体各部件在人眼视野中的大致位置（归一化），供原型叠框 */
const SLOT = {
  nameplate: [0.29, 0.173, 0.252, 0.096],
  tester: [0.640, 0.365, 0.118, 0.26],
  probe: [0.512, 0.500, 0.10, 0.06],
  clamp: [0.326, 0.678, 0.196, 0.09],
  tag: [0.546, 0.282, 0.084, 0.15],
  hand: [0.648, 0.474, 0.15, 0.26],
  cable: [0.19, 0.735, 0.28, 0.13],
};

const TASKS = [
  { bay: '102', feeder: '1号进线', work: '10kV 母线停电检修' },
  { bay: '105', feeder: '2号出线', work: '开关柜内互感器更换' },
  { bay: '108', feeder: '3号出线', work: '电缆终端头处理' },
];

function obj(cls, conf, attrs, slot = cls) {
  return { cls, conf: Number(conf.toFixed(3)), bbox: SLOT[slot], attrs };
}

const confOf = (lo, hi) => Number((lo + rnd() * (hi - lo)).toFixed(3));

function stepFrames(step, light, objects, count, tStart) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push({ t: Number((tStart + i * 0.42).toFixed(2)), step, light, objects });
  }
  return out;
}

function baseObjects(task, light) {
  const confScale = light < 0.5 ? 0.72 : 1;
  return {
    nameplate: obj('nameplate', confOf(0.88, 0.96) * confScale, { text: `${task.bay} ${task.feeder}`, match: true }),
    tester: obj('tester', confOf(0.88, 0.96) * confScale, { self_test_light: true }),
    probe: obj('probe', confOf(0.87, 0.95) * confScale, { contact_terminal: true, live: false }),
    clamp: obj('clamp', confOf(0.86, 0.95) * confScale, { on_conductor: true, torque_ok: true }),
    tag: obj('tag', confOf(0.86, 0.94) * confScale, { text_ok: true, on_handle: true }),
    hand: obj('hand', confOf(0.80, 0.92) * confScale, {}, 'hand'),
    cable: obj('cable', confOf(0.78, 0.90) * confScale, {}, 'cable'),
  };
}

const CATEGORIES = [
  { key: 'normal', label: 'allow', name: '正常合规' },
  { key: 'tester_fail', label: 'block', name: '验电器失效（不处置）' },
  { key: 'wrong_bay', label: 'block', name: '走错间隔（不处置）' },
  { key: 'no_tag', label: 'block', name: '未挂牌（不处置）' },
  { key: 'ground_loose', label: 'allow', name: '接地不良·处置后放行' },
  { key: 'lowlight', label: 'allow', name: '低光低置信·人工复核放行' },
];

function makeCase(cat, idx) {
  const task = { ...TASKS[idx % TASKS.length], ticket: `DL-2026-${1000 + idx * 7 + cat.key.length}` };
  const light = cat.key === 'lowlight' ? 0.32 : jitter(0.82, 0.14);
  const b = baseObjects(task, light);
  const frames = [];
  let t = 0;
  const push = (step, objects, count) => {
    frames.push(...stepFrames(step, light, objects, count, t));
    t += count * 0.42 + 0.58;
  };

  // 第 1 步：铭牌
  if (cat.key === 'wrong_bay') {
    b.nameplate.attrs = { text: `${idx % 2 === 0 ? '101' : '104'} ${task.feeder}`, match: false };
    push(1, [b.nameplate, b.hand], 2);
  } else {
    push(1, [b.nameplate, b.hand], 1);
  }

  if (cat.key === 'wrong_bay') {
    return { id: `${cat.key}-${idx + 1}`, category: cat.key, category_name: cat.name, label: cat.label, task, review_outcome: null, frames };
  }

  // 第 2 步：验电器自检
  if (cat.key === 'tester_fail') {
    b.tester.attrs = { self_test_light: false };
    push(2, [b.tester, b.hand], 3);
    return { id: `${cat.key}-${idx + 1}`, category: cat.key, category_name: cat.name, label: cat.label, task, review_outcome: null, frames };
  }
  push(2, [b.tester, b.hand], 1);

  // 第 3 步：验电
  push(3, [b.probe, b.hand, b.cable], 1);

  // 第 4 步：接地
  if (cat.key === 'ground_loose') {
    const loose = obj('clamp', confOf(0.86, 0.93), { on_conductor: true, torque_ok: false });
    push(4, [loose, b.hand, b.cable], 2);
    const fixed = obj('clamp', confOf(0.89, 0.95), { on_conductor: true, torque_ok: true });
    push(4, [fixed, b.hand, b.cable], 1);
  } else {
    push(4, [b.clamp, b.hand, b.cable], 1);
  }

  // 第 5 步：挂牌
  if (cat.key === 'no_tag') {
    const onFloor = obj('tag', confOf(0.86, 0.92), { text_ok: true, on_handle: false }, 'cable');
    push(5, [onFloor, b.hand], 3);
    return { id: `${cat.key}-${idx + 1}`, category: cat.key, category_name: cat.name, label: cat.label, task, review_outcome: null, frames };
  }
  push(5, [b.tag, b.hand], 1);

  return {
    id: `${cat.key}-${idx + 1}`,
    category: cat.key,
    category_name: cat.name,
    label: cat.label,
    task,
    review_outcome: cat.key === 'lowlight' ? 'approve' : null,
    frames,
  };
}

const cases = [];
for (const cat of CATEGORIES) {
  for (let i = 0; i < 8; i += 1) cases.push(makeCase(cat, i));
}

const dataset = {
  name: 'verify-first-synthetic',
  seed: SEED,
  generated_by: 'scripts/gen_scenes.mjs',
  note: '合成场景集：每个场景由人工设定的检测结果拼成，用于验证判定规则、阈值与分支覆盖，不代表现场准确率。',
  categories: CATEGORIES.map((c) => ({ key: c.key, name: c.name, label: c.label, count: 8 })),
  cases,
};

const outPath = process.argv[2] ? resolve(process.argv[2]) : resolve(ROOT, 'engine/scenes.json');
mkdirSync(resolve(ROOT, 'engine'), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
console.log(`wrote ${outPath}: ${cases.length} cases, ${framesOf(dataset)} frames`);

function framesOf(d) {
  return d.cases.reduce((n, c) => n + c.frames.length, 0);
}
