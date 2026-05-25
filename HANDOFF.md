# Codex 项目交接文档：阳光小镇物语

本文档用于下一次 Codex 或开发者接手项目时快速恢复上下文。它记录项目目标、当前实现、运行方式、测试方式、代码结构、已知限制和后续建议。

## 当前项目状态

- 项目名：`sunny-town-story`
- 中文名：阳光小镇物语
- 类型：桌面端 3D 休闲城市经营游戏
- 画风：日式阳光小镇、低多边形、奶油色 HUD
- 技术：Python 静态服务 + Three.js + 原生 JavaScript + Playwright
- GitHub：
  - SSH：`git@github.com:ZhongH1216/sunny-town-story.git`
  - Web：`https://github.com/ZhongH1216/sunny-town-story`
- 分支：`main`

最近一次已知验证：

```powershell
npm.cmd test
```

预期：

```text
6 passed
```

## 用户偏好和需求背景

用户最初要求做一个“超级炫酷的展示”，后来觉得赛博风格和资源调度玩法“太无聊，画风不好看”。最终明确偏好：

- 不要赛博深色风格
- 要可爱的、日式、阳光、休闲风格
- 玩法参考城市天际线，但做休闲化
- 不需要移动端适配
- 目标桌面 16:9 大屏
- 中文优先，不需要继续保留中英切换

因此当前版本已经完全重做，旧版赛博指挥中心、雷达、告警、双语切换都已移除。

## 运行环境

当前机器环境：

- 工作目录：`D:\Pycharm project\cool`
- shell：PowerShell
- Python：`D:\python\anaconda\envs\aigo\python.exe`
- Git：`C:\Program Files\Git\cmd\git.exe`
- Node/npm 已安装

重要提醒：

- `git` 不一定在 PowerShell PATH 中，建议用完整路径：

```powershell
& "C:\Program Files\Git\cmd\git.exe" status
```

- `package.json` 里的脚本绑定了 `aigo` 环境 Python 路径。
- 如果迁移到其他机器，需要修改 `package.json`、`tools/run-tests.js`、`tools/start-server.js` 中的 Python 路径。

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

- `#scene` 3D canvas
- 顶部城市指标 HUD
- 左侧建造工具栏
- 右侧城市顾问面板
- 底部时间/速度/当前工具提示栏

当前文案全部是中文。

### `src/styles.css`

视觉样式。

当前设计：

- 明亮天空蓝背景
- 奶油色卡片
- 草地绿、樱花粉、温暖橙、清水蓝
- 桌面固定 HUD
- `min-width: 1180px`
- `min-height: 760px`

不做移动端布局。

### `src/app.js`

核心游戏逻辑和 Three.js 场景。

主要模块：

- 常量配置：地图尺寸、每周秒数、初始资金
- `BUILDINGS`：建筑成本、维护、税收、容量、岗位、覆盖、污染
- `city`：城市状态、地块、建筑、统计数据、消息
- Three.js 场景：相机、灯光、地块、建筑、树、云
- 建造逻辑：`place`、`bulldoze`、`canBuild`
- 模拟逻辑：`computeStats`、`advanceWeek`
- UI 渲染：`renderUI`、`advisorMessages`
- 交互：工具选择、地图点击、拖拽平移、滚轮缩放
- 测试接口：`window.sunnyTownTest`，仅 `?test=1` 暴露

### `tests/smoke.spec.js`

Playwright 测试。

覆盖：

- 页面和 3D canvas 渲染
- 建造工具放置
- 人口和税收增长
- 顾问缺水/缺电提示
- 公园和学校服务效果
- 资金不足工具禁用

### `tools/run-tests.js`

测试 runner。

职责：

- 用 `aigo` Python 启动 `app.py`
- 等待 `http://127.0.0.1:8765`
- 调用本地 Playwright CLI
- 测试结束后杀掉服务进程

### `tools/start-server.js`

尝试后台启动本地服务。

注意：

- 这个文件仍有旧输出：`Started Neon Grid Command Center...`
- 功能本身可用性依赖宿主环境
- 当前更推荐使用 `npm.cmd run serve` 前台启动

## 游戏规则摘要

地图：

- 固定 18 x 18 网格
- 每格保存 `type`、`buildingId`、`road`、`coverage`、`pollution`

工具：

- 道路
- 住宅
- 商业
- 工业
- 公园
- 学校
- 消防站
- 电力
- 水塔
- 拆除

建造规则：

- 道路可以建在空草地上
- 非道路建筑必须邻近道路
- 已占用格子不能重复建造
- 资金不足时工具按钮禁用
- 拆除建筑返还约 35% 成本，拆道路返还约 25%

模拟：

- 每 4 秒推进一周
- 资金 = 税收 - 维护费
- 住宅提供人口容量
- 商业和工业提供就业
- 电力、水力、就业、交通、污染、教育、消防、公园共同影响幸福度
- 人口根据容量和幸福度逐周增长或下降

目标：

- 人口 >= 800
- 幸福度 >= 75%
- 资金 > 0

达成后显示“阳光小镇已成型”，但可以继续游玩。

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
window.sunnyTownTest.place(type, x, z)
window.sunnyTownTest.advanceWeek(count)
window.sunnyTownTest.getState()
window.sunnyTownTest.setMoney(amount)
```

不要在普通玩家路径暴露新的全局调试接口，除非同样受 `?test=1` 限制。

## 常用命令

运行：

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

1. `tools/start-server.js` 输出仍写着旧项目名 `Neon Grid Command Center`。
2. 游戏没有存档系统，刷新页面会重置城市。
3. 地图大小固定，暂无新地图或随机地图。
4. 建筑道路连接视觉还比较简单，没有自动转角/十字路口贴图。
5. 所有 3D 模型都是基础几何体组合，没有外部贴图或 GLTF 模型。
6. 不做移动端适配，不要为小屏牺牲桌面布局。
7. Windows PowerShell 直接 `Get-Content` 中文文件时可能显示乱码，但浏览器和测试实际按 UTF-8 正常渲染。

## 推荐后续任务

高优先级：

- 修正 `tools/start-server.js` 旧项目名输出。
- 增加 `localStorage` 存档 / 读档。
- 增加道路连接视觉：直线、转角、T 字、十字。
- 增加地块详情面板：建筑收入、维护、覆盖、污染、状态。

中优先级：

- 建筑升级系统：住宅 -> 公寓，商业 -> 商店街，工业 -> 工坊。
- 更多装饰：便利店、神社、小河、桥、车站、祭典灯笼。
- 新目标章节：新居民入住、商店街复兴、春日祭典。
- 加入音效开关和背景音乐。

低优先级：

- 随机地图种子。
- 截图导出。
- 英文语言支持。
- 移动端布局。

## 交接建议

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
- 左侧工具能否点击
- 地图能否放置建筑
- 右侧顾问是否根据状态更新
- 底部时间是否每 4 秒推进一周

任何改动完成后都要重新运行 `npm.cmd test`。
