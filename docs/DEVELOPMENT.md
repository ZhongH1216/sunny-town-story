# 开发指南

阳光小镇物语使用 Three.js、原生 JavaScript 和 Python 本地静态服务。当前开发与验收平台是 Windows，使用 Node.js 22、npm 和 Python 3.10 或更新版本；Playwright 用于浏览器回归。Conda 是可选开发工具，玩家运行试玩包不需要 Node.js、npm 或 Conda。

当前开发版本为 **1.0.0-demo.4 街区灵感**，已通过本地完整干净源码和实际 ZIP 验收；GitHub 附件状态以版本列表为准。

玩法、键鼠操作与玩家运行说明见 [项目首页](../README.md)。版本验收结果、试玩范围与已知限制见 [试玩发布说明](DEMO_RELEASE_NOTES.md)。

## 配置开发环境

以下命令在项目根目录的 PowerShell 中执行。先确认 Node.js 22 和 Python 3.10+ 可用，再按锁文件安装依赖与测试浏览器：

```powershell
node --version
python --version
npm.cmd ci
npm.cmd run install:browsers
npm.cmd run check
npm.cmd run serve
```

首次安装 npm 依赖和 Playwright Chromium 通常需要网络。开发服务默认位于 <http://127.0.0.1:8765/>；保持服务终端运行，按 `Ctrl+C` 停止。普通页面从欢迎菜单选择故事，`http://127.0.0.1:8765/?test=1` 仅供调试，会开放 `window.sunnyTownTest` 测试接口。

如果使用已有的 Conda 安装，可通过仓库脚本配置 `sunny-town-dev` 环境：

```powershell
.\scripts\setup-dev.bat
conda activate sunny-town-dev
npm.cmd ci
npm.cmd run check
npm.cmd run serve
```

该脚本会创建或更新环境、安装依赖和 Playwright Chromium。已有环境也可以直接使用前面的手动安装流程；不需要为此安装 Conda。

Python 路径与端口可通过环境变量配置：

```powershell
$env:SUNNY_TOWN_PYTHON = "C:\你的Python目录\python.exe"
$env:SUNNY_TOWN_PORT = "8765"
npm.cmd run serve
```

也可在本地 `.env` 中设置 `SUNNY_TOWN_PYTHON` 和 `SUNNY_TOWN_PORT`。`.env` 不随源码提交。浏览器存档按地址与端口隔离，切换测试端口不会自动带入另一个端口的存档。

## 项目结构

| 路径 | 作用 |
| --- | --- |
| `app.py` | 本地静态服务、缓存策略和受控停止入口。 |
| `start-sunny-town.bat`、`stop-sunny-town.bat` | Windows 玩家启动与停止脚本。 |
| `src/app.js` | 城市模拟、道路寻路、主场景、输入、存档与性能设置。 |
| `src/demo.js` | 三种故事、居民来信、市政抉择、祭典与试玩弹层。 |
| `src/town-life.js` | 四季活动、口碑、永久社区项目、收藏和活动记录。 |
| `src/world-art.js`、`src/art-batch.js` | 原创低多边形海岛与建筑、顶点颜色几何合批。 |
| `src/neighborhoods.js` | 四主题空间组合、预览、游客收益、一次性奖励与独立存档归一化。 |
| `src/creative-controls.js`、`src/creative-ui.css` | 观景状态 / 暂停恢复与街区、观景界面。 |
| `index.html`、`src/demo-ui.css`、`src/interface.js` | 欢迎页、建设工具、手帖、弹层和界面交互。 |
| `src/styles.css`、`src/asset-manifest.js`、`assets/textures/` | 基础样式与历史 PNG 生产源；当前模型使用顶点颜色，已删除旧贴图预加载。 |
| `tests/` | 经营、试玩、活动、存档、稳定性、图形、性能和界面回归。 |
| `tools/`、`scripts/` | 环境配置、测试入口、启动代理和发布包工具。 |

地图为 18 × 18，当前交互面向桌面键鼠。模拟时间按周推进，每季 12 周；统计重算、建造和读取存档不应额外推进人口或活动进度。存档格式为 v3，兼容旧 v1 / v2 / v3 数据，`life` 和 demo.4 新增的 `neighborhoods` 均为可选字段。

街区按格距、已连接道路和物理污染隔离计算，每主题只结算最佳一处。控制器的 `weekIncome()` 只返回收益，由主模拟在周结算加一次；`render()`、`preview()` 和 `analyze()` 不改变资金。`getRevision()` 必须随建筑 / 道路布局变化更新，以复用分析与预览；首次领取用独立 ID，清理旧撤销并持久化。

新玩家画面默认标准 30 帧（设置值 `balanced`），旧存档有效偏好保留。观景是临时呈现状态，退出恢复进入前的暂停状态，不写成持久化暂停。

调整经营或存档时，要区分每周模拟、统计重算、界面呈现与持久化操作。暂停、确认框、祭典结局、后台页面和图形连接丢失时的行为，也属于玩家流程的一部分。

## 验证改动

先运行与改动相关的检查；完整浏览器回归由项目脚本管理本地服务。当前 Playwright 配置为单工作进程，避免多个 3D 浏览器同时占用 CPU 和内存。

```powershell
npm.cmd run test:server
npm.cmd run test:art
npm.cmd test
```

`test:art` 通过 Node 内置测试运行器检查模型几何、共享模板与资源释放，不创建浏览器；它会在 GitHub 工作流和干净源码验收的 `test:server` 后运行。

**demo.4 当前记录：83 项 Playwright 任务通过（68 项浏览器回归 + 15 项街区纯计算），3 项美术几何 / 资源测试、2 项服务 / 启动代理测试通过；干净源码离线 npm 安装、环境检查与实际 ZIP 验收通过。** `tests/neighborhoods.spec.js` 不请求 page / browser fixture，用数据模块导入实际源码，单独执行无需启动浏览器。

完整日志为本地 `dist/demo4-clean-verification.log`，该轮从干净源码构建的实际 ZIP 有 70 个文件且哈希全部一致。后续文档和展示截图变更后需重新构建交付 ZIP。历史 demo.3 数字保留在发布说明中，不用于替代本版记录；性能方法与对照结果见[性能报告](PERFORMANCE.md)。

按范围检查时，可以运行单个测试文件或界面测试：

```powershell
npm.cmd test -- tests/demo.spec.js
npm.cmd test -- tests/town-life.spec.js
npm.cmd test -- tests/neighborhoods.spec.js
npm.cmd test -- tests/stability.spec.js
npm.cmd run test:visual
```

三场景长局验收使用正常周收入和界面可见的来信操作，不注入额外资金。涉及经济调整时，关注完成周数、最低余额与无法继续的具体条件；涉及存档时，覆盖读取、旧版本迁移、导入取消和无效文件保留原城镇。

### 可选的软件渲染验证

demo.3 验证时，本机 Chromium 的默认 ANGLE 后端出现过 SharedImage 创建失败和图形连接丢失。因此，demo.3 的完整浏览器及发布包验收显式使用 SwiftShader：

```powershell
$env:SUNNY_TOWN_SOFTWARE_WEBGL = "1"
npm.cmd test
npm.cmd run verify:package
```

需要回到默认验证后端时，在当前 PowerShell 中移除该变量：

```powershell
Remove-Item Env:SUNNY_TOWN_SOFTWARE_WEBGL -ErrorAction SilentlyContinue
```

该变量只为测试浏览器选择软件渲染参数，交付游戏仍使用浏览器默认后端。**软件后端验证通过不代表硬件兼容问题已解决，也不能作为真实 GPU 性能结论。** 记录结果时注明使用的后端、浏览器与设备；发布包验证结果会记录请求的后端。

## 构建与检查试玩包

```powershell
npm.cmd run package:local
npm.cmd run verify:package
```

`package:local` 根据 `package.json` 中的版本生成目录、ZIP、包内文件校验清单和压缩包的 `.sha256` 文件。当前输出为：

```text
dist/sunny-town-story-1.0.0-demo.4/
dist/sunny-town-story-1.0.0-demo.4.zip
dist/sunny-town-story-1.0.0-demo.4.zip.sha256
```

`verify:package` 会重新构建，并从实际 ZIP 解压后检查文件哈希、浏览器启动、场景截图、试玩入口、存档和服务启停。截图与结果写入 `dist/package-verification/`；普通玩家模式使用浏览器实际截图检查场景，测试模式才读取保留的绘图缓冲区。

构建递归复制整个 `src`，并通过共享的 `runtimeSourceFiles` 清单确认街区、观景、合批模块与三份样式存在且非空。解压包验证对这些文件进行清单 / 哈希检查和 HTTP 请求，实际浏览器仍检查场景与所有失败资源。新增独立的必需模块时，应同步这份最低运行契约。

试玩包包含 Three.js 运行文件及素材，玩家无需安装 npm 依赖。包内不提供 Python 运行时，也不包含原生安装程序。

## 干净源码验证

```powershell
npm.cmd run verify:clean
```

该命令在 `dist/clean-source-check/` 创建排除本地依赖和输出产物的源码副本，重新执行 `npm ci`、环境检查、服务与启动脚本测试、场景几何 / 资源释放测试、浏览器回归和发布包验证，并为测试服务选择独立端口。它包含完整验证流程，不必与另外一轮全量测试并行运行。

已有完整 npm 缓存时，也可以验证离线安装：

```powershell
npm.cmd run verify:clean -- --offline
```

离线检查仍需要预先安装 Playwright Chromium。若使用软件渲染验证，先设置前述 `SUNNY_TOWN_SOFTWARE_WEBGL` 环境变量；该配置会传给干净源码中的验证进程。

`dist/`、`test-results/`、`playwright-report/`、`node_modules/`、本地配置和服务日志是本地产物。提交改动时，说明问题、改动后的行为、实际运行的检查和未覆盖的情形；贡献建议见 [参与贡献](../CONTRIBUTING.md)。

## GitHub 验证与预发布

仓库的 [验证与发布工作流](https://github.com/ZhongH1216/sunny-town-story/actions/workflows/release.yml) 在 `main` 提交、面向 `main` 的 Pull Request 和手动运行时执行验收；推送 `v` 开头、与 `package.json` 版本一致的标签时，还会发布试玩预发布。

云端浏览器任务使用 line / JUnit / GitHub 三种报告器，累计 3 项失败即停止、总测试限时 10 分钟，为 15 分钟作业预算内的诊断上传留出时间。`tests/boot.spec.js` 在启动失败时输出页面异常、缺失资源与 WebGL 状态，避免只有后续交互超时。失败或未运行的用例仍会阻止发布，不自动重试或跳过失败断言。

工作流使用 Windows、Node.js 22、Python 3.12 和显式 SwiftShader，依次安装锁定依赖与浏览器、检查环境、依次运行服务、场景几何及浏览器测试，再验证实际 ZIP。只有全部通过，独立发布作业才上传 ZIP 和 SHA-256 校验文件，并发布 [版本说明](GITHUB_RELEASE.md)。普通验证只有读取仓库的权限；发布作业使用 GitHub 内置临时令牌，无需保存个人令牌。

发布前同步 `package.json`、锁文件、README 下载链接和版本说明，再提交并推送版本标签。已经公开发布的标签与附件不覆盖；后续修复应使用新版本。构建或验证失败时，先在 Actions 中查看失败步骤和诊断附件。
