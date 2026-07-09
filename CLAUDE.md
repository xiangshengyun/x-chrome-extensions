# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**PageBrief** 是一个 Chrome 扩展应用，在任意网页上通过悬浮按钮弹出对话框，快速提取网页正文并调用 AI 总结为 Markdown 格式。

### 核心功能

- **悬浮按钮**：位于页面右上角，可拖动，点击弹出对话框
- **自动提取**：打开对话框时自动提取当前页面正文
- **原文/总结切换**：双 Tab 界面，分别显示原文和 AI 总结
- **复制/导出**：原文和总结都支持一键复制，总结可导出为 .md 文件
- **配置灵活**：API URL、API Key、Model、深度思考开关、自定义提示词
- **默认值**：API URL 默认 `https://api.minimaxi.com/v1/chat/completions`，Model 默认 `MiniMax-M2.7`

### AI 提示词设计

- 默认提示词要求 AI 输出规范 Markdown，带 YAML frontmatter 元信息
- 要求直接输出，不使用代码块标记（```yaml / ```markdown）
- 总结后自动去除 `<think>...</think>` thinking 块

## 技术栈

- **Manifest V3**：Chrome 扩展规范
- **纯前端**：HTML + CSS + JavaScript，无构建工具依赖
- **AI 接口**：OpenAI 兼容格式，支持任意 API Provider
- **存储**：`chrome.storage.local` 本地存储配置

## 项目结构

```
page-inspector/
├── manifest.json          # 扩展配置
├── content.js             # 内容脚本（悬浮按钮 + 对话框 UI + 逻辑）
├── background.js          # 后台脚本
├── popup.html/js/css      # 扩展图标点击后的 popup（暂未用于主流程）
├── preview.html           # UI 预览页面
├── icons/                 # 图标
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── CLAUDE.md              # 本文件
```

## 开发命令

### 加载扩展到 Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目文件夹 `page-inspector`

修改文件后直接在 `chrome://extensions/` 点击刷新按钮即可。

## 架构说明

### 对话框布局

```
┌─────────────────────────────────────┐
│ PageBrief │ [提取] [★] │ [⚙] [✕] │  ← 头部栏
├─────────────────────────────────────┤
│ (设置面板，可折叠)                     │
│  API URL: _______________________   │
│  API Key: _______________________   │
│  Model:  _______________________   │
│  深度思考: [switch]                │
│  提示词:  _______________________   │
│  [保存配置]                         │
├─────────────────────────────────────┤
│ ● 就绪                              │  ← 状态栏
├─────────────────────────────────────┤
│ [原文] [总结]                        │  ← Tab 栏
├─────────────────────────────────────┤
│                                     │
│  正文/总结 内容区                     │
│                                     │
│  [复制] [导出]                       │  ← 操作栏
└─────────────────────────────────────┘
```

### 内容脚本结构 (content.js)

- **悬浮按钮**：可拖动 fixed 定位元素，`top: 74px; right: 124px` 为初始位置
- **对话框**：动态创建，fixed 定位在悬浮按钮左上方
- **事件处理**：
  - 提取按钮 → `extractPageContent()` 提取 DOM 文本
  - 总结按钮 → `summarizeContent()` 调用 AI API
  - 导出按钮 → `generateMarkdownExport()` + `downloadMarkdown()` 生成下载
  - 设置按钮 → 切换设置面板显示/隐藏
  - 保存配置 → 存入 `chrome.storage.local`

### 关键函数

| 函数 | 行号 | 功能 |
|------|------|------|
| `createFloatingButton()` | ~18 | 创建并注入悬浮按钮 |
| `openDialog()` | ~111 | 打开对话框，自动提取正文 |
| `getDialogHTML()` | ~153 | 返回对话框 HTML 模板 |
| `initDialogEvents()` | ~479 | 绑定所有对话框事件 |
| `extractPageContent()` | ~575 | 提取页面纯文本 |
| `summarizeContent()` | ~668 | 调用 AI API 生成总结 |
| `generateMarkdownExport()` | ~723 | 拼接 frontmatter + 总结 |
| `downloadMarkdown()` | ~741 | 触发 .md 文件下载 |
| `getDefaultPrompt()` | ~715 | 默认 AI 提示词 |

### API 调用方式

```javascript
// 调用用户配置的 AI API
POST ${apiUrl}
Headers: Authorization: Bearer ${apiKey}
Body: {
  model: ${model},
  messages: [
    { role: "system", content: ${prompt} },
    { role: "user", content: "请将以下内容总结..." + ${content} }
  ],
  ...(thinking ? { thinking: true } : {})
}
```

### Markdown 导出格式

```markdown
---
title: "页面标题"
source: "https://example.com"
author: []
created: 2026-07-09
---

## 核心摘要

（AI 总结的正文，无代码块标记）
```

### 用户设置项

| 字段 | 默认值 | 说明 |
|------|--------|------|
| apiUrl | `https://api.minimaxi.com/v1/chat/completions` | API 地址 |
| apiKey | `""` | API 密钥 |
| model | `MiniMax-M2.7` | 模型名称 |
| thinking | `false` | 是否启用深度思考 |
| prompt | 默认提示词 | AI system prompt |

## 注意事项

- API Key 仅本地存储，不会上传
- 支持 OpenAI 兼容格式的 API（MiniMax、Claude 等均可用）
- 打开对话框 100ms 后自动提取当前页面正文
- 总结内容自动去除 `<think>...</think>` 块
- 导出 Markdown 不使用代码块标记，直接输出 YAML + 正文
- 设置面板打开时隐藏原文/总结区域，关闭后恢复显示
