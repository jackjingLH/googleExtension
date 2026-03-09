# YouTube 字幕下载器

一个 Chrome 扩展，在 YouTube 视频页面添加字幕下载按钮，支持多语言字幕下载并导出为 SRT 格式。

## 功能特性

- 自动检测视频可用字幕（手动字幕 + 自动生成字幕）
- 支持翻译字幕下载（中文简体、英文、日文）
- 导出标准 SRT 格式文件
- 无需登录，无需 API Key

## 支持语言

| 类型 | 语言 |
|------|------|
| 直接字幕 | 视频原有语言字幕 |
| 翻译字幕 | 中文（简体）/ English / 日本語 |

## 安装方法

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本目录 `yt-subtitle-extension`
5. 安装完成！

## 使用方法

1. 打开任意 YouTube 视频页面（`youtube.com/watch?v=...`）
2. 播放视频，等待字幕自动加载
3. 视频播放器下方会出现「下载字幕」按钮
4. 点击按钮，从弹出的语言列表中选择目标语言
5. 字幕文件（`.srt`）自动下载到本地

## 项目结构

```
yt-subtitle-extension/
├── manifest.json    # 扩展配置（Manifest V3）
├── content.js       # 注入 YouTube 页面的主脚本
└── README.md
```

## 核心原理

- 通过拦截 `XMLHttpRequest` 捕获 YouTube 播放器发出的 `/api/timedtext` 字幕请求 URL
- 解析 YouTube 返回的 `json3` 格式字幕数据
- 将字幕转换为标准 SRT 格式并触发浏览器下载

## 技术栈

- Chrome Extension Manifest V3
- 原生 JavaScript（无依赖）
- Content Script（`world: MAIN`，可访问页面 JS 环境）

## 常见问题

### Q: 按钮没有出现？
A: 请先播放视频，等待几秒让字幕数据加载完成后再查看。

### Q: 某些语言下载失败？
A: 该视频可能没有对应语言的字幕或翻译，请尝试其他语言。

### Q: 下载的字幕乱码？
A: SRT 文件为 UTF-8 编码，使用支持 UTF-8 的播放器或编辑器打开即可。

## License

MIT
