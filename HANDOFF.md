# Codex 项目交接文档：阳光小镇物语

本文档用于下一次 Codex 或开发者接手项目时快速恢复上下文。它记录当前项目目标、技术环境、核心文件、最新道路/寻路/交通系统、测试方式、已知限制和后续建议。

## 当前项目状态

- 项目名：`sunny-town-story`
- 中文名：阳光小镇物语
- 类型：桌面端 3D 休闲城市经营游戏
- 画风：日系阳光小镇、低多边形、奶油色 HUD、樱花和玩具感建筑
- 技术：Python 静态服务 + Three.js + 原生 JavaScript + Playwright
- 主分支：`main`
- GitHub SSH：`git@github.com:ZhongH1216/sunny-town-story.git`
- GitHub Web：`https://github.com/ZhongH1216/sunny-town-story`

最近一次已知验证：

```powershell
npm.cmd test
```

预期：

```text
7 passed
```

## 用户偏好和需求背景

用户最初想要“超级炫酷的展示”，后来明确不喜欢赛博深色风格和资源调度玩法，要求改成：

- 可爱、日式、阳光、休闲风格
- 类似城市天际线，但休闲化
- 中文优先，不需要中英切换
- 不做移动端适配
- 目标桌面 16:9 大屏
- 增加真正的玩法内核和动画细节

当前版本已经完全移除旧版赛博指挥中心、雷达、告警、双语切换和调度动作，改为阳光小镇经营游戏。

## 运行环境

当前机器环境：

- 工作目录：`D:\Pycharm project\cool`
- Shell：PowerShell
- Python：`D:\python\anaconda\envs\aigo\python.exe`
- Git：`C:\Program Files\Git\cmd\git.exe`
- Node/npm 已安装

注意：

- `git` 不一定在 PowerShell PATH 中，建议使用完整路径：

```powershell
& "C:\Program Files\Git\cmd\git.exe" status
```

- `package.json`、`tools/run-tests.js`、`tools/start-server.js` 都绑定了 `aigo` 环境 Python 路径。
- 如果迁移到其他机器，需要修改上述文件中的 Python 路径。
- Windows PowerShell 直接 `Get-Content` 中文 UTF-8 文件时可能显示乱码，但浏览器、GitHub 和测试按 UTF-8 正常渲染。

## 核心文件

### `app.py`

Python 标准库静态服务器。

职责：

- 从项目根目录提供静态文件
- 默认监听 `127.0.0.1:8765`
- 使用 `ReusableThreadingTCPServer` 允许端口复用

### `index.html`

游戏 DOM 骨架。

包含：

- `#scene` Three.js canvas
- 顶部城市指标 HUD
- 左侧建造工具栏
- 普通道路 / 樱花大道道路模式切换
- 右侧城市顾问、交通概况、选中地块信息
- 底部时间、速度、暂停、当前工具提示

当前所有可见文案均为中文。

### `src/styles.css`

桌面 HUD 和视觉样式。

当前设计：

- 明亮天空蓝背景
- 奶油色面板
- 草地绿、樱花粉、温暖橙、清水蓝
- 桌面固定 HUD
- `min-width: 1180px`
- `min-height: 760px`

不做移动端布局。

### `src/app.js`

核心游戏逻辑和 Three.js 场景。

代码区块大致包括：

- 常量配置：网格尺寸、每周秒数、初始资金、最大移动体数
- `ROAD_TIERS`：普通道路和樱花大道的成本、维护费、容量、颜色和速度
- `BUILDINGS`：建筑成本、维护、税收、容量、岗位、服务、污染
- `city`：全局城市状态、地块、建筑、居民、视觉移动体、寻路缓存、道路版本号
- Three.js 场景：相机、灯光、地块、道路、建筑、树、云、樱花、移动体、气泡
- 道路系统：`roadTier`、`roadMask`、道路 mesh、自动连接刷新
- 寻路系统：A*、路径缓存、居民路线分配
- 交通系统：道路流量、容量、拥堵率、交通评分
- 建造/拆除：`place`、`bulldoze`、`canBuild`
- 模拟结算：`computeStats`、`advanceWeek`
- UI 渲染：`renderUI`、`advisorMessages`、`selectedDescription`
- 交互：工具选择、道路等级选择、地图点击、拖拽平移、滚轮缩放
- 测试接口：`window.sunnyTownTest`，仅 `?test=1` 暴露

### `tests/smoke.spec.js`

Playwright 测试。

当前覆盖：

- 1440 x 900 页面和 3D canvas 渲染
- 交通 HUD 和道路等级按钮可见
- 普通道路与樱花大道均可放置
- 樱花大道容量高于普通道路
- 道路 mask 正确表示直线、转角、T 字和十字
- 住宅到商业/工业可寻路时，居民路线、人口、税收和移动体正常
- 断路时出现不可达通勤顾问提示
- 大量通勤使普通道路拥堵并降低交通评分
- 视觉移动体数量不超过 60

### `tools/run-tests.js`

测试 runner。

职责：

- 使用 `aigo` Python 启动 `app.py`
- 等待 `http://127.0.0.1:8765`
- 调用本地 Playwright CLI
- 测试结束后关闭服务进程

### `tools/start-server.js`

后台启动本地服务。

当前输出已修正为：

```text
Started Sunny Town Story at http://127.0.0.1:8765
```

更推荐开发时使用前台：

```powershell
npm.cmd run serve
```

### `start-sunny-town.bat` / `启动阳光小镇.bat`

给用户双击使用的一键启动入口。

职责：

- 自动切换到项目根目录
- 检查 Node.js
- 如果缺少 `node_modules`，自动执行 `npm.cmd install`
- 调用 `node tools\start-server.js` 后台启动服务
- 自动打开 `http://127.0.0.1:8765`
- 启动失败时停在窗口里显示错误，避免双击后窗口瞬间消失

实现注意：

- 真实逻辑放在纯 ASCII 的 `start-sunny-town.bat`。
- `启动阳光小镇.bat` 只负责 `call start-sunny-town.bat`。
- 不要把复杂中文提示写进 `.bat` 的括号代码块里；cmd 在不同代码页下容易把 UTF-8 中文拆成半截命令。

## 数据结构摘要

地块 `city.tiles[]`：

```js
{
  x,
  z,
  type,
  buildingId,
  road,
  roadTier,        // null | "lane" | "avenue"
  roadMask,        // 北=1，东=2，南=4，西=8
  trafficLoad,
  trafficCapacity,
  congestion,
  coverage,
  pollution
}
```

建筑 `city.buildings[]`：

```js
{
  id,
  type,
  x,
  z,
  mesh,
  active
}
```

居民 `city.residents[]`：

```js
{
  id,
  homeId,
  destinationId,
  route,
  commuteTime,
  happiness
}
```

其他交通相关状态：

```js
city.visualAgents
city.pathCache
city.roadVersion
city.stats.traffic
city.stats.averageCongestion
city.stats.unreachableResidents
city.stats.averageCommute
```

## 游戏规则摘要

地图：

- 固定 18 x 18 网格
- 非道路建筑必须贴近道路
- 道路可相邻自动连接

道路：

- `lane`：普通道路，成本低、容量低
- `avenue`：樱花大道，成本高、容量高，并提供少量幸福度加成
- 建造或拆除道路会递增 `city.roadVersion` 并清空 `city.pathCache`
- 每条道路记录 `trafficLoad`、`trafficCapacity`、`congestion`

寻路：

- A* 只在道路格上运行
- 路径从“住宅邻近道路格”到“商业/工业邻近道路格”
- 使用曼哈顿启发
- 找不到路线时返回 `null`
- 路径缓存 key 包含道路版本号、起点和终点

居民：

- 模拟层为每个居民保留对象
- 每周根据住宅、人口和目的地重新分配路线
- 有路线的居民贡献就业、税收和道路流量
- 无路线的居民降低就业率、幸福度和顾问评分

交通：

- 居民路线经过的每条道路都会增加流量
- `congestion = trafficLoad / trafficCapacity`，上限为 2
- 全城平均拥堵越高，交通评分越低
- 交通评分影响幸福度和收入效率

视觉：

- 移动体来自真实居民路线采样
- 最多显示 60 个
- 长路线显示小车，短路线显示行人
- 拥堵时移动速度下降
- 道路拥堵较高时显示暖色覆盖层

目标：

- 人口 >= 800
- 幸福度 >= 75%
- 资金 > 0

达成后显示“阳光小镇已成型”，但可继续游玩。

## 测试接口

访问：

```text
http://127.0.0.1:8765/?test=1
```

会暴露：

```js
window.sunnyTownTest
```

接口：

```js
window.sunnyTownTest.place(type, x, z, options)
window.sunnyTownTest.advanceWeek(count)
window.sunnyTownTest.findPathByRoads(start, end)
window.sunnyTownTest.getState()
window.sunnyTownTest.setMoney(amount)
```

示例：

```js
window.sunnyTownTest.place("road", 3, 3, { tier: "avenue" });
window.sunnyTownTest.place("residential", 3, 4);
window.sunnyTownTest.advanceWeek(6);
window.sunnyTownTest.getState();
```

`getState()` 返回：

- `stats`
- `week`
- `selectedTool`
- `selectedRoadTier`
- `roadVersion`
- `buildingCount`
- `residentCount`
- `visualAgentCount`
- `roadCount`
- `roads`
- `residents`
- `messages`
- `advisor`

## 常用命令

运行：

```powershell
.\start-sunny-town.bat
```

或：

```powershell
cd "D:\Pycharm project\cool"
npm.cmd run serve
```

测试：

```powershell
npm.cmd test
```

Git 状态：

```powershell
& "C:\Program Files\Git\cmd\git.exe" status --short --branch
```

提交：

```powershell
& "C:\Program Files\Git\cmd\git.exe" add .
& "C:\Program Files\Git\cmd\git.exe" commit -m "..."
```

推送：

```powershell
& "C:\Program Files\Git\cmd\git.exe" push
```

## Git 和忽略规则

`.gitignore` 当前排除：

```text
node_modules/
test-results/
playwright-report/
__pycache__/
*.pyc
debug.log
.env
```

不要提交：

- `node_modules`
- `test-results`
- `debug.log`
- `__pycache__`
- `.env`

## 已知问题和注意事项

1. 没有存档系统，刷新页面会重置城市。
2. 没有道路升级工具，当前需要拆除重铺才能把普通道路换成樱花大道。
3. 地图大小固定，暂无随机地图或扩展地图。
4. 所有 3D 模型都是基础几何体组合，没有贴图或 GLTF 模型。
5. 当前模拟是休闲化 V1，数值模型强调可演示和反馈清晰，不追求真实城市级复杂度。
6. 不做移动端适配，不要为了小屏牺牲桌面 HUD。

## 推荐后续任务

高优先级：

- 增加 `localStorage` 存档 / 读档。
- 增加道路升级工具：点击普通道路可付费升级为樱花大道。
- 增加建筑升级系统：住宅、公寓、商店街、工坊等等级。
- 增加更详细的地块详情，例如服务覆盖、税收、维护、污染、可达性原因。

中优先级：

- 增加目标章节：新居民入住、商店街复兴、春日祭典。
- 加入更多日系装饰：便利店、神社、小河、桥、车站、祭典灯笼。
- 增加音效开关和背景音乐。
- 增加周报图表，显示人口、资金、交通和幸福度趋势。

低优先级：

- 随机地图种子。
- 截图导出。
- 英文语言支持。
- 移动端布局。

## 接手建议

下一位 Codex 接手时，建议先运行：

```powershell
npm.cmd test
```

再打开：

```powershell
npm.cmd run serve
```

重点观察：

- 3D 小镇是否正常显示
- 道路等级按钮是否可切换
- 道路是否能自动形成直线、转角、T 字和十字
- 住宅、商业、工业之间是否有小车或行人移动
- 拥堵路段是否出现暖色覆盖
- 顾问面板是否根据断路、拥堵、缺电、缺水实时更新

任何改动完成后都要重新运行 `npm.cmd test`。
