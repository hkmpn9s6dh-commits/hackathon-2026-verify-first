# 证据清单（闸 C 口径）

> 原则：全新 clone、只照 README 的命令跑。每条证据都可重复执行；不是截图自证。
> 本机环境：Windows 11 + Git Bash，node 22.23.4，Python 3.8.10。真机相关项全部未验证。

## 一、可执行证据

| # | 证据 | 命令 | 期望 |
| --- | --- | --- | --- |
| E1 | 场景集可复现 | `node scripts/gen_scenes.mjs /tmp/s.json && diff engine/scenes.json /tmp/s.json` | 无差异（同 seed=20261125） |
| E2 | 引擎单元测试 7 条 | `node scripts/test_engine.mjs` | `7 tests passed`，含 B0/B3 专测与阈值边界 |
| E3 | 评测汇总 | `node scripts/run_eval.mjs` | 48 例、acc=100%、false_allow=0、pipeline p95(m)=578ms |
| E4 | 全量自检 | `python verify.py` | `43 checks, 0 failed` / `ALL PASS` |
| E5 | 原型可跑 | `python -m http.server 8000` → `/web/` | 选场景、开始作业、拦截→处置→放行、报告弹窗 |
| E6 | 策划案与结果一致 | `python scripts/build_report.py && python verify.py` | REPORT.md 逐字重渲染一致，PDF 10 页 |

`scripts/verify.sh` 把 E1–E4 串起来，一条命令复验。

## 二、数字出处

| 数字 | 值 | 出处 |
| --- | --- | --- |
| 场景例数 / 帧数 | 48 / 240 | `results.json.summary.cases_total / frames_processed` |
| 判定正确率 | 100% | 逐例 `verdict == label`，`verify.py` 重算 |
| 漏判 / 误拦 | 0 / 0 | 同上 |
| 拦截例 / 复核例 / 复位例 | 32 / 8 / 8 | 逐例 `intercept_codes`、`reviews`、`verdict` |
| 事件总数 | 288 | 逐例 `events` 求和 |
| 引擎耗时 | p50 0.008 ms / p95 0.015 ms | `engine_samples_ms` 全部样本重算 |
| 建模提示延迟 | p50 398 ms / p95 578 ms | `pipeline_checks_modeled` 重算 |
| 阈值 | 0.80 / 0.55 | `engine/engine.js CONFIG.thresholds` → `results.json.thresholds` |
| 分支覆盖 | 场景集 6/8，单元测试补 B0、B3 | `verify.py` 第 5、8 节 |

## 三、原型证据（真实渲染，非手绘）

| 图 | 内容 | 生成方式 |
| --- | --- | --- |
| `docs/img/proto-allow.png` | 五步全过 → 「允许作业」，右侧步骤结论与 5 条留痕 | 无头 Edge 对 `/web/?auto=1&scene=normal-2` 截图 |
| `docs/img/proto-block.png` | 验电器自检失败 → 红框拦截 + 处置卡 | 无头 Edge 对 `/web/?auto=1&scene=tester_fail-1` 截图 |

复现：`msedge --headless=new --screenshot=out.png --window-size=1440,1000 --virtual-time-budget=3200 "http://127.0.0.1:8000/web/?auto=1&scene=tester_fail-1"`。

## 四、未验证项（如实列出）

| 项 | 原因 | 补做方式 |
| --- | --- | --- |
| 端侧取流/推理真实延迟 | 无 Rokid Glass 3 样机 | 拿到样机后按适配层接口替换建模值 |
| 镜片显示可读性（强光/弱光/3 米） | 无样机 | 现场 5 组光照实测 |
| 噪声环境语音 | 无样机 | 配电房背景噪声实测 |
| 真实设备识别准确率 | 场景集为合成检测结果 | 现场采集 ≥ 200 帧标注后测 |
| 续航/佩戴 | 无样机 | 单班 4 小时实测 |

## 五、自检记录

- 2026-11-25：`python verify.py` → 43 checks, 0 failed。
- 2026-11-25：PDF 10 页，A4，含两张真实渲染截图。
- 2026-11-25：原型与评测共用 `engine/engine.js`；`web/` 无重复阈值（`verify.py` 第 7 节）。
