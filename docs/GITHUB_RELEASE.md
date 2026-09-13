在海风与樱花之间，经营一条有邻居、有来信、也有四季活动的小街。

这是 **阳光小镇物语 1.0.0-demo.3「四季街坊生活」** 试玩预发布。

## 下载与启动

下载本页附件 **`sunny-town-story-1.0.0-demo.3.zip`**，完整解压后双击 `start-sunny-town.bat`。电脑需要 **Python 3.10+** 和支持 **WebGL 2** 的桌面浏览器；Python 不随包提供。游戏依赖与素材已包含，玩家无需 Node.js / npm / Conda，准备好运行环境后可离线游玩。

请选上面的试玩 ZIP；GitHub 自动生成的 “Source code” 是开发源码包。附件 `.sha256` 可用于核对 ZIP 完整性。

## 来小镇做些什么

- 从海港、花园、商店街三种故事中选择开局，完成 9 封居民来信，参与 4 份市政提案。
- 收集居民邮票、改善生活服务，为大家筹办春日祭典；结束后可以继续自由建设。
- 体验四季邀请，每季两种活动方案；用口碑解锁 3 项永久社区建设，收集 4 件季节纪念品。
- 规划道路、水电、住宅与公共服务，在就业、通勤、污染和预算之间做选择。

![晴日港实机画面](https://raw.githubusercontent.com/ZhongH1216/sunny-town-story/v1.0.0-demo.3/docs/images/demo-3-harbor.png)

## 更省电，也更稳妥

默认 24 帧省电档，支持 30 / 60 帧；暂停与菜单降帧，切到后台停止绘制、模拟与音乐。复用移动体，限制寻路缓存和效果粒子，减少重复模型重建与界面开销。

修复人口在统计刷新时额外增长、撤销倒回已结算收入、慢速拖拽误建造、部分无效存档和弹窗状态问题。图形连接中断时会暂停，并提供恢复画面、导出备份、保存后刷新的入口。兼容旧 v1 / v2 / v3 存档，换故事或清理浏览器数据前请先导出 JSON 备份。

## 验证与试玩范围

本地 Windows 验收通过 **62 项浏览器回归与 2 项服务 / 启动代理测试**，三个故事使用正常经营收入完成祭典，实际 ZIP 解压、文件哈希、启程、存档和场景显示通过验证。本次 GitHub 发布还会在 Windows runner 中重新执行测试和实际 ZIP 验证，成功后才上传附件。

自动化显式使用 SwiftShader 软件渲染。本机默认 ANGLE 曾出现 SharedImage 创建失败；游戏不强制软件渲染，跨设备显卡兼容与长时间人工游玩仍需继续验证。当前为 **18 × 18 固定地图、桌面键鼠试玩**，没有移动端适配或原生安装器。macOS / Linux 尚未完成实机验收。

[玩法与操作](https://github.com/ZhongH1216/sunny-town-story/tree/v1.0.0-demo.3#readme) · [完整发布说明](https://github.com/ZhongH1216/sunny-town-story/blob/v1.0.0-demo.3/docs/DEMO_RELEASE_NOTES.md) · [问题反馈](https://github.com/ZhongH1216/sunny-town-story/issues/new/choose)
