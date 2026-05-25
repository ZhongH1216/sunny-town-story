# 阳光小镇物语

一个使用 Three.js 制作的桌面端 3D 休闲城市经营游戏。项目画风偏日系阳光小镇：蓝天、草地网格、云朵、樱花树、低多边形建筑，以及奶油色中文 HUD。玩法参考城市建造经营游戏，但第一版保持轻量、直观和可演示。

运行测试后会在 `test-results/sunny-town-desktop.png` 生成桌面截图；该目录用于本地验证，默认不提交到仓库。

## 功能概览

- 18 x 18 固定网格地图
- 3D 俯视/斜俯视小镇场景
- 鼠标拖拽平移地图、滚轮缩放视角
- 点击工具后在地图格子上建造或拆除
- 中文桌面游戏界面，不做移动端适配
- 按周推进的城市经营模拟
- 城市顾问面板，实时提示当前问题
- Playwright 自动化测试覆盖核心玩法

## 建造工具

| 工具 | 作用 |
| --- | --- |
| 道路 | 连接建筑，是所有建筑运行的基础 |
| 住宅 | 提供人口容量，居民会根据服务和幸福度迁入 |
| 商业 | 提供就业、税收和部分交通压力 |
| 工业 | 提供更多就业和税收，但会制造污染 |
| 公园 | 提升附近住宅幸福度，缓冲污染压力 |
| 学校 | 提升教育覆盖和长期幸福度 |
| 消防站 | 提升消防覆盖和居民安心感 |
| 电力 | 为附近建筑供电 |
| 水塔 | 为附近建筑供水 |
| 拆除 | 拆除建筑或道路，返还少量资金 |

## 经营系统

游戏初始资金为 `¥50,000`。时间按周推进，每 `4` 秒结算一周。

核心指标包括：

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

- 建筑必须邻近道路才会运行。
- 住宅需要道路、电力、水力和较高幸福度，人口才会增长。
- 商业和工业提供岗位与税收。
- 道路、公共设施和建筑都有维护费。
- 电力、水力、就业、交通、污染和公共服务会共同影响幸福度。
- 资金低于 `-10,000` 并持续多周，会触发财务危机提示。
- 达到人口 `800`、幸福度 `75%`、资金为正时，完成第一阶段目标。

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
├── app.py                  # Python 静态文件服务器
├── index.html              # 游戏页面结构
├── src/
│   ├── app.js              # Three.js 场景、城市模拟、交互逻辑
│   └── styles.css          # 桌面 HUD 和日系阳光视觉样式
├── tests/
│   └── smoke.spec.js       # Playwright 核心玩法测试
├── tools/
│   ├── run-tests.js        # 启动 Python 服务并运行测试
│   └── start-server.js     # 尝试后台启动本地服务
├── package.json
├── package-lock.json
├── playwright.config.js
└── .gitignore
```

## 环境要求

当前项目按本机环境配置：

- Windows
- Anaconda/Miniconda
- `aigo` conda 环境
- Python 路径：`D:\python\anaconda\envs\aigo\python.exe`
- Node.js
- npm

已验证的运行方式依赖 `package.json` 中的脚本：

```json
{
  "serve": "\"D:\\python\\anaconda\\envs\\aigo\\python.exe\" app.py",
  "test": "node tools/run-tests.js"
}
```

如果你的 Python 环境路径不同，需要修改 `package.json` 和 `tools/*.js` 里的 Python 路径。

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

```powershell
cd "D:\Pycharm project\cool"
npm.cmd run serve
```

然后打开：

```text
http://127.0.0.1:8765
```

说明：`npm.cmd run serve` 是最可靠的前台运行方式。当前 Windows/Codex 环境中，后台常驻启动可能被宿主进程清理。

## 测试

运行：

```powershell
npm.cmd test
```

当前测试覆盖：

- 1440 x 900 桌面页面加载
- Three.js canvas 非空像素信号
- 工具栏可放置道路、住宅、商业、公园
- 住宅邻近道路并有基础设施后，人口和税收增长
- 缺电/缺水时城市顾问显示中文提示
- 公园和学校提升幸福度或服务覆盖
- 资金不足时昂贵工具禁用

测试截图输出：

```text
test-results/sunny-town-desktop.png
```

`test-results/` 已被 `.gitignore` 忽略，不会提交到 GitHub。

## 测试接口

仅当 URL 带 `?test=1` 时，页面会暴露：

```js
window.sunnyTownTest
```

可用方法：

- `place(type, x, z)`
- `advanceWeek(count)`
- `getState()`
- `setMoney(amount)`

这个接口只用于 Playwright 测试和调试，不面向真实玩家。

## GitHub

仓库地址：

```text
git@github.com:ZhongH1216/sunny-town-story.git
```

网页地址：

```text
https://github.com/ZhongH1216/sunny-town-story
```

当前主分支：

```text
main
```

## 已知限制

- 只做桌面 16:9 优先布局，不做移动端适配。
- 城市模拟是休闲化 V1，不是完整大型城市模拟器。
- 地图固定为 18 x 18，暂不支持存档、读档或地图编辑器。
- 建筑模型由 Three.js 基础几何体组合而成，没有外部美术资源。
- `tools/start-server.js` 仍可用，但其中输出文案有历史遗留，可后续改为“Sunny Town Story”。

## 后续路线

建议优先级：

1. 加入存档 / 读档，使用 `localStorage` 保存城市。
2. 优化道路连接视觉，让道路自动拼接成直线、转角和十字路口。
3. 增加建筑升级，例如住宅从小屋升级为公寓。
4. 增加地块信息弹窗，显示该建筑的收入、维护、覆盖、污染。
5. 加入更多日系装饰物，例如车站、便利店、神社、小河、桥、风铃摊。
6. 增加目标章节，例如“新居民入住”“商店街复兴”“春日祭典”。
7. 修正 `tools/start-server.js` 的旧项目名输出。

## License

MIT
