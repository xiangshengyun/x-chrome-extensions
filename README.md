# x-chrome-extensions

个人 Chrome 扩展合集。

## 项目列表

| 扩展 | 描述 |
|------|------|
| [PageBrief](PageBrief/) | 提取网页内容，AI 智能总结为 Markdown |

---

## PageBrief

提取网页正文内容，调用 AI 接口智能总结为 Markdown 格式，支持导出下载和交互式问答。

### 功能特性

- **⛏ 提取正文** — 智能提取页面纯文本，移除导航/广告等干扰内容
- **🤖 AI 总结** — 调用 MiniMax / OpenAI 等兼容 API 生成摘要
- **💬 交互问答** — 针对网页内容进行多轮 AI 对话，深入了解页面信息
- **📄 Markdown 导出** — 附带 frontmatter 元数据（标题、来源、日期），可直接导入 Obsidian/Notion
- **💾 本地存储** — API 配置仅保存在 `chrome.storage.local`，不上传
- **🎨 悬浮按钮** — 页面右下角浮动图标，点击弹出操作面板
- **⚡ 无阻塞** — 提取/总结/问答过程不影响页面操作，对话框可正常滚动

### 安装

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目文件夹 `PageBrief`

修改文件后在 `chrome://extensions/` 点击刷新按钮即可。

### 使用方式

1. 点击浏览器工具栏的扩展图标，打开操作面板
2. 配置 API（API URL、Key、Model）；首次配置后会自动保存
3. 点击「提取」获取页面正文
4. 切换 Tab 查看「原文」「总结」或进行「问答」
5. 总结完成后可复制或导出为 Markdown

### 支持的 API

OpenAI 兼容格式的 API 均可使用，默认配置：

| 字段 | 默认值 |
|------|--------|
| API URL | `https://api.minimaxi.com/v1/chat/completions` |
| API Key | （用户填写） |
| Model | `MiniMax-M2.7` |
| 深度思考 | 关闭 |

### 技术栈

- Manifest V3
- 纯前端（HTML + CSS + JavaScript），无构建工具依赖
- `chrome.storage.local` 本地存储配置
