/**
 * 先验电 Verify First — 作业步骤核对判定引擎
 *
 * 设计约束：
 * 1. 浏览器（web/）与离线实测（scripts/run_eval.mjs）必须共用这一份实现：原型里每一次
 *    「通过 / 拦截 / 转复核」都由 Session 产生，评测跑的是同一个 Session，不允许各写一套。
 * 2. 引擎不访问 DOM、不读时钟；延迟由调用方测，因此可以逐帧复算、可被 verify.py 复验。
 * 3. 所有阈值集中在 CONFIG.thresholds，文档里的阈值都从这里取，不散落在代码里。
 */

export const CONFIG = {
  version: '1.0.0',
  thresholds: { pass: 0.8, review: 0.55 },
  nodes: [
    {
      step: 1,
      key: 'nameplate',
      name: '设备铭牌·双重编号',
      prompt: '对准柜门铭牌，读到「102 1号进线」',
      pass: (a) => a.match === true,
      failCode: 'E-BAY-MISMATCH',
      failHint: '铭牌编号与工作票不符，禁止操作',
      repair: { text: '102 1号进线', match: true },
    },
    {
      step: 2,
      key: 'tester',
      name: '验电器自检',
      prompt: '按下自检按钮，确认声光指示正常',
      pass: (a) => a.self_test_light === true,
      failCode: 'E-TESTER-SELFTEST',
      failHint: '验电器自检无指示，更换合格验电器',
      repair: { self_test_light: true },
    },
    {
      step: 3,
      key: 'probe',
      name: '验电接触·带电状态',
      prompt: '验电探头接触出线端子，确认无电压',
      pass: (a) => a.contact_terminal === true && a.live === false,
      failCode: 'E-LIVE-CONDUCTOR',
      failHint: '验电异常：检出带电或未接触端子',
      repair: { contact_terminal: true, live: false },
    },
    {
      step: 4,
      key: 'clamp',
      name: '接地线挂接',
      prompt: '接地夹夹在检修母线上，确认扭矩到位',
      pass: (a) => a.on_conductor === true && a.torque_ok === true,
      failCode: 'E-GROUND-LOOSE',
      failHint: '接地夹未夹紧或位置不对，重新挂接',
      repair: { on_conductor: true, torque_ok: true },
    },
    {
      step: 5,
      key: 'tag',
      name: '挂牌·禁止合闸',
      prompt: '「禁止合闸，有人工作」牌挂上操作把手',
      pass: (a) => a.text_ok === true && a.on_handle === true,
      failCode: 'E-TAG-MISSING',
      failHint: '未见挂牌或牌子未挂上把手，禁止开工',
      repair: { text_ok: true, on_handle: true },
    },
  ],
};

export const CODES = {
  'E-BAY-MISMATCH': { level: 'block', label: '走错间隔', branch: 'B1' },
  'E-TESTER-SELFTEST': { level: 'block', label: '验电器失效', branch: 'B2' },
  'E-LIVE-CONDUCTOR': { level: 'block', label: '验电异常', branch: 'B3' },
  'E-GROUND-LOOSE': { level: 'block', label: '接地不良', branch: 'B4' },
  'E-TAG-MISSING': { level: 'block', label: '未挂牌', branch: 'B5' },
  'E-NODE-MISSING': { level: 'block', label: '目标不在视野', branch: 'B0' },
  'W-LOW-CONF': { level: 'review', label: '低置信·转人工复核', branch: 'R1' },
  'W-RECOVERED': { level: 'info', label: '拦截后处置复位', branch: 'R2' },
  'I-PASS': { level: 'info', label: '本步核对通过', branch: '—' },
  'H-CONFIRM': { level: 'info', label: '人工复核确认', branch: '—' },
};

export const nodeByStep = new Map(CONFIG.nodes.map((n) => [n.step, n]));

/** 取该帧里本节点目标：同类取置信度最高的一件 */
export function pickTarget(node, frame) {
  const cands = (frame.objects || []).filter((o) => o && o.cls === node.key);
  if (!cands.length) return null;
  return cands.reduce((best, o) => (o.conf > best.conf ? o : best), cands[0]);
}

/** 单帧判定：{state: pass|block|review, code, hint, conf} */
export function judgeFrame(step, frame) {
  const node = nodeByStep.get(step);
  if (!node) return { state: 'block', code: 'E-STEP-UNKNOWN', hint: '无此作业步骤', conf: 0 };

  const target = pickTarget(node, frame);
  if (!target) {
    return { state: 'block', code: 'E-NODE-MISSING', hint: `视野内未找到「${node.name}」，请对准目标`, conf: 0 };
  }
  const { pass: passAt, review: reviewAt } = CONFIG.thresholds;
  if (target.conf < reviewAt) {
    return {
      state: 'block',
      code: 'W-LOW-CONF',
      hint: `置信度 ${target.conf.toFixed(2)} 低于可用下限 ${reviewAt}，请调整距离或补光后重试`,
      conf: target.conf,
    };
  }
  const ok = node.pass(target.attrs || {});
  if (target.conf < passAt) {
    return {
      state: 'review',
      code: 'W-LOW-CONF',
      hint: `置信度 ${target.conf.toFixed(2)}：需要人工在画面内确认「${ok ? '符合' : '不符合'}」`,
      conf: target.conf,
      observed: ok,
    };
  }
  if (!ok) return { state: 'block', code: node.failCode, hint: node.failHint, conf: target.conf };
  return { state: 'pass', code: null, hint: `${node.name}核对通过`, conf: target.conf };
}

/**
 * 一次作业会话的状态机。
 * - 某步被拦截后，本步后续帧若合格 → 记一次 W-RECOVERED（异常处置复位），继续；
 * - 某步直到帧耗尽都没通过 → 整体 block；
 * - 出现复核、且没人确认 → 整体 review；确认后继续（H-CONFIRM）。
 */
export class Session {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.step = 1;
    this.events = [];
    this.steps = [];
    this.intercepts = [];
    this.reviews = [];
    this.nodesUsed = new Set();
    this.pendingReview = null;
    this.reviewApproved = options.reviewOutcome === 'approve' || scene.review_outcome === 'approve';
    this.lastReviewFrame = null;
    this.finished = false;
  }

  #push(e) {
    const ev = { seq: this.events.length + 1, t: null, ...e };
    this.events.push(ev);
    return ev;
  }

  /** 推进一帧，返回 {done, step, state, code, hint, conf, verdict} */
  pushFrame(frame) {
    if (this.finished) return { done: true, verdict: this.result().verdict };
    const node = nodeByStep.get(this.step);
    if (!node) return { done: true, verdict: this.result().verdict };

    if (frame.step !== this.step) {
      this.#push({ t: frame.t, step: this.step, type: 'skip', code: 'I-STEP-SKIP', note: `帧属于第 ${frame.step} 步，当前在第 ${this.step} 步` });
      return { done: false, step: this.step, state: 'skip' };
    }

    const r = judgeFrame(this.step, frame);
    this.nodesUsed.add(node.key);
    const base = { t: frame.t, step: this.step, node: node.key, conf: Number(r.conf.toFixed(3)) };

    if (r.state === 'pass') {
      this.#push({ ...base, type: 'decision', code: 'I-PASS', note: r.hint });
      if (this.intercepts.some((i) => i.step === this.step)) {
        this.#push({ ...base, type: 'resolve', code: 'W-RECOVERED', note: `第 ${this.step} 步异常已处置并复核通过` });
      }
      this.steps.push({ step: this.step, state: 'pass' });
      const finished = this.step === CONFIG.nodes.length;
      this.step += 1;
      if (finished) this.finished = true;
      return { done: finished, step: this.step - 1, state: 'pass', code: 'I-PASS', hint: r.hint, conf: r.conf, verdict: finished ? this.result().verdict : null };
    }

    if (r.state === 'block') {
      this.#push({ ...base, type: 'decision', code: r.code, note: r.hint });
      if (!this.intercepts.some((i) => i.step === this.step && i.code === r.code)) {
        this.intercepts.push({ step: this.step, code: r.code, hint: r.hint });
      }
      return { done: false, step: this.step, state: 'block', code: r.code, hint: r.hint, conf: r.conf };
    }

    this.#push({ ...base, type: 'review', code: r.code, note: r.hint });
    this.lastReviewFrame = frame;
    if (!this.reviews.some((v) => v.step === this.step)) {
      this.reviews.push({ step: this.step, code: r.code, conf: Number(r.conf.toFixed(3)) });
    }
    this.pendingReview = { step: this.step, code: r.code };
    if (this.reviewApproved) {
      this.#push({ ...base, type: 'human', code: 'H-CONFIRM', note: `人工复核：第 ${this.step} 步「${node.name}」确认符合` });
      this.steps.push({ step: this.step, state: 'review_pass' });
      const finished = this.step === CONFIG.nodes.length;
      this.step += 1;
      this.pendingReview = null;
      if (finished) this.finished = true;
      return { done: finished, step: this.step - 1, state: 'review_pass', code: 'H-CONFIRM', hint: '人工复核通过', conf: r.conf, verdict: finished ? this.result().verdict : null };
    }
    return { done: false, step: this.step, state: 'review', code: r.code, hint: r.hint, conf: r.conf, observed: r.observed };
  }

  /** 人工复核通过后，重新提交当前这一步的复核帧，让它继续走 */
  approveReview() {
    this.reviewApproved = true;
    if (!this.pendingReview || !this.lastReviewFrame) return { done: false };
    const frame = this.lastReviewFrame;
    this.pendingReview = null;
    return this.pushFrame({ ...frame, review_approved: true });
  }

  /** 异常处置：按节点要求造一帧「已按提示处置」的合格画面，供演练继续 */
  repairFrame(t = null) {
    const node = nodeByStep.get(this.step);
    if (!node) return null;
    const scene = this.scene;
    const prev = (scene.frames || []).find((f) => f.step === this.step) || { objects: [] };
    const slot = (prev.objects || []).find((o) => o && o.cls === node.key)?.bbox || [0.35, 0.4, 0.2, 0.12];
    return {
      t: t == null ? 99 + this.intercepts.length : t,
      step: this.step,
      light: 0.9,
      objects: [
        { cls: node.key, conf: 0.93, bbox: slot, attrs: { ...node.repair } },
        { cls: 'hand', conf: 0.88, bbox: [0.44, 0.6, 0.22, 0.26], attrs: {} },
      ],
      repaired: true,
    };
  }

  result() {
    const passed = new Set(this.steps.map((s) => s.step));
    const hard = this.intercepts.filter((i) => !passed.has(i.step));
    const blockedAt = this.step <= CONFIG.nodes.length && passed.size < CONFIG.nodes.length ? this.step : null;
    let verdict;
    if (this.pendingReview) verdict = 'review';
    else if (blockedAt !== null) verdict = 'block';
    else verdict = 'allow';
    return {
      engine_version: CONFIG.version,
      case_id: this.scene.id,
      verdict,
      blocked_at_step: verdict === 'block' ? blockedAt : null,
      block_code: verdict === 'block' ? hard[hard.length - 1]?.code || 'E-STEP-UNKNOWN' : null,
      intercepts: this.intercepts,
      reviews: this.reviews,
      steps: this.steps,
      nodes_used: [...this.nodesUsed],
      frames_processed: this.events.filter((e) => e.type === 'decision' || e.type === 'review').length,
      events: this.events,
      human_confirmed: this.reviewApproved && this.reviews.length > 0,
    };
  }
}

/** 批量复算：评测与 verify.py 用这条路径，保证与原型同一实现 */
export function evaluateCase(scene, options = {}) {
  const session = new Session(scene, options);
  for (const frame of scene.frames || []) {
    if (session.finished) break;
    session.pushFrame(frame);
  }
  return session.result();
}

/**
 * 端侧管线延迟建模：不是真机数据，仅用于证明链路预算。
 * 返回「每一次核对提示」的建模耗时（毫秒），对应官方「常规现场核对与提示 ≤2s」的口径；
 * 下限 380ms 按公开的眼镜端取帧 33ms + 端侧推理 240ms + 渲染 70ms + 传输/调度 37ms 估。
 */
export function modelPipelineLatency(scene, decisions) {
  const out = [];
  for (const d of decisions) {
    const frames = (scene.frames || []).filter((f) => f.step === d.step);
    const frame = frames[0];
    const n = frame ? (frame.objects || []).length : 0;
    const light = frame ? frame.light : 1;
    const darkPenalty = light < 0.5 ? 180 : 0;
    out.push(380 + n * 6 + darkPenalty);
  }
  return out;
}
