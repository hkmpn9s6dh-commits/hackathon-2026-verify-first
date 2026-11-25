import { CONFIG, Session, CODES } from '../engine/engine.js';
import { buildSceneSvg, applyFrameVisuals, renderOverlay } from './view.js';

const $ = (id) => document.getElementById(id);
const els = {
  scene: $('scene'),
  run: $('run'),
  reset: $('reset'),
  svg: $('sceneSvg'),
  overlay: $('overlay'),
  hint: $('hint'),
  taskChip: $('taskChip'),
  frameMeta: $('frameMeta'),
  verdictMain: $('verdictMain'),
  verdictSub: $('verdictSub'),
  confVal: $('confVal'),
  nodeVal: $('nodeVal'),
  logVal: $('logVal'),
  stepChip: $('stepChip'),
  steps: $('steps'),
  stepstrip: $('stepstrip'),
  log: $('log').querySelector('tbody'),
  export: $('export'),
  actionCard: $('actionCard'),
  actionKicker: $('actionKicker'),
  actionTitle: $('actionTitle'),
  actionBody: $('actionBody'),
  actionButtons: $('actionButtons'),
  modal: $('reportModal'),
  reportBody: $('reportBody'),
  clock: $('clock'),
  engineMeta: $('engineMeta'),
};

const state = {
  data: null,
  scene: null,
  session: null,
  idx: 0,
  timer: null,
  paused: false,
  finished: false,
  lastDecision: null,
  lastFrame: null,
};

const STEP_NAMES = CONFIG.nodes.map((n) => n.name);
const CAT_LABEL = {};

function fmtClock() {
  const d = new Date();
  els.clock.textContent = d.toLocaleTimeString('zh-CN', { hour12: false });
}

function reset() {
  clearInterval(state.timer);
  state.timer = null;
  state.session = null;
  state.idx = 0;
  state.paused = false;
  state.finished = false;
  state.lastDecision = null;
  state.lastFrame = null;
  els.log.innerHTML = '';
  els.actionCard.hidden = true;
  els.export.disabled = true;
  els.run.disabled = false;
  els.run.textContent = '开始作业';
  els.logVal.textContent = '0 条';
  els.confVal.textContent = '—';
  els.nodeVal.textContent = '—';
  els.verdictMain.textContent = '待开始';
  els.verdictMain.className = 'v-main';
  els.verdictSub.textContent = '引擎将逐帧核对关键视觉节点';
  els.hint.className = 'hint';
  els.hint.textContent = '选择场景后点「开始作业」';
  els.stepChip.textContent = '第 1 / 5 步';
  els.taskChip.textContent = '等待开始';
  els.frameMeta.textContent = '1280×720 · 30fps';
  renderOverlay(els.overlay, null, null);
  renderSteps();
  paintFocus(1);
}

function paintFocus(step) {
  const svg = els.svg.querySelector('svg');
  if (svg) {
    svg.querySelectorAll('#prop-tester,#prop-tag,#prop-clamp,#prop-cable,#prop-hand').forEach((el) => {
      el.style.opacity = '0.5';
    });
    const plate = svg.querySelector('#plateGroup');
    if (plate) plate.style.opacity = '0.55';
    const ring = svg.querySelector('#focusRing');
    if (ring) ring.style.opacity = '0.18';
  }
}

function renderSteps() {
  const session = state.session;
  const passed = new Map((session?.steps || []).map((s) => [s.step, s.state]));
  const cur = session && !state.finished ? session.step : null;
  const blockedStep = session && state.finished && session.result().verdict === 'block' ? session.result().blocked_at_step : null;

  els.steps.innerHTML = CONFIG.nodes
    .map((n, i) => {
      const st = passed.get(n.step) || (blockedStep === n.step ? 'block' : '');
      const cls = st || (cur === n.step ? 'active' : '');
      const tag = st === 'pass' ? '通过' : st === 'review_pass' ? '复核通过' : st === 'block' ? '拦截' : cur === n.step ? '进行中' : '待核对';
      return `<li class="${cls}"><span class="dot">${n.step}</span><span>${n.name}</span><span class="st">${tag}</span></li>`;
    })
    .join('');

  els.stepstrip.innerHTML = CONFIG.nodes
    .map((n, i) => {
      const st = passed.get(n.step) || (blockedStep === n.step ? 'block' : '');
      const cls = st || (cur === n.step ? 'active' : '');
      return `<div class="sstep ${cls}"><span class="n">STEP ${String(i + 1).padStart(2, '0')}</span><span class="t">${n.name}</span></div>`;
    })
    .join('');
}

function renderLog() {
  const events = state.session?.events || [];
  els.log.innerHTML = events
    .map((e) => {
      const typeCls = e.type === 'decision' ? (e.code === 'I-PASS' ? 'pass' : e.code?.startsWith('W-LOW-CONF') ? 'review' : 'block') : e.type;
      const label = CODES[e.code]?.label || (e.type === 'human' ? '人工复核' : e.type === 'resolve' ? '处置复位' : '—');
      return `<tr class="${typeCls}">
        <td>${e.seq}</td>
        <td>${e.t == null ? '—' : Number(e.t).toFixed(2)}</td>
        <td>${e.step ?? '—'}</td>
        <td>${e.node || '—'}</td>
        <td>${e.conf == null || Number.isNaN(e.conf) ? '—' : Number(e.conf).toFixed(2)}</td>
        <td class="c">${label}</td>
      </tr>`;
    })
    .join('');
  els.logVal.textContent = `${events.length} 条`;
  els.log.parentElement.parentElement.scrollTop = 0;
}

function setVerdictCard(kind, main, sub) {
  els.verdictMain.textContent = main;
  els.verdictMain.className = `v-main ${kind || ''}`;
  els.verdictSub.textContent = sub;
}

function showAction(kind, decision) {
  const node = CONFIG.nodes.find((n) => n.step === decision.step);
  els.actionCard.hidden = false;
  if (kind === 'review') {
    els.actionKicker.textContent = '人工复核 · 需要人确认';
    els.actionTitle.textContent = `第 ${decision.step} 步置信度不足`;
    els.actionBody.textContent = `${decision.hint}。请班长在画面内核对后选择结论；复核记录会写入留痕。`;
    els.actionButtons.innerHTML = `
      <button class="primary" id="approveBtn">确认符合，继续</button>
      <button class="ghost" id="rejectBtn">判为不符合</button>`;
    $('approveBtn').onclick = () => {
      els.actionCard.hidden = true;
      const r = state.session.approveReview();
      handleResult(r, false);
      resume();
    };
    $('rejectBtn').onclick = () => {
      els.actionCard.hidden = true;
      finish('block', 'H-REJECT', '人工复核判为不符合，作业终止');
    };
  } else {
    els.actionKicker.textContent = '异常处置 · 已拦截';
    els.actionTitle.textContent = `${CODES[decision.code]?.label || '异常'}：${node?.name || ''}`;
    els.actionBody.textContent = `${decision.hint}。按现场规程处置后，重新对准目标再核验；处置动作与复验结果都会留痕。`;
    els.actionButtons.innerHTML = `<button class="primary" id="repairBtn">按提示处置并重试</button>`;
    $('repairBtn').onclick = () => {
      els.actionCard.hidden = true;
      const frame = state.session.repairFrame();
      state.lastFrame = frame;
      const r = state.session.pushFrame(frame);
      applyFrameVisuals(els.svg, frame, frame.step);
      renderOverlay(els.overlay, frame, { ...r, node: frame.objects[0]?.cls });
      handleResult(r, true);
      resume();
    };
  }
}

function handleResult(res, fromRepair) {
  state.lastDecision = res;
  if (res.verdict) state.finished = true;
  els.stepChip.textContent = `第 ${Math.min(res.step || 1, 5)} / 5 步`;
  if (res.conf != null && !Number.isNaN(res.conf)) els.confVal.textContent = Number(res.conf).toFixed(2);
  const node = CONFIG.nodes.find((n) => n.step === res.step);
  if (node) els.nodeVal.textContent = node.name.replace(/·.*/, '');
  renderLog();
  renderSteps();

  if (res.state === 'pass') {
    els.hint.className = 'hint pass';
    els.hint.textContent = `第 ${res.step} 步通过 · ${res.hint}`;
    setVerdictCard('', '核对通过', res.hint);
  } else if (res.state === 'review_pass') {
    els.hint.className = 'hint pass';
    els.hint.textContent = `第 ${res.step} 步复核通过`;
    setVerdictCard('', '复核通过', '人工确认已写入留痕');
  } else if (res.state === 'block') {
    els.hint.className = 'hint block';
    els.hint.textContent = `已拦截 · ${res.hint}`;
    setVerdictCard('block', '已拦截', `${CODES[res.code]?.label || ''}｜${res.hint}`);
  } else if (res.state === 'review') {
    els.hint.className = 'hint review';
    els.hint.textContent = `转人工复核 · ${res.hint}`;
    setVerdictCard('review', '待复核', res.hint);
  }

  if (res.verdict) {
    finish(res.verdict, state.session.result().block_code, '');
  }
}

function resume() {
  if (state.finished) return;
  state.paused = false;
  clearInterval(state.timer);
  state.timer = setInterval(tick, 780);
}

function tick() {
  if (state.paused || state.finished) return;
  const frames = state.scene.frames;
  if (state.idx >= frames.length) {
    const v = state.session.result();
    finish(v.verdict, v.block_code, '');
    return;
  }
  const frame = frames[state.idx++];
  state.lastFrame = frame;
  applyFrameVisuals(els.svg, frame, frame.step);
  const res = state.session.pushFrame(frame);
  renderOverlay(els.overlay, frame, { ...res, node: frame.objects?.find((o) => CONFIG.nodes.some((n) => n.key === o.cls))?.cls });
  els.frameMeta.textContent = `1280×720 · 30fps · t=${frame.t.toFixed(2)}s`;
  handleResult(res, false);

  if (!state.finished) {
    if (res.state === 'block') {
      state.paused = true;
      clearInterval(state.timer);
      showAction('repair', res);
    } else if (res.state === 'review') {
      state.paused = true;
      clearInterval(state.timer);
      showAction('review', res);
    }
  }
}

function finish(verdict, code, note) {
  state.finished = true;
  state.paused = true;
  clearInterval(state.timer);
  const v = state.session ? state.session.result() : { verdict, events: [], intercepts: [] };
  const finalVerdict = verdict || v.verdict;
  els.run.disabled = true;
  els.export.disabled = false;
  els.actionCard.hidden = true;
  renderSteps();
  renderLog();
  if (finalVerdict === 'allow') {
    setVerdictCard('allow', '允许作业', '五步核对完成，全部节点有据可查');
    els.hint.className = 'hint pass';
    els.hint.textContent = '五步核对完成 · 作业许可已生成，报告可导出';
  } else {
    setVerdictCard('block', '禁止作业', `${CODES[code]?.label || '核对未通过'}${note ? `｜${note}` : ''}`);
    els.hint.className = 'hint block';
    els.hint.textContent = `作业已终止 · ${CODES[code]?.label || note || '核对未通过'}`;
  }
  els.export.onclick = openReport;
}

function buildSelect() {
  const groups = new Map();
  for (const c of state.data.cases) {
    if (!groups.has(c.category)) groups.set(c.category, []);
    groups.get(c.category).push(c);
  }
  els.scene.innerHTML = [...groups.entries()]
    .map(([cat, cases]) => {
      const name = cases[0].category_name;
      const label = { allow: '放行', block: '拦截', review: '复核' }[cases[0].label];
      return `<optgroup label="${name}｜应判 ${label}（${cases.length} 例）">${cases
        .map((c) => `<option value="${c.id}">${c.id} · ${c.task.bay} ${c.task.feeder} · ${c.task.work}</option>`)
        .join('')}</optgroup>`;
    })
    .join('');
}

function selectScene(id) {
  const scene = state.data.cases.find((c) => c.id === id) || state.data.cases[0];
  state.scene = scene;
  reset();
  els.taskChip.textContent = `${scene.task.bay} ${scene.task.feeder}｜${scene.task.work}｜票号 ${scene.task.ticket}`;
  const first = scene.frames[0];
  state.lastFrame = first;
  applyFrameVisuals(els.svg, first, 1);
  renderOverlay(els.overlay, first, null);
  els.hint.textContent = `${scene.category_name}：点「开始作业」按帧核验（${scene.frames.length} 帧）`;
}

function start() {
  if (!state.scene) return;
  reset();
  selectScene(state.scene.id);
  state.session = new Session(state.scene);
  state.idx = 0;
  els.run.disabled = true;
  els.export.disabled = true;
  setVerdictCard('', '核验中', '逐帧判定中，异常将即时拦截');
  renderSteps();
  state.timer = setInterval(tick, 780);
  tick();
}

function openReport() {
  const scene = state.scene;
  const v = state.session.result();
  const rows = v.events
    .map((e) => {
      const label = CODES[e.code]?.label || (e.type === 'human' ? '人工复核' : e.type === 'resolve' ? '处置复位' : '—');
      return `<tr><td>${e.seq}</td><td>${e.t == null ? '—' : Number(e.t).toFixed(2)}</td><td>${e.step ?? '—'}</td><td>${
        CONFIG.nodes.find((n) => n.key === e.node)?.name || e.node || '—'
      }</td><td>${e.conf == null || Number.isNaN(e.conf) ? '—' : Number(e.conf).toFixed(2)}</td><td>${label}</td><td>${e.note || ''}</td></tr>`;
    })
    .join('');
  els.reportBody.innerHTML = `
    <p>作业任务：<b>${scene.task.bay} ${scene.task.feeder}</b> · ${scene.task.work}　工作票：${scene.task.ticket}</p>
    <dl class="kv">
      <div><dt>最终结论</dt><dd>${v.verdict === 'allow' ? '允许作业' : '禁止作业'}</dd></div>
      <div><dt>核对步骤</dt><dd>${v.steps.length} / 5</dd></div>
      <div><dt>拦截次数</dt><dd>${v.intercepts.length}</dd></div>
      <div><dt>留痕条数</dt><dd>${v.events.length}</dd></div>
    </dl>
    <h3>逐步结论</h3>
    <table><thead><tr><th>步骤</th><th>节点</th><th>状态</th></tr></thead><tbody>
      ${CONFIG.nodes
        .map((n) => {
          const st = v.steps.find((s) => s.step === n.step);
          return `<tr><td>${n.step}</td><td>${n.name}</td><td>${st ? (st.state === 'pass' ? '通过' : '人工复核通过') : '未完成'}</td></tr>`;
        })
        .join('')}
    </tbody></table>
    <h3>全事件留痕（${v.events.length} 条）</h3>
    <table><thead><tr><th>#</th><th>t/s</th><th>步</th><th>节点</th><th>置信</th><th>结论</th><th>说明</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="sign"><span>作业人签字</span><span>监护人签字</span><span>生成时间：${new Date().toLocaleString('zh-CN')}</span></div>`;
  els.modal.hidden = false;
}

async function boot() {
  fmtClock();
  setInterval(fmtClock, 1000);
  els.svg.innerHTML = buildSceneSvg();
  els.engineMeta.textContent = `engine ${CONFIG.version} · pass ≥ ${CONFIG.thresholds.pass.toFixed(2)} · review ≥ ${CONFIG.thresholds.review.toFixed(2)}`;

  try {
    const res = await fetch('../engine/scenes.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();
  } catch (err) {
    els.hint.className = 'hint block';
    els.hint.textContent = `场景集加载失败（${err.message}）。请用本地 HTTP 服务打开：在仓库根目录运行 python -m http.server 8000，再访问 /web/`;
    els.run.disabled = true;
    return;
  }

  buildSelect();
  state.data.cases.forEach((c) => (CAT_LABEL[c.category] = c.category_name));
  selectScene(state.data.cases[0].id);
  els.scene.onchange = () => {
    els.run.disabled = false;
    selectScene(els.scene.value);
  };
  els.run.onclick = start;
  els.reset.onclick = () => {
    els.run.disabled = false;
    selectScene(els.scene.value);
  };
  $('closeReport').onclick = () => (els.modal.hidden = true);
  $('printReport').onclick = () => window.print();
  els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) els.modal.hidden = true;
  });

  const params = new URLSearchParams(location.search);
  if (params.get('scene')) {
    els.scene.value = params.get('scene');
    selectScene(params.get('scene'));
  }
  if (params.get('auto') === '1') start();
}

boot();
