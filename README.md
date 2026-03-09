# Google Chrome Extensions

Chrome 浏览器扩展集合，包含多个实用工具扩展。

## 扩展目录

| 扩展名称 | 描述 | 文档 |
|---------|------|------|
| 工作流聚合助手 | 聚合 OA、禅道、GitLab 等多个工作平台的待办事项和工作数据 | [查看文档](./work-dashboard/README.md) |
| YouTube 字幕下载器 | 在 YouTube 视频页面一键下载多语言字幕（SRT 格式） | [查看文档](./yt-subtitle-extension/README.md) |

## 项目结构

```
googleExtension/
├── work-dashboard/          # 工作流聚合助手
│   ├── manifest.json
│   ├── popup.html / popup.js / popup.css
│   ├── src/
│   │   ├── background.js
│   │   ├── content.js
│   │   └── content.css
│   ├── icons/
│   └── README.md
├── yt-subtitle-extension/   # YouTube 字幕下载器
│   ├── manifest.json
│   ├── content.js
│   └── README.md
└── README.md
```

## 快速安装

1. 下载或克隆本仓库
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择对应扩展的目录

详细安装步骤请参阅各扩展的文档。
