# SPEC · 先验电 Verify First（闸 A 定稿）

> 官方评分表（原文摘录）：完整解决方案 40%｜核心 AI 与眼镜效果 25%｜稳定性与部署 20%｜通用与商业交付 10%｜体验与合理创新 5%。
> 官方硬指标：常规现场核对与提示 ≤ 2 秒；失败与超时同样计入统计；每任务 ≥ 2 个关键视觉识别节点；扫码/语音/问答只能配套，不能替代核心视觉识别；须有异常处置、人工复核、过程留痕。

## 1. 要做的事（一句话）

把 10kV 开关柜停电检修的「铭牌核对—验电器自检—验电—接地—挂牌」五步，做成眼镜端不可跳过的顺序门禁，并把每次判定留成可审计的过程记录。

## 2. 黄金路径（演示脚本，也是原型的默认剧情）

1. 班长建任务：间隔 102、工作内容「母线停电检修」、票号。
2. 作业人走到 101 间隔。铭牌读作「101 2号出线」，与票不符 → 红框拦截、语音提示，作业不能继续。
3. 退到 102，铭牌核对通过。
4. 验电器自检：指示灯不亮 → 判「验电器失效」，要求更换；换表后自检通过。
5. 探头接触出线端子、确认无电压 → 通过。
6. 接地夹夹上检修母线、扭矩到位 → 通过。
7. 「禁止合闸，有人工作」牌挂上把手 → 通过。
8. 五步全过，生成报告：每步时间、置信度、判定、处置与复核记录，双签栏。

## 3. 可判定的验收条件

| # | 验收条件 | 证据 | 状态 |
| --- | --- | --- | --- |
| AC-1 | 五个步骤按序推进，未判过的步骤不能进入下一步 | `engine/engine.js` Session；`scripts/test_engine.mjs`；原型逐步演示 | PASS |
| AC-2 | 每步只有一个关键视觉节点，共 5 个（≥2） | `CONFIG.nodes`；`results.json.visual_nodes = 5` | PASS |
| AC-3 | 三态判定：≥0.80 通过、0.55–0.80 复核、<0.55 失败 | 单元测试第 4、5 条；`results.json.thresholds` | PASS |
| AC-4 | 走错间隔在第一步被拦截，且不继续后续步骤 | `wrong_bay-*` 8 例全部 block，`blocked_at_step=1` | PASS |
| AC-5 | 验电器自检失败被拦截 | `tester_fail-*` 8 例，`E-TESTER-SELFTEST` | PASS |
| AC-6 | 未挂牌被拦截 | `no_tag-*` 8 例，`E-TAG-MISSING` | PASS |
| AC-7 | 接地不良被拦截，处置后复位放行并留痕 | `ground_loose-*` 8 例 allow 且含 `E-GROUND-LOOSE` + `W-RECOVERED` | PASS |
| AC-8 | 低置信转人工复核，确认后放行 | `lowlight-*` 8 例，`reviews` 非空、`human_confirmed=true` | PASS |
| AC-9 | 每次判定写入事件流（时间、步骤、节点、置信度、结论） | `results.json` 288 条事件；原型「事件留痕」表 | PASS |
| AC-10 | 报告包含逐步结论、全事件、签字栏 | 原型「导出本次报告」 | PASS |
| AC-11 | 文档中的每个数字都能从 `results.json` 复算 | `verify.py` 第 2、3、9 节 | PASS |
| AC-12 | 原型显示的判定来自引擎，不另写一套 | `verify.py` 第 7 节（import 检查、无重复阈值） | PASS |
| AC-13 | 单次核对提示 ≤ 2000 ms | 建模 p95 578 ms（**建模，非真机**） | 待真机 |
| AC-14 | 真机取流/推理/显示/续航 | — | 未验证（待样机） |

## 4. 适配层接口（真机联调用，本轮为桩）

```
CameraSource.getFrame() -> {t, width, height, light, objects[]}
  objects[]: {cls, bbox[4], conf, attrs{}}
Display.showStep(step, prompt)
Display.showVerdict(state: 'pass'|'review'|'block', code, hint)
Voice.speak(text) / Voice.onConfirm(cb)
Sync.pushTask(task) / Sync.pushEvent(event) / Sync.finishReport(report)
```

判定引擎只依赖 `objects[]`，因此换相机、换模型、换显示方案都不改判定逻辑。

## 5. 范围（过闸 A 后只删不加）

- **做**：五步门禁、三态、异常处置、人工复核、留痕与报告、合成场景评测、复验脚本。
- **不做**：真机演示与实拍视频（无样机）、闭源 SDK 逆向、人员识别、自动放行、多场景并行。
