# demo.4.1 发布验证

- 版本：`v1.0.0-demo.4.1`，试玩预发布。
- 源码：`5aa2595e9ed17010720cf09d52e1db750b09dd62`。
- [发布页](https://github.com/ZhongH1216/sunny-town-story/releases/tag/v1.0.0-demo.4.1)；[完整验收任务](https://github.com/ZhongH1216/sunny-town-story/actions/runs/35117518905)。
- 公开时间：`2026-09-16T15:53:52Z`。
- 3 个单 worker 分片分别 28 项，共 **84 项全部通过**；9 项服务 / 启动器与 3 项美术 Node 检查通过。
- 云端实际 ZIP 解压、78 文件与清单、正常 UI 启程保存、推进读档、版本和服务退出检查通过，随后发布作业成功。
- 已重新下载公开 ZIP 和 `.sha256`，附件大小、文件名、计算的 SHA-256 以及 GitHub 提供的 digest 全部一致。

## 公开附件

[下载试玩 ZIP](https://github.com/ZhongH1216/sunny-town-story/releases/download/v1.0.0-demo.4.1/sunny-town-story-1.0.0-demo.4.1.zip) · [校验文件](https://github.com/ZhongH1216/sunny-town-story/releases/download/v1.0.0-demo.4.1/sunny-town-story-1.0.0-demo.4.1.zip.sha256)

文件名：`sunny-town-story-1.0.0-demo.4.1.zip`

大小：**1,727,977 字节**

SHA-256：

```text
e8de78f9cd0926fc52cb66e1b4ab93a74d112f2247bad3386b0288be5e336b22
```

本地公开附件副本位于 `dist/github-release/`，下载核验结果为 `verification.json`。旧的本机构建 ZIP 保留在 `dist/`；两份包除哈希清单外的文件差异仅为 LF / CRLF 换行，因此压缩包校验值不同。公开分发应以上述附件和校验值为准。既有标签与公开附件不覆盖；后续修复使用新版本。
