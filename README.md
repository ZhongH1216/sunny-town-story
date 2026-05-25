# 阳光小镇物语

一个使用 Three.js 制作的桌面 3D 休闲城市经营游戏。当前版本已经从单纯的小镇摆放演示升级为带道路等级、居民通勤寻路、道路流量、拥堵反馈、小车和行人动画的“日系阳光小镇经营”原型。

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
- 建筑落地弹跳、云朵漂移、树冠轻摆、樱花飘落、金币/人口/幸福度气泡
- 城市顾问实时提示断路、无通勤路径、拥堵、缺水、缺电、就业不足等问题
- Playwright 自动化测试覆盖核心玩法

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
- 电力、水力、就业、交通、污染、教育、消防和公园服务共同影响幸福度。
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
├─ src/
│  ├─ app.js               # Three.js 场景、城市模拟、道路寻路、交通动画
│  └─ styles.css           # 桌面 HUD 和日系阳光视觉样式
├─ tests/
│  └─ smoke.spec.js        # Playwright 核心玩法测试
├─ tools/
│  ├─ run-tests.js         # 启动 Python 服务并运行测试
│  └─ start-server.js      # 后台启动本地服务
├─ package.json
├─ package-lock.json
├─ playwright.config.js
├─ HANDOFF.md
└─ .gitignore
```

## 环境要求

当前项目按本机环境配置：

- Windows
- Anaconda/Miniconda
- `aigo` conda 环境
- Python 路径：`D:\python\anaconda\envs\aigo\python.exe`
- Node.js
- npm

`package.json` 中的脚本绑定了该 Python 路径：

```json
{
  "serve": "\"D:\\python\\anaconda\\envs\\aigo\\python.exe\" app.py",
  "test": "node tools/run-tests.js"
}
```

如果换机器或 Python 环境路径不同，需要同步修改 `package.json` 和 `tools/*.js` 中的 Python 路径。

## 安装依赖

首次克隆后运行：

```powershell
npm.cmd install
```

如果 Playwright 浏览器缺失，运行：

```powershell
npx.cmd playwright install chromium
```

## 本地运行

最简单的方式：在项目根目录双击：

```text
start-sunny-town.bat
```

它会自动进入项目目录，首次运行时安装 npm 依赖，启动本地服务，并打开浏览器访问游戏。

根目录也保留了 `启动阳光小镇.bat`，它只是转发到英文启动器。英文文件名更推荐，因为 Windows 批处理在不同编码环境下处理中文内容容易出错。

启动后会保留一个命令行窗口。这个窗口就是本地游戏服务器：

- 游玩时保持窗口打开。
- 想结束游戏时，关闭这个窗口或在窗口里按 `Ctrl+C`。
- 如果之前旧版启动器留下了后台服务，双击 `stop-sunny-town.bat` 或 `停止阳光小镇.bat` 清理。

命令行方式：

```powershell
cd "D:\Pycharm project\cool"
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
7 passed
```

测试覆盖：

- 1440 x 900 桌面页面加载
- Three.js canvas 非空像素信号
- 普通道路和樱花大道均可放置
- 樱花大道容量高于普通道路
- 道路 mask 自动更新为直线、转角、T 字和十字
- 居民获得真实道路路线，人口和税收增长
- 断路或不可达时顾问面板出现交通提示
- 大量通勤会提高普通道路拥堵并降低交通评分
- 视觉移动体数量大于 0 且不超过 60

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
```

示例：

```js
window.sunnyTownTest.place("road", 4, 4, { tier: "avenue" });
window.sunnyTownTest.place("residential", 4, 5);
window.sunnyTownTest.advanceWeek(4);
console.log(window.sunnyTownTest.getState().stats.traffic);
```

`getState()` 会返回统计数据、道路列表、居民路线、顾问消息和视觉移动体数量，方便自动化测试和调试。

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
- 没有存档/读档系统，刷新页面会回到初始小镇。
- 建筑、车辆、居民、道路和粒子都由 Three.js 基础几何体生成，没有外部美术资源。
- 居民是模拟层独立对象，但屏幕上只抽样显示最多 60 个移动体以控制性能。

## 后续路线

建议优先级：

1. 加入 `localStorage` 存档 / 读档。
2. 增加建筑升级系统，例如住宅升级为公寓、商业升级为商店街。
3. 增加道路升级操作，把已有普通道路直接升级为樱花大道。
4. 增加更细的分区需求、满意度原因拆分和周报图表。
5. 加入更多日系小镇装饰，如便利店、车站、神社、小河、桥、风铃摊。
6. 增加目标章节，例如“新居民入住”“商店街复兴”“春日祭典”。
7. 加入音效开关和背景音乐。

## License

MIT
