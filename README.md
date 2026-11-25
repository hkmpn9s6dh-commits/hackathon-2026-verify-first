# 先验电 Verify First

**Rokid 眼镜上的「停电—验电—接地—挂牌」五步核对门禁。**
Spatial Joy 2026 Rokid 全球开发大赛 · 行业命题赛道 · 智能作业 · 命题一「灵眸·操作防误」

报名策划案：[`submission/REPORT.pdf`](submission/REPORT.pdf)（10 页，中文）

## 这是什么

一副会「盯步骤」的眼镜。作业人戴上 Rokid Glass 3，系统按工作票把任务拆成五步，每一步只有一个关键视觉节点，必须在第一视角画面里被判过才能进入下一步；判不过就当场拦截并给出处置提示，处置后重新核验；置信度不足转人工复核；全过程逐帧留痕，收工自动生成带签字栏的核对报告。

- **判的是顺序，不是单点**：只识别到铭牌不算通过，必须在正确的步骤、对正确的对象、满足该步全部属性条件。
- **三态而不是二值**：置信度 ≥ 0.80 判过；0.55–0.80 转人工复核；< 0.55 判失败。阈值集中一处，可标定、可审计。
- **可复算**：原型与离线评测共用同一个判定引擎；策划案里的每个数字都能用 `verify.py` 复算。

## 快速开始

```bash
# 1) 看原型（任选其一）
python -m http.server 8000        # 然后打开 http://localhost:8000/web/
# 或直接打开线上版：https://hkmpn9s6dh-commits.github.io/hackathon-2026-verify-first/web/

# 2) 复验全部数字与一致性（需要 node 与 python）
node scripts/gen_scenes.mjs      # 生成 48 例合成场景（同 seed 可复现）
node scripts/test_engine.mjs     # 7 条单元测试
node scripts/run_eval.mjs        # 出 results/results.json
python verify.py                 # 43 条断言，全部现算
```

`python scripts/build_report.py` 会用 `report/report_template.md` + `results/results.json` 重新生成策划案（MD/HTML/PDF）。

## 目录

```
engine/engine.js     判定引擎与会话状态机（浏览器与评测共用同一份）
engine/scenes.json   合成场景集：6 类 × 8 例 = 48 例 / 240 帧
web/                 可运行原型（第一视角、步骤核对、异常处置、人工复核、报告、留痕）
results/results.json 实测结果：逐例判定、延迟、分支覆盖
report/              策划案模板（占位符由 results.json 填充）
submission/          REPORT.md / REPORT.html / REPORT.pdf
docs/                SPEC、证据清单、UI 说明、原型截图
scripts/             场景生成、评测、单元测试、报告构建、引擎导出
verify.py            交付物自检：重算指标、复跑引擎、比对文档与原型
```

## 已实测 / 已建模 / 未验证

| 项 | 数字 | 口径 |
| --- | --- | --- |
| 合成集判定正确率 | 100%（48/48） | 合成场景，仅证明规则一致性，**不是现场准确率** |
| 漏判 / 误拦 | 0 / 0 | 同上 |
| 判定引擎耗时（每例） | p50 0.008 ms / p95 0.015 ms | 本机 Node 实测，说明规则本身不是瓶颈 |
| 单次核对提示延迟 | 建模 p50 398 ms / p95 578 ms（预算 2000 ms） | **端侧管线建模，非真机实测** |
| 关键视觉节点 | 5 个（要求 ≥ 2） | 官方硬指标 |
| 异常分支 | 设计 8 条，场景集覆盖 6 条，单元测试补 B0/B3 | 见 `verify.py` |
| 真机取流/推理/显示/续航 | — | **未验证（待样机）** |

## 边界

- 本轮没有 Rokid Glass 3 样机：所有真机相关项标注「未验证（待样机）」，不伪造实机截图或实机视频。
- 合成场景的检测结果是人工设定的，只能证明规则、阈值与链路；现场准确率必须在样机与真实作业中测。
- 不逆向闭源 SDK：`docs/00-SPEC.md` 给出适配层接口与桩，真机联调按接口替换。
- 系统是辅助核对工具，作业许可的最终责任仍在工作负责人；报告保留双签栏。

## 许可

MIT，见 `LICENSE`。
