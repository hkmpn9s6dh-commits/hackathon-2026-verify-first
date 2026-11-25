/** 第一视角画面：一台 10kV 开关柜的示意绘制（纯 SVG，无外部素材）。
 *  画面元素与合成场景的检测框坐标对齐：bbox 用 0–1 归一化坐标，乘 1000×625 即得落点。 */

export const VIEW_W = 1000;
export const VIEW_H = 625;

export function buildSceneSvg() {
  return `
<svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="配电柜第一视角">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b3841"/><stop offset="0.5" stop-color="#182028"/><stop offset="1" stop-color="#0a0f12"/>
    </linearGradient>
    <linearGradient id="cab" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3e4c56"/><stop offset="0.4" stop-color="#2b363e"/><stop offset="1" stop-color="#1a2228"/>
    </linearGradient>
    <linearGradient id="door" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#35444e"/><stop offset="1" stop-color="#212b32"/>
    </linearGradient>
    <linearGradient id="plate" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e2e6e8"/><stop offset="0.5" stop-color="#b3bbc0"/><stop offset="1" stop-color="#828c92"/>
    </linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cfd8de"/><stop offset="1" stop-color="#74828b"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7fd8ea" stop-opacity="0.16"/><stop offset="0.5" stop-color="#7fd8ea" stop-opacity="0.02"/><stop offset="1" stop-color="#7fd8ea" stop-opacity="0.1"/>
    </linearGradient>
    <radialGradient id="lampOn"><stop offset="0" stop-color="#d9ffe9"/><stop offset="0.4" stop-color="#3ddc84"/><stop offset="1" stop-color="#0c3d24"/></radialGradient>
    <radialGradient id="lampOff"><stop offset="0" stop-color="#778086"/><stop offset="1" stop-color="#242b30"/></radialGradient>
    <radialGradient id="vign" cx="0.5" cy="0.45" r="0.72">
      <stop offset="0.4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.66"/>
    </radialGradient>
    <pattern id="stripes" width="24" height="24" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="24" height="24" fill="#ffb02e" opacity="0.65"/><rect width="12" height="24" fill="#151515" opacity="0.9"/>
    </pattern>
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>

  <rect width="${VIEW_W}" height="${VIEW_H}" fill="url(#wall)"/>
  <g opacity="0.14" stroke="#7fd8ea" stroke-width="0.6">
    ${Array.from({ length: 14 }, (_, i) => `<line x1="${i * 76 + 8}" y1="0" x2="${i * 76 + 8}" y2="${VIEW_H}"/>`).join('')}
    ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${i * 70 + 14}" x2="${VIEW_W}" y2="${i * 70 + 14}"/>`).join('')}
  </g>

  <!-- 地面 -->
  <rect x="0" y="548" width="${VIEW_W}" height="77" fill="#080c0e"/>
  <g stroke="#1b262d" stroke-width="1">
    <line x1="0" y1="574" x2="${VIEW_W}" y2="574"/><line x1="0" y1="604" x2="${VIEW_W}" y2="604"/>
  </g>

  <!-- 柜体 -->
  <g filter="url(#soft)">
    <rect x="120" y="50" width="640" height="520" rx="8" fill="url(#cab)" stroke="#4b5a64" stroke-width="1.5"/>
    <rect x="132" y="62" width="616" height="496" rx="4" fill="url(#door)" stroke="#3d4a54"/>
    <line x1="470" y1="62" x2="470" y2="558" stroke="#182025" stroke-width="2"/>
    <rect x="462" y="300" width="7" height="64" rx="3" fill="#5d6c75" opacity="0.9"/>
    <!-- 散热槽 -->
    <g fill="#0d1317" opacity="0.9">
      ${Array.from({ length: 8 }, (_, i) => `<rect x="152" y="${86 + i * 12}" width="136" height="4.5" rx="2"/>`).join('')}
    </g>
    <!-- 仪表 -->
    <g>
      <circle cx="690" cy="128" r="34" fill="#101619" stroke="#4a5963" stroke-width="1.4"/>
      <circle cx="690" cy="128" r="27" fill="none" stroke="#2b373e"/>
      <path d="M668 136a22 22 0 0 1 44 0" fill="none" stroke="#58d5f0" stroke-width="2.4" opacity="0.85"/>
      <line x1="690" y1="128" x2="702" y2="114" stroke="#cfe6ee" stroke-width="1.8"/>
      <circle cx="690" cy="128" r="2.2" fill="#cfe6ee"/>
    </g>
    <!-- 母线室 -->
    <rect x="316" y="282" width="300" height="126" rx="5" fill="#10171c" stroke="#3a474f"/>
    <rect x="330" y="338" width="272" height="13" rx="3" fill="#8a5a2b"/>
    <rect x="330" y="338" width="272" height="4.5" rx="2" fill="#cf8f48"/>
    <g fill="#b7c2c9">${[360, 448, 566].map((x) => `<circle cx="${x}" cy="344" r="4.4"/>`).join('')}</g>
    <text x="322" y="388" font-size="10.5" fill="#6d7f8a" letter-spacing="2.4">BUS BAR 10kV</text>
    <rect x="316" y="282" width="300" height="126" rx="5" fill="url(#glass)" pointer-events="none"/>
    <!-- 把手 -->
    <g id="handle">
      <rect x="536" y="152" width="40" height="18" rx="4" fill="#0d1216" stroke="#4d5b64"/>
      <rect x="541" y="157" width="30" height="8" rx="3" fill="#94a2ab"/>
      <rect x="566" y="170" width="8" height="16" fill="#5b6871" rx="2"/>
    </g>
    <!-- 铭牌 -->
    <g id="plateGroup">
      <rect x="290" y="108" width="252" height="60" rx="3" fill="url(#plate)" stroke="#5f6a70" stroke-width="1.2"/>
      <rect x="296" y="114" width="240" height="48" rx="2" fill="none" stroke="#727b80" stroke-width="0.8"/>
      <text x="308" y="136" font-size="16" fill="#1e2428" font-weight="700" letter-spacing="2.5">102</text>
      <text x="308" y="154" font-size="10.5" fill="#3a4248" letter-spacing="1.4">1号进线 · 10kV 开关柜</text>
      <text x="440" y="136" font-size="8" fill="#4b545a">双重编号</text>
      <circle cx="524" cy="126" r="3.6" fill="#8a9298" stroke="#5f686e"/>
      <rect x="290" y="108" width="252" height="60" rx="3" fill="url(#glass)"/>
    </g>
    <rect x="132" y="530" width="616" height="15" fill="url(#stripes)" opacity="0.5"/>
  </g>

  <!-- 接地线 -->
  <g id="prop-cable">
    <path d="M196 470 C 240 536, 316 556, 366 492" stroke="#c4471f" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M196 470 C 240 536, 316 556, 366 492" stroke="#ff8a5f" stroke-width="2.6" fill="none" stroke-linecap="round" opacity="0.6"/>
  </g>

  <!-- 接地夹 -->
  <g id="prop-clamp" transform="translate(326,424)">
    <rect x="0" y="20" width="196" height="9" rx="3" fill="url(#steel)" opacity="0.92"/>
    <g id="clampJaw" transform-origin="26 25">
      <path d="M2 34 L2 6 Q2 0 9 0 L34 0 L34 9 L11 9 Q11 34 11 34 Z" fill="#c2ccd2" stroke="#6d7a83"/>
      <path d="M50 34 L50 6 Q50 0 43 0 L18 0 L18 9 L41 9 Q41 34 41 34 Z" fill="#9aa7af" stroke="#6d7a83"/>
    </g>
    <circle cx="26" cy="25" r="4.6" fill="#48545c"/>
    <rect x="62" y="16" width="96" height="6" rx="3" fill="#79868f" opacity="0.65"/>
    <text x="4" y="52" font-size="9" fill="#7f8f99" letter-spacing="1.6">GROUND CLAMP</text>
  </g>

  <!-- 手套（握住验电器手柄） -->
  <g id="prop-hand" transform="translate(654,300) scale(0.9)">
    <rect x="46" y="6" width="72" height="150" rx="26" fill="#3d4a52" stroke="#5d7079" stroke-width="1.3"/>
    <g fill="#42505a" stroke="#5d7079" stroke-width="1.2">
      <rect x="2" y="18" width="60" height="26" rx="13"/>
      <rect x="0" y="50" width="62" height="27" rx="13.5"/>
      <rect x="2" y="83" width="60" height="27" rx="13.5"/>
      <rect x="8" y="116" width="54" height="25" rx="12.5"/>
    </g>
    <path d="M58 18 Q96 12 112 30" stroke="#2b353b" stroke-width="2" fill="none" opacity="0.55"/>
    <path d="M58 138 Q96 146 112 128" stroke="#2b353b" stroke-width="2" fill="none" opacity="0.55"/>
  </g>

  <!-- 验电器（探头已接触母线） -->
  <g id="prop-tester" transform="translate(640,228)">
    <rect x="0" y="0" width="118" height="64" rx="11" fill="#162126" stroke="#54646e" stroke-width="1.5"/>
    <rect x="10" y="10" width="68" height="34" rx="5" fill="#080d10"/>
    <circle id="lamp" cx="28" cy="27" r="9.5" fill="url(#lampOff)" stroke="#55636b"/>
    <rect x="48" y="20" width="22" height="5" rx="2.5" fill="#31404a"/>
    <rect x="48" y="30" width="16" height="4" rx="2" fill="#31404a"/>
    <circle cx="96" cy="20" r="4" fill="#3d4a53"/>
    <circle cx="96" cy="34" r="4" fill="#3d4a53"/>
    <rect x="18" y="64" width="44" height="78" rx="10" fill="#1c272d" stroke="#46545d"/>
    <g stroke="#2f3c44" stroke-width="2">
      <path d="M24 82 L56 82"/><path d="M24 94 L56 94"/><path d="M24 106 L56 106"/><path d="M24 118 L56 118"/>
    </g>
    <path d="M14 142 L-84 108" stroke="#aab7be" stroke-width="7" stroke-linecap="round"/>
    <path d="M14 142 L-84 108" stroke="#d6e0e6" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
    <path d="M-84 108 l-16 -6 l6 16 z" fill="#c6d2d9" stroke="#6e7c85" stroke-width="1"/>
    <circle cx="-100" cy="104" r="3.2" fill="#ff6a6a" opacity="0.9"/>
    <text x="0" y="168" font-size="9.5" fill="#7b8b95" letter-spacing="2">AC 10kV TESTER</text>
  </g>

  <!-- 挂牌 -->
  <g id="prop-tag" transform="translate(546,170)">
    <line id="tagWire" x1="26" y1="-18" x2="26" y2="6" stroke="#8c9aa3" stroke-width="1.8"/>
    <g id="tagPlate">
      <rect x="0" y="6" width="84" height="94" rx="4" fill="#eae5d8" stroke="#9a9384" stroke-width="1.2"/>
      <rect x="6" y="12" width="72" height="82" rx="2" fill="none" stroke="#b64040" stroke-width="1.4"/>
      <text x="42" y="38" font-size="12.5" fill="#b64040" text-anchor="middle" font-weight="700">禁止合闸</text>
      <text x="42" y="56" font-size="12.5" fill="#b64040" text-anchor="middle" font-weight="700">有人工作</text>
      <text x="42" y="80" font-size="8" fill="#6b6455" text-anchor="middle">工作票</text>
    </g>
  </g>

  <rect width="${VIEW_W}" height="${VIEW_H}" fill="url(#vign)" pointer-events="none"/>
  <circle id="focusRing" cx="410" cy="138" r="90" fill="none" stroke="#58d5f0" stroke-width="1.2" opacity="0.3" stroke-dasharray="3 7"/>
</svg>`;
}

/** 每帧的视觉状态：灯亮不亮、牌挂没挂、夹紧没夹紧、道具显隐 */
export function applyFrameVisuals(root, frame, step) {
  if (!root || !frame) return;
  const find = (cls) => (frame.objects || []).find((o) => o && o.cls === cls);
  const lamp = root.querySelector('#lamp');
  const tagPlate = root.querySelector('#tagPlate');
  const tagWire = root.querySelector('#tagWire');
  const clampJaw = root.querySelector('#clampJaw');
  const props = {
    tester: root.querySelector('#prop-tester'),
    tag: root.querySelector('#prop-tag'),
    clamp: root.querySelector('#prop-clamp'),
    cable: root.querySelector('#prop-cable'),
    hand: root.querySelector('#prop-hand'),
  };

  const tester = find('tester');
  if (lamp) {
    const on = tester && tester.attrs && tester.attrs.self_test_light === true;
    lamp.setAttribute('fill', on ? 'url(#lampOn)' : 'url(#lampOff)');
    lamp.setAttribute('filter', on ? 'url(#glow)' : 'none');
  }

  const tag = find('tag');
  if (tagPlate && tag) {
    const onHandle = tag.attrs && tag.attrs.on_handle === true;
    tagPlate.setAttribute('transform', onHandle ? 'rotate(0)' : 'translate(-320,300) rotate(72 42 53)');
    if (tagWire) tagWire.setAttribute('opacity', onHandle ? '1' : '0');
  }

  const clampObj = find('clamp');
  if (clampJaw && clampObj) {
    const ok = clampObj.attrs && clampObj.attrs.torque_ok === true;
    clampJaw.setAttribute('transform', ok ? 'rotate(0 26 25)' : 'rotate(-28 26 25)');
  }

  const focusKey = { 1: 'plate', 2: 'tester', 3: 'tester', 4: 'clamp', 5: 'tag' }[step];
  // 只让本步相关的器具出现在画面里，避免无关道具干扰阅读
  const visible = {
    1: ['hand'],
    2: ['tester', 'hand'],
    3: ['tester', 'hand', 'cable'],
    4: ['clamp', 'cable', 'hand'],
    5: ['tag', 'hand'],
  }[step] || [];
  Object.entries(props).forEach(([k, el]) => {
    if (!el) return;
    const on = visible.includes(k);
    el.style.display = on ? '' : 'none';
    el.style.opacity = k === focusKey ? '1' : '0.55';
    el.style.transition = 'opacity 260ms ease';
  });
  const plate = root.querySelector('#plateGroup');
  if (plate) plate.style.opacity = focusKey === 'plate' ? '1' : '0.55';

  const ring = root.querySelector('#focusRing');
  if (ring) {
    const key = { 1: 'nameplate', 2: 'tester', 3: 'probe', 4: 'clamp', 5: 'tag' }[step];
    const tgt = find(key) || find('tester');
    if (tgt && tgt.bbox) {
      const cx = (tgt.bbox[0] + tgt.bbox[2] / 2) * VIEW_W;
      const cy = (tgt.bbox[1] + tgt.bbox[3] / 2) * VIEW_H;
      const r = Math.max(tgt.bbox[2] * VIEW_W, tgt.bbox[3] * VIEW_H) * 0.82;
      ring.setAttribute('cx', cx.toFixed(1));
      ring.setAttribute('cy', cy.toFixed(1));
      ring.setAttribute('r', r.toFixed(1));
    }
    ring.style.opacity = '0.45';
  }
}

/** 检测框叠层（HTML 层，便于文字排版） */
export function renderOverlay(el, frame, decision) {
  if (!el) return;
  if (!frame) { el.innerHTML = ''; return; }
  const tone = !decision
    ? 'idle'
    : decision.state === 'pass' || decision.state === 'review_pass'
      ? 'ok'
      : decision.state === 'block'
        ? 'bad'
        : decision.state === 'review'
          ? 'warn'
          : 'idle';
  const boxes = (frame.objects || [])
    .filter(Boolean)
    .map((o) => {
      const [x, y, w, h] = o.bbox || [0, 0, 0, 0];
      const isTarget = decision && decision.node === o.cls;
      return `<div class="box ${isTarget ? tone : 'dim'}" style="left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%">
        <span>${o.cls} ${o.conf.toFixed(2)}</span></div>`;
    })
    .join('');
  el.innerHTML = boxes;
}
