# 阳光小镇物语

一个使用 Three.js 制作的桌面 3D 休闲城市经营游戏。当前版本已经推进到 P4 收尾：在道路等级、居民通勤、拥堵反馈和小车/行人动画基础上，加入了存档、章节目标、建筑升级、事件、成就、服务容量、区位策略、音效动效、撤销、镜头控制和第一批像素贴图资产。

项目采用中文界面，视觉方向是蓝天、草地、云朵、樱花、奶油色 HUD 和低多边形玩具感建筑。玩法参考城市建设经营游戏，但节奏更轻松，适合展示和继续迭代。

运行测试后会生成桌面截图：

```text
test-results/sunny-town-desktop.png
```

该目录只用于本地验证，默认不会提交到 GitHub。

## 功能概览

- 18 x 18 固定网格地图
- 桌面 16:9 优先的 3D 斜俯视小镇
- 鼠标拖拽平移、滚轮缩放、格子 hover 高亮
- 普通道路和樱花大道两级道路
- 道路四向自动连接，支持直线、转角、T 字和十字路口视觉
- 每个居民拥有独立住宅、目的地、通勤路线、通勤时间和满意度
- A* 道路寻路，使用道路版本号缓存路线
- 道路流量、容量、拥堵率和全城交通评分
- 最多 60 个真实路线采样的可视化移动体，包括小车和行人
- 版本化本地存档、继续游戏、手动保存、自动保存、新游戏和存档迁移入口
- 5 章主线目标、新手任务链、章节奖励、成就、城市事件和周报趋势
- 建筑升级、复合解锁条件、地标装饰和升级外观差异
- 服务覆盖结合半径、道路可达和容量压力，幸福度会拆分显示具体原因
- 建筑落地弹跳、云朵漂移、树冠轻摆、樱花飘落、施工/升级/税收/人口/章节反馈
- WebAudio 背景音乐和操作音效，支持静音、音量和音乐开关
- 一步撤销、快捷键、镜头回中、缩放按钮和拖拽边界
- `AssetManifest` 管理像素贴图、音频提示和资源路径，PNG 贴图优先加载并保留 canvas 回退
- 城市顾问实时提示断路、无通勤路径、拥堵、缺水、缺电、就业不足、财政压力和服务缺口
- Playwright 自动化测试覆盖核心玩法、长局模拟、P4 表现功能和桌面视觉回归

## 建造工具

| 工具 | 作用 |
| --- | --- |
| 普通道路 | 成本低、容量低，适合早期连接住宅和岗位 |
| 樱花大道 | 成本高、容量高，带少量幸福度加成，适合主干路和拥堵路段 |
| 住宅 | 提供人口容量，居民会从住宅出发通勤 |
| 商业 | 提供岗位、税收和消费目的地 |
| 工业 | 提供更多岗位和税收，但会提高污染与交通压力 |
| 公园 | 提升附近住宅幸福度，缓冲污染压力 |
| 学校 | 提升教育覆盖和长期幸福度 |
| 消防站 | 提升消防覆盖和居民安心感 |
| 电力 | 为附近建筑供电 |
| 水塔 | 为附近建筑供水 |
| 小广场 | 提供文化和公园类服务，适合章节中期的宜居核心 |
| 小车站 | 提供交通服务和主干路节点，适合商业/工业扩张 |
| 祭典灯 | 提供节庆和文化氛围，提升附近住宅吸引力 |
| 拆除 | 拆除建筑或道路，返还少量资金并刷新道路网络 |

## 经营系统

初始资金为 `¥50,000`。时间按周推进，每 `4` 秒结算一周。

核心指标：

- 资金
- 人口 / 人口容量
- 幸福度
- 就业率
- 交通
- 电力覆盖
- 水力覆盖
- 教育覆盖
- 消防覆盖
- 污染

主要规则：

- 非道路建筑必须邻近道路才可建造和运行。
- 普通道路容量较低，樱花大道容量更高，同等流量下拥堵更低。
- 住宅贡献人口容量，人口会根据幸福度、服务和基础设施逐周增长。
- 商业和工业提供岗位与税收，居民需要能通过道路寻路到达目的地。
- 无法寻路的居民会降低就业率、幸福度和建筑有效性。
- 道路拥堵会降低交通评分，并间接降低税收效率和幸福度。
- 电力、水力、就业、交通、污染、教育、消防、公园、文化、交通服务和财政健康共同影响幸福度。
- 服务设施有容量压力，且需要道路可达才能稳定覆盖住宅。
- 住宅、商业和工业有不同区位偏好，主干路、服务、污染隔离会影响成长效率。
- 章节目标会逐步解锁建筑、道路策略和地标，完成后提供资金、幸福度或维护折扣等奖励。
- 城市事件会制造短期经营压力或奖励，不会随机毁档。
- 存档会保留城市网格、建筑、道路、资源、章节、任务、成就、设置和随机状态。
- 资金低于 `-10,000` 并持续多周会触发财务危机提示。
- 达到人口 `800`、幸福度 `75%`、资金为正时，会显示“阳光小镇已成型”，但仍可继续游玩。

## 技术栈

- Python 标准库 HTTP Server
- Three.js
- JavaScript ES Modules
- CSS
- Playwright
- Node.js / npm

项目没有使用 React、Vue、Vite 等前端框架。

## 目录结构

```text
.
├─ app.py                  # Python 静态文件服务器
├─ index.html              # 游戏页面结构
├─ assets/
│  └─ textures/            # P4 像素 PNG 贴图资产
├─ docs/
│  └─ ASSET_PIPELINE.md    # 像素贴图和 AI 辅助资源制作流程
├─ src/
│  ├─ app.js               # Three.js 场景、城市模拟、道路寻路、交通动画
│  ├─ asset-manifest.js    # 贴图、音效和资源路径清单
│  └─ styles.css           # 桌面 HUD 和日系阳光视觉样式
├─ tests/
│  ├─ smoke.spec.js        # Playwright 核心玩法、长局和 P4 表现测试
│  └─ visual.spec.js       # 桌面视觉回归截图测试
├─ tools/
│  ├─ generate-textures.js # 按资源清单生成可复现像素 PNG
│  ├─ run-tests.js         # 启动 Python 服务并运行测试
│  └─ start-server.js      # 后台启动本地服务
├─ package.json
├─ package-lock.json
├─ playwright.config.js
├─ HANDOFF.md
└─ .gitignore
```

## 环境要求

当前项目推荐使用仓库提供的 conda 开发环境，不再绑定某台机器的 Python 绝对路径：

- Windows
- Anaconda 或 Miniconda
- `sunny-town-dev` conda 环境，包含 Python 3.12、Node.js 和 npm

首次克隆后可以一键准备环境：

```powershell
.\scripts\setup-dev.bat
```

或者使用 PowerShell 脚本：

```powershell
.\scripts\setup-dev.ps1
```

如果只想先安装 Python/Node/npm 和 npm 依赖，暂时跳过 Playwright 浏览器下载：

```powershell
.\scripts\setup-dev.bat --skip-browsers
```

之后进入开发环境：

```powershell
conda activate sunny-town-dev
```

项目会按以下顺序寻找 Python：

1. `.env` 或系统环境变量中的 `SUNNY_TOWN_PYTHON`
2. Windows 的 `py -3`
3. `python`
4. `python3`

双击 `start-sunny-town.bat` 时，如果系统 PATH 中没有 Node/npm/Python，但本机已经有 `sunny-town-dev`，启动器也会自动复用该 conda 环境。

如果你的 Python 不在 PATH 中，可以复制 `.env.example` 为 `.env`，再填写本机路径：

```text
SUNNY_TOWN_PYTHON=C:\Python\python.exe
SUNNY_TOWN_HOST=127.0.0.1
SUNNY_TOWN_PORT=8765
```

`package.json` 当前脚本：

```json
{
  "assets:textures": "tools\\node-shim.cmd tools\\generate-textures.js",
  "check": "tools\\node-shim.cmd tools\\check-env.js",
  "install:browsers": "npx playwright install chromium",
  "setup": "scripts\\setup-dev.bat",
  "serve": "tools\\node-shim.cmd tools\\serve.js",
  "start": "tools\\node-shim.cmd tools\\start-server.js",
  "test": "tools\\node-shim.cmd tools\\run-tests.js",
  "test:visual": "tools\\node-shim.cmd tools\\run-tests.js tests/visual.spec.js"
}
```

## 安装依赖

如果已经激活 `sunny-town-dev`，也可以手动安装依赖：

```powershell
npm.cmd install
```

可以先检查本地环境：

```powershell
npm.cmd run check
```

如果 Playwright 浏览器缺失，运行：

```powershell
npm.cmd run install:browsers
```

## 本地运行

最简单的方式：在项目根目录双击：

```text
start-sunny-town.bat
```

它会自动进入项目目录，首次运行时安装 npm 依赖，启动本地服务，并打开浏览器访问游戏。

如果本机还没有 `sunny-town-dev`，但已经安装 conda，启动器会自动调用 `scripts\setup-dev.bat --skip-browsers` 创建开发环境并安装基础依赖。Playwright 浏览器只用于自动化测试，普通游玩不需要先下载它。

根目录也保留了 `启动阳光小镇.bat`，它只是转发到英文启动器。英文文件名更推荐，因为 Windows 批处理在不同编码环境下处理中文内容容易出错。

启动后会保留一个命令行窗口。这个窗口就是本地游戏服务器：

- 游玩时保持窗口打开。
- 想结束游戏时，关闭这个窗口或在窗口里按 `Ctrl+C`。
- 如果之前旧版启动器留下了后台服务，双击 `stop-sunny-town.bat` 或 `停止阳光小镇.bat` 清理。
- `stop-sunny-town.bat` 会按 `server.pid` 和 `8765` 端口双重清理，适合处理窗口异常关闭后的残留服务。

命令行方式：

```powershell
cd "D:\python project\sunny-town-story"
npm.cmd run serve
```

然后打开：

```text
http://127.0.0.1:8765
```

也可以尝试后台启动：

```powershell
npm.cmd start
```

`npm.cmd start` 是后台启动模式，适合开发调试；普通游玩更推荐双击 `start-sunny-town.bat`，这样关闭窗口就会停止服务。

## 测试

```powershell
npm.cmd test
```

当前预期结果：

```text
31 passed
```

视觉截图回归：

```powershell
npm.cmd run test:visual
```

资源贴图重新生成：

```powershell
npm.cmd run assets:textures
```

测试覆盖：

- 1440 x 900 桌面页面加载
- Three.js canvas 非空像素信号
- 普通道路和樱花大道均可放置
- 樱花大道容量高于普通道路
- 道路 mask 自动更新为直线、转角、T 字和十字
- 居民获得真实道路路线，人口和税收增长
- 存档恢复道路、建筑、章节、建筑等级和成就
- 章节奖励、复合解锁、升级条件、新手任务链和 P2 长局通关
- 服务道路可达、容量压力、区位收益、财政压力和 P3 300 周长局
- 断路或不可达时顾问面板出现交通提示
- 大量通勤会提高普通道路拥堵并降低交通评分
- 视觉移动体数量大于 0 且不超过 60
- P4 音频设置、背景音乐开关、快捷键、撤销、镜头控制和表现动效
- 1440 x 900、1366 x 768 视觉框架截图

## 测试接口

仅当 URL 带 `?test=1` 时，页面会暴露：

```js
window.sunnyTownTest
```

可用方法：

```js
window.sunnyTownTest.place(type, x, z, options)
window.sunnyTownTest.advanceWeek(count)
window.sunnyTownTest.findPathByRoads(start, end)
window.sunnyTownTest.getState()
window.sunnyTownTest.setMoney(amount)
window.sunnyTownTest.saveGame(manual)
window.sunnyTownTest.loadSave(snapshot)
window.sunnyTownTest.serializeGame()
window.sunnyTownTest.startNewGame(options)
window.sunnyTownTest.upgradeSelectedBuilding()
window.sunnyTownTest.upgradeState(x, z)
window.sunnyTownTest.setSettings(settings)
window.sunnyTownTest.undo()
```

示例：

```js
window.sunnyTownTest.place("road", 4, 4, { tier: "avenue" });
window.sunnyTownTest.place("residential", 4, 5);
window.sunnyTownTest.advanceWeek(4);
console.log(window.sunnyTownTest.getState().stats.traffic);
```

`getState()` 会返回统计数据、章节、存档状态、设置、资源清单摘要、贴图加载状态、动效数量、撤销栈、镜头状态、道路列表、建筑列表、居民路线、顾问消息和视觉移动体数量，方便自动化测试和调试。

## GitHub

仓库地址：

```text
git@github.com:ZhongH1216/sunny-town-story.git
```

网页地址：

```text
https://github.com/ZhongH1216/sunny-town-story
```

主分支：

```text
main
```

## 已知限制

- 只做桌面 16:9 优先布局，不做移动端适配。
- 当前是休闲化经营原型，不是完整大型城市模拟器。
- 地图固定为 18 x 18，暂不支持随机地图、扩展地图或地形编辑。
- 当前 PNG 贴图为可复现占位资产，最终 AI 辅助或手工美术替换仍留到 P5 前资源制作。
- 建筑、车辆、居民、道路和粒子仍主要由 Three.js 基础几何体生成，建筑表面已优先加载项目内 PNG 像素贴图并保留 canvas 回退；暂未引入 GLTF 模型。
- 居民是模拟层独立对象，但屏幕上只抽样显示最多 60 个移动体以控制性能。

## 后续路线

建议优先级：

1. 完成 P5 QA：新游戏、继续游戏、坏存档、章节通关、极端城市和低性能设备。
2. 替换当前占位 PNG 为最终 AI 辅助或手工像素贴图，并保留资源清单路径稳定。
3. 完成玩家说明、游戏内帮助页、版本号、更新日志和已知问题文档。
4. 做满图/满居民性能基线，必要时优化移动体、材质和 UI 渲染。
5. 评估离线发布包；默认保持桌面浏览器本地运行，后续再考虑 Electron/Tauri。

## License

MIT
