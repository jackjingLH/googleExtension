# 金铲铲 - 小红书评论AI分析

> 🚧 开发中，功能设计讨论中

一个 Chrome 扩展，针对小红书笔记评论进行 AI 智能分析，帮助快速提炼用户洞察。

## 项目结构

```
xhs-comment-analyzer/
├── manifest.json      # 扩展配置（Manifest V3）
├── popup.html         # 弹出页面
├── popup.css          # 弹出页面样式
├── popup.js           # 弹出页面脚本
├── src/
│   ├── background.js  # Service Worker
│   ├── content.js     # 注入小红书页面的脚本
│   └── content.css    # content script 样式
├── icons/             # 扩展图标
└── README.md
```

## License

MIT
