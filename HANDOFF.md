# 项目交接：阳光小镇物语

## 当前状态

- 项目：`sunny-town-story`，中文桌面 3D 小镇经营游戏；主分支 `main`。
- 当前版本：**`1.0.0-demo.4.1` 街区灵感修复版本，已发布，云端完整验收与公开附件下载校验通过**。
- 本轮重点：回应游戏单调、粗糙的反馈，让建筑位置形成可解释的组合，重制低多边形场景，并保留 CPU / 内存控制。
- 技术：Python 静态服务、Three.js、原生 JavaScript / CSS、WebAudio、Playwright。
- 仓库：[ZhongH1216/sunny-town-story](https://github.com/ZhongH1216/sunny-town-story)。当前 [demo.4.1 试玩已发布](https://github.com/ZhongH1216/sunny-town-story/releases/tag/v1.0.0-demo.4.1)；此前 demo.3 / demo.4 未发布附件。
- demo.4 已确认：83 项 Playwright 任务通过（68 浏览器 + 15 街区纯计算）、3 项美术 Node、2 项服务 Node；干净源码离线安装 / check / 实际 ZIP 通过。最后的小屏紧凑布局又通过 4 项 creative 回归，源代码已冻结。
- 2026-09-14：`2b01e29` 与 `v1.0.0-demo.4` 已推送；首次云端任务 `34767230535` 浏览器回归失败，包验证和发布被跳过。后续增加主分支验收、公开失败注释、连续失败上限和启动诊断；新增启动测试本地单独通过，未改动游戏代码。不能把本地结果标成云端通过。

demo.4.1：云端诊断 `34768181149` 确认 62 项通过、1 项读档星级界面失败、21 项因总时限未运行。暂停后在本地稳定复现，修复 `applySave` 末尾缺少界面刷新；4 项 creative 回归已通过。新增服务识别 7 项 Node 回归通过，修复版本将重新完整验收和打包，不移动既有 demo.4 标签。

旧 P0–P5 记录保留在 [开发计划](DEVELOPMENT_PLAN.md)。`docs/P5_RC_LOCK.md`、P5 QA 与素材提示词是历史资料，旧 RC 锁版限制不适用于本轮重做。

## 用户偏好

中文、明亮温暖、日式休闲；桌面键鼠与 16:9 优先，固定 18 × 18 地图。用户希望看见真正的建设策略，而不是更多纯等待清单；也明确在意 CPU 与内存占用。浏览器验证串行执行，结束后关闭临时进程。

本轮以 ISLANDERS 的空间组合和低多边形方向为启发，使用本项目原创程序几何。没有复制该游戏资产，也没有把 AI 换图或未测性能数字列为已完成。

## demo.4 机制与接入契约

### 街区灵感

`src/neighborhoods.js` 提供纯计算 `analyzeNeighborhoods(buildings, connectedPredicate)`、存档校验 `normalizeNeighborhoods(raw)` 和 `createNeighborhoods(api)` 控制器。

四主题为花园里巷、商店街、书香街坊、匠人街区，1–3 星逐级要求邻近住宅 / 公共建筑、道路连接与工业隔离；距离按横竖步数计算。隔离也检查未接路的住宅、工业，防止断路绕过条件。完整条件见 [试玩说明](docs/DEMO_RELEASE_NOTES.md)。

每主题只计最好的一处，1 / 2 / 3 星分别 ¥35 / ¥55 / ¥75 每周，全城游客收入硬上限 ¥250。首次合格可手动领取 ¥600，每种主题固定 ID 只领一次，使用独立 `city.neighborhoods = {version:1, claimed:[], focus:null}`，不复用 demo / life 奖励字段。

- `weekIncome()` 只返回当前收益，由主模拟在每周结算加一次；渲染、预览和统计重算不能发钱。
- `claim()` 支付前重新检查实际布局，记录 ID 并清空建造撤销，防止旧快照回滚奖励。
- 保存、读取、新故事、重置和撤销快照都要带上归一化后的可选字段；旧档缺失时安全初始化。
- `getRevision()` 缓存布局分析与建造预览，避免每次界面更新都执行邻近计算。布局或道路变化后必须更新 revision；`invalidate()` 可强制刷新。
- 建造预览返回星级变化和实际封顶后的游客收入差。若没有提供道路拓扑模拟接口，道路预览只给接路提示，不编造精确数值。
- `focus()` 免费且不改当前建设工具，只提供引导；卡片完整规则收在 `details`，保留展开状态。

### 观景与场景

`src/creative-controls.js` 管理临时观景状态：P 进入并暂停，P / Esc 返回时恢复先前暂停状态；观景期间可平移缩放，不应执行建设。欢迎、确认、祭典或图形恢复等阻塞状态与存档读取需由主入口正确协调。

`src/world-art.js` 重制低多边形海岛、建筑与环境；`src/art-batch.js` 将静态形状烘焙为顶点颜色缓冲区，按绘制方式合批。场景替换和拆除仍需释放归属几何资源。不能仅凭合批代码存在就宣称实机性能改善或硬件兼容通过。

### 帧率与存档

新玩家默认标准 30 帧，保留省电 24 / 流畅 60 帧选项；旧存档的有效偏好不被新默认覆盖。暂停、阻塞弹层降帧，后台停止绘制、模拟与音乐；具体帧率、资源测量方法与硬件限制见 [性能报告](docs/PERFORMANCE.md)。

存档仍为 v3，兼容旧 v1 / v2 / v3。`life` 和 `neighborhoods` 均为可选字段；观景模式不成为持久化城镇状态。本地存档与浏览器、地址、端口绑定，顶栏支持 JSON 导出 / 导入。

## 保留玩法

- `src/demo.js`：三种初始布局与故事目标，9 封手动领取的居民委托，4 份长期财政 / 幸福抉择，收集 6 枚邮票并满足条件、支付费用举办祭典后继续建设。
- `src/town-life.js`：每季 12 周，4 类活动各 2 方案，自愿参加后 6 周内累计 2 或 3 周达标；口碑解锁 3 项互斥永久项目，4 件纪念品首次集齐奖励 ¥5,000，记事最多 12 条。
- 旧五章、道路可达、服务容量、区位、城市事件、成就、升级和周报保留。人口和活动只随模拟周推进，统计重算与读档不能增长进度。
- 撤销仅限本周建设；结算或领取经济奖励清理旧撤销。无效存档在破坏当前城镇之前拒绝。

## 核心文件

| 文件 | 职责 |
| --- | --- |
| `src/app.js` | 主场景、模拟、输入、存档、性能设置与控制器桥接。 |
| `src/demo.js`、`src/town-life.js` | 故事 / 居民来信与四季活动 / 永久项目。 |
| `src/neighborhoods.js` | 街区纯计算、星级、预览、一次性奖励、独立存档归一化与卡片。 |
| `src/creative-controls.js` | 观景模式与临时暂停 / 焦点恢复。 |
| `src/world-art.js`、`src/art-batch.js` | 原创低多边形场景与几何合批。 |
| `index.html`、`src/interface.js` | DOM 契约、图标、页签、存档菜单与图例。 |
| `src/styles.css`、`src/demo-ui.css`、`src/creative-ui.css` | 基础界面、试玩手帖、街区和观景样式。 |
| `src/asset-manifest.js`、`assets/textures/` | 保留历史 PNG 生产源与合成音频配置；当前模型用顶点颜色，不预加载旧 PNG。 |
| `app.py`、`scripts/find-python.bat` | Python 本地静态服务与玩家解释器查找。 |
| `tools/package-local.js`、`tools/verify-package.js` | ZIP、SHA-256、运行文件检查及实际解压后的浏览器验证。 |
| `tests/neighborhoods.spec.js` | 无浏览器 fixture 的街区纯计算 / 控制器回归。 |

## 开发、验证与发布

环境与命令见 [开发指南](docs/DEVELOPMENT.md)。开发需要 Node.js 22、Python 3.10+ 和锁定 npm 依赖；Conda 可选。玩家试玩 ZIP 只需 Python 与 WebGL 2 浏览器，不需要 Node.js / npm / Conda，Python 不随包分发。

```powershell
npm.cmd ci
npm.cmd run install:browsers
npm.cmd run check
npm.cmd run test:server
npm.cmd run test:art
npm.cmd test
npm.cmd run verify:package
```

包名由 package.json 决定，当前为 `dist/sunny-town-story-1.0.0-demo.4.zip`，同时生成 `.zip.sha256`。构建递归复制 src，并显式检查街区、观景、合批模块和三份 CSS；完整 Three.js 运行依赖必须包括 three.module.js 和 three.core.js。最终验收必须针对 ZIP 解压目录，不能只验证源码服务。

GitHub 工作流支持 main 提交 / PR / 手动验收与版本标签发布；云端全部验证通过后，独立发布作业才创建带两个附件的草稿、检查完整性并公开。已有 Release 不覆盖，失败应查明原因，不能在文档里提前宣布上线。

## 验证记录与下一步

1. demo.4：完整干净源码日志为 `dist/demo4-clean-verification.log`，83 / 3 / 2 项检查通过；该轮 ZIP 70 文件全部校验通过，没有页面错误或失败资源。最后 4 项 creative 复验覆盖小屏紧凑街区界面。每次交付须把最终文档 / 截图一并重建并核对 ZIP，再执行版本标签与云端发布。
2. demo.4 三故事正常经济结果：海港 52 周 / 323 人 / 最低 ¥20,200；花园 35 周 / 264 人 / 最低 ¥18,324；商店街 65 周 / 403 人 / 最低 ¥25,200。没有额外注资。展示图 `docs/images/demo-4-town.png` 与 `demo-4-neighborhoods.png` 来自商店街通关存档，拍摄无页面错误；历史 demo.3 记录另见发布说明。
3. 历史 Chromium 默认 ANGLE 有 SharedImage 创建失败，软件 SwiftShader 验证通过不代表默认硬件后端已修复。继续记录后端、浏览器、设备和真实表现，不虚构 CPU 改善百分比。
4. 收集真实玩家对选址可读性、布局回报和长期玩法的反馈；报告附版本、周数、复现步骤，可选截图与 JSON 存档。

本版仍是桌面本地浏览器试玩，不含移动适配、随机地图或原生安装器。截图、测试结果、依赖与发行 ZIP 保持为本地产物，文档内明确引用的展示截图除外。

## 2026-09-16 收尾

84 项回归均已得到通过结果：干净源码完整运行通过 83 项，暂停帧率名义采样窗口出现边界失败；随后修正为页内真实经过时间并等待交互过渡，5 项性能回归全通过。未改游戏帧率上限或隐藏零帧要求。9 项服务 / 启动器与 3 项美术 Node 测试通过。完整日志 `dist/demo4-1-release-clean.log` 保留失败原记录，性能复验见 `dist/demo4-1-performance-verification.md`。云端改为 3 片各 28 项，全部通过后才验证实际 ZIP；最终 ZIP 已通过解压后的 78 文件清单 / 哈希、正常 UI 启程保存、推进读档、版本和服务退出检查，无页面异常或失败资源，日志 `dist/demo4-1-final-package.log`。准备提交、推送 main 与新标签后检查实际 Release 附件。

发布已完成：标签 `v1.0.0-demo.4.1` 对应 `5aa2595e9ed17010720cf09d52e1db750b09dd62`；云端三个分片 84 项全部通过，实际 ZIP 与发布作业成功。公开 ZIP 和 SHA-256 均已下载核验，详见 [发布验证记录](docs/RELEASE_VERIFICATION.md)。后续只更新主分支文档，不移动标签或覆盖附件。GitHub About 侧栏仍需要账号网页登录 / 管理接口权限；当前 SSH 可同步代码但不能设置该字段。
