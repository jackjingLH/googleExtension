# 工作流聚合助手

一个 Chrome 浏览器扩展，将 OA、禅道、GitLab 等多个工作平台的数据聚合到一个弹窗中，支持 AI 自动生成工作总结。

## 功能特性

### 数据聚合
- **OA 系统**：待办事项、日志日程、食堂订餐菜单（含菜品详情）、考勤情况
- **禅道**：剩余任务列表、待修复 Bug（未解决 + 已解决）
- **GitLab**：指定时间范围内的提交记录、待审查 MR

### AI 辅助
- 一键生成**工作总结**（基于 OA + GitLab 数据）
- 一键生成 **Bug 分析报告**（基于禅道 Bug 数据）
- 支持切换 AI 服务商：**智谱AI** / **阿里云百炼** / **OpenAI**

### 其他
- Cookie 自动认证，已登录系统无需重复登录
- 每小时自动后台刷新数据，支持手动刷新
- OA / GitLab 数据支持按**今天 / 本周 / 本月**筛选
- 禅道任务与 Bug 列表支持展开/收起
- 食堂菜品支持通过 SerpAPI 查询详情图片

## 安装方法

### Chrome / Edge

1. 打开 `chrome://extensions/`（Edge 为 `edge://extensions/`）
2. 开启右上角「**开发者模式**」
3. 点击「**加载已解压的扩展程序**」
4. 选择本项目的 `work-dashboard` 目录
5. 安装完成，工具栏出现扩展图标

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击「**临时载入附加组件**」
3. 选择 `work-dashboard/manifest.json`

## 配置说明

### 基础配置（系统地址）

1. 点击浏览器工具栏的扩展图标
2. 点击右上角 ⚙️ 进入设置面板
3. 勾选需要启用的系统，填写各系统访问地址
4. 点击「**保存配置**」

```
✅ OA 系统：http://oa.company.com
✅ 禅道：   http://zentao.company.com:9888
✅ GitLab： http://gitlab.company.com:8800
```

> 配置保存后，在浏览器中正常登录各系统即可，扩展会自动复用 Cookie，无需额外操作。

### AI 配置（可选）

在设置面板底部配置 AI 服务，用于生成工作总结和 Bug 分析：

| 服务商 | 获取 API Key |
|--------|-------------|
| 智谱AI | [open.bigmodel.cn](https://open.bigmodel.cn) |
| 阿里云百炼 | [bailian.console.aliyun.com](https://bailian.console.aliyun.com) |
| OpenAI | [platform.openai.com](https://platform.openai.com) |

### SerpAPI 配置（可选）

用于查询食堂菜品图片和详情。在设置面板填写 SerpAPI Key 并选择搜索引擎（Bing / Google）。

## 使用指南

### 查看聚合数据

点击扩展图标 → 自动加载并展示各系统数据。

- **OA 模块**：顶部可切换日期范围（今天 / 本周 / 本月），点击「展开菜单」查看食堂菜品
- **禅道模块**：分别展示任务数和 Bug 数，点击标题行展开详细列表
- **GitLab 模块**：顶部可切换日期范围，展示提交次数和代码变更统计

### 生成 AI 工作总结

1. 确保 OA 或 GitLab 数据已加载
2. 在设置面板填写 AI 服务商及 API Key
3. 点击「**生成工作总结**」按钮，稍等片刻即可查看

### 生成 Bug 分析报告

1. 确保禅道 Bug 数据已加载
2. 点击禅道模块中的「**AI 分析 Bug**」按钮

## 项目结构

```
work-dashboard/
├── manifest.json          # 扩展配置（Manifest V3）
├── popup.html             # 弹出页面 HTML
├── popup.css              # 弹出页面样式
├── popup.js               # 弹出页面逻辑（UI 交互、数据渲染）
├── src/
│   ├── background.js      # Service Worker（数据获取、定时刷新、AI 调用）
│   ├── content.js         # OA 页面注入脚本（辅助数据采集）
│   └── content.css        # content script 样式
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── generate-icons.html    # 图标生成工具
├── generate-icons.js
└── README.md
```

## 调试技巧

### 查看 Service Worker 日志

1. 访问 `chrome://extensions/`
2. 找到本扩展，点击「**service worker**」链接
3. 在 DevTools Console 中查看后台日志

### 查看 Popup 日志

1. 右键点击扩展图标 → 「**检查弹出内容**」
2. 在 DevTools Console 中查看 popup 日志

### 调试网络请求

在 Service Worker 的 DevTools → Network 标签页可查看所有 API 请求和响应。

## 常见问题

**Q: 提示「认证失败，请重新登录」？**
A: Cookie 已过期，在浏览器中重新登录对应系统即可，无需修改扩展配置。

**Q: 数据不更新？**
A: 点击弹窗右上角刷新按钮手动触发，或检查系统地址配置是否正确。

**Q: AI 总结生成失败？**
A: 检查 API Key 是否填写正确，以及对应服务商账号是否有可用额度。

**Q: 食堂菜品详情查不到？**
A: 需要在设置中配置有效的 SerpAPI Key。

## 技术栈

- Chrome Extension Manifest V3
- 原生 JavaScript（无第三方依赖）
- CSS3
- Chrome APIs：`cookies` / `storage` / `alarms` / `notifications` / `declarativeNetRequest`

## License

MIT
