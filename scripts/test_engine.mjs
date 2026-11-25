/** 引擎单元测试：补场景集未覆盖的 B0（目标不在视野）与 B3（验电检出带电），并锚定阈值边界 */
import assert from 'node:assert/strict';
import { CONFIG, Session, evaluateCase, judgeFrame } from '../engine/engine.js';

const mk = (id, frames, extra = {}) => ({ id, label: 'block', review_outcome: null, frames, ...extra });
const f = (step, objects, light = 0.9) => ({ t: 0, step, light, objects });
const o = (cls, conf, attrs, bbox = [0.3, 0.3, 0.2, 0.1]) => ({ cls, conf, bbox, attrs });

let n = 0;
const t = (name, fn) => {
  try {
    fn();
    n += 1;
    console.log(`ok ${n} - ${name}`);
  } catch (e) {
    console.error(`FAIL - ${name}\n${e.message}`);
    process.exit(1);
  }
};

const good = {
  1: [o('nameplate', 0.94, { text: '102 1号进线', match: true })],
  2: [o('tester', 0.94, { self_test_light: true })],
  3: [o('probe', 0.94, { contact_terminal: true, live: false })],
  4: [o('clamp', 0.94, { on_conductor: true, torque_ok: true })],
  5: [o('tag', 0.94, { text_ok: true, on_handle: true })],
};
const fullGood = (extra = {}) => mk('unit-good', [1, 2, 3, 4, 5].map((s) => f(s, good[s])), extra);

t('合规序列判 allow，且 5 个视觉节点都被用到', () => {
  const r = evaluateCase(fullGood());
  assert.equal(r.verdict, 'allow');
  assert.deepEqual(r.nodes_used, ['nameplate', 'tester', 'probe', 'clamp', 'tag']);
});

t('B0：第 3 步视野里没有验电探头 → E-NODE-MISSING，停在第 3 步', () => {
  const r = evaluateCase(mk('unit-b0', [f(1, good[1]), f(2, good[2]), f(3, [o('hand', 0.9, {})])]));
  assert.equal(r.verdict, 'block');
  assert.equal(r.block_code, 'E-NODE-MISSING');
  assert.equal(r.blocked_at_step, 3);
});

t('B3：验电检出带电 → E-LIVE-CONDUCTOR', () => {
  const r = evaluateCase(mk('unit-b3', [f(1, good[1]), f(2, good[2]), f(3, [o('probe', 0.93, { contact_terminal: true, live: true })])]));
  assert.equal(r.verdict, 'block');
  assert.equal(r.block_code, 'E-LIVE-CONDUCTOR');
});

t('阈值边界：conf 恰为 0.80 直接判过；0.79 转复核', () => {
  const at = judgeFrame(1, f(1, [o('nameplate', CONFIG.thresholds.pass, { match: true })]));
  const below = judgeFrame(1, f(1, [o('nameplate', 0.79, { match: true })]));
  assert.equal(at.state, 'pass');
  assert.equal(below.state, 'review');
});

t('阈值下界：conf 0.55 转复核；0.54 判失败', () => {
  const at = judgeFrame(2, f(2, [o('tester', CONFIG.thresholds.review, { self_test_light: true })]));
  const below = judgeFrame(2, f(2, [o('tester', 0.54, { self_test_light: true })]));
  assert.equal(at.state, 'review');
  assert.equal(below.state, 'block');
});

t('复核未确认 → 整单 review；确认后放行', () => {
  const scene = mk('unit-review', [1, 2, 3, 4, 5].map((s) => f(s, good[s].map((x) => ({ ...x, conf: 0.66 })))));
  assert.equal(evaluateCase(scene).verdict, 'review');
  assert.equal(evaluateCase(scene, { reviewOutcome: 'approve' }).verdict, 'allow');
});

t('拦截后按提示处置 → W-RECOVERED，整单可放行', () => {
  const session = new Session(fullGood());
  session.pushFrame(f(1, good[1]));
  session.pushFrame(f(2, [o('tester', 0.93, { self_test_light: false })]));
  const blocked = session.pushFrame(f(2, [o('tester', 0.93, { self_test_light: false })]));
  assert.equal(blocked.state, 'block');
  session.pushFrame(session.repairFrame());
  for (const s of [3, 4, 5]) session.pushFrame(f(s, good[s]));
  const r = session.result();
  assert.equal(r.verdict, 'allow');
  assert.equal(r.intercept_codes?.length ?? r.intercepts.length, 1);
  assert.ok(r.events.some((e) => e.code === 'W-RECOVERED'));
});

console.log(`\n${n} tests passed`);
