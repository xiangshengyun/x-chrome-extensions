// ============================================
// Page Inspector - Popup Script
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const palette = document.querySelector('.palette');
  const closeBtn = document.getElementById('closeBtn');
  const minimizeBtn = document.getElementById('minimizeBtn');
  const toggleSettings = document.getElementById('toggleSettings');
  const settingsSection = document.getElementById('settingsSection');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const statusBar = document.getElementById('statusBar');
  const statusDot = statusBar.querySelector('.status-dot');
  const statusText = statusBar.querySelector('.status-text');

  const summarizeBtn = document.getElementById('summarizeBtn');
  const saveMarkdownBtn = document.getElementById('saveMarkdownBtn');
  const extractContentBtn = document.getElementById('extractContentBtn');

  const resultArea = document.getElementById('resultArea');
  const resultContent = document.getElementById('resultContent');
  const copyResultBtn = document.getElementById('copyResult');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const floatingBubble = document.getElementById('floatingBubble');

  // Settings inputs
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const modelInput = document.getElementById('model');

  // State
  let currentResult = '';

  // ============================================
  // Utility Functions
  // ============================================

  function setStatus(text, state = 'ready') {
    statusText.textContent = text;
    statusDot.className = 'status-dot';
    if (state === 'loading') statusDot.classList.add('loading');
    if (state === 'error') statusDot.classList.add('error');
  }

  function showLoading(show) {
    loadingOverlay.classList.toggle('active', show);
  }

  function showResult(content) {
    currentResult = content;
    resultContent.innerHTML = `<pre>${escapeHtml(content)}</pre>`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================
  // Settings Management
  // ============================================

  function loadSettings() {
    chrome.storage.local.get(['apiUrl', 'apiKey', 'model'], (result) => {
      apiUrlInput.value = result.apiUrl || '';
      apiKeyInput.value = result.apiKey || '';
      modelInput.value = result.model || '';
    });
  }

  function saveSettings() {
    const settings = {
      apiUrl: apiUrlInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim()
    };
    chrome.storage.local.set(settings, () => {
      setStatus('配置已保存', 'ready');
      settingsSection.classList.remove('open');
      setTimeout(() => setStatus('就绪'), 1500);
    });
  }

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['apiUrl', 'apiKey', 'model'], (result) => {
        resolve(result);
      });
    });
  }

  // ============================================
  // Content Extraction
  // ============================================

  function extractPageContent() {
    return new Promise(async (resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (!tabs[0]) {
          reject(new Error('无法获取当前标签页'));
          return;
        }

        const tab = tabs[0];
        const url = tab.url || '';

        // Check for special pages that can't be accessed
        if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('file://')) {
          reject(new Error('不支持此类型页面（chrome://、about:、本地文件）'));
          return;
        }

        // Try to send message first
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
          resolve(response);
        } catch (error) {
          // If sendMessage fails, try to inject content script dynamically
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            // Give it a moment to initialize
            await new Promise(r => setTimeout(r, 100));
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
            resolve(response);
          } catch (injectError) {
            reject(new Error('无法连接页面，请刷新网页后重试'));
          }
        }
      });
    });
  }

  // ============================================
  // AI API Calls
  // ============================================

  async function summarizeContent(content) {
    const settings = await getSettings();

    if (!settings.apiUrl || !settings.apiKey || !settings.model) {
      throw new Error('请先配置 API 参数');
    }

    const response = await fetch(settings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: 'system',
            content: '你是一个网页内容分析助手。请将用户提供的网页内容总结成规范的 Markdown 格式，包括标题、要点列表等结构化内容。'
          },
          {
            role: 'user',
            content: `请将以下网页内容总结成 Markdown 格式：\n\n${content.slice(0, 8000)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '未能生成摘要';
  }

  // ============================================
  // Action Handlers
  // ============================================

  // 主要功能：提取内容 → AI 总结 → 保存 Markdown
  async function handleSummarizeAndSave() {
    try {
      showLoading(true);
      setStatus('正在提取内容...', 'loading');

      const pageData = await extractPageContent();
      const content = pageData.content;

      if (!content || content.length < 50) {
        throw new Error('页面内容太少，无法总结');
      }

      setStatus('正在 AI 总结...', 'loading');
      const summary = await summarizeContent(content);

      setStatus('正在保存...', 'loading');
      const markdown = generateSummaryMarkdown(pageData, summary);

      // Download file
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizeFilename(pageData.title || 'page')}_总结.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showResult('✅ 总结完成，文件已开始下载');
      setStatus('完成', 'ready');
    } catch (error) {
      showResult(`错误: ${error.message}`);
      setStatus('处理失败', 'error');
    } finally {
      showLoading(false);
    }
  }

  // 提取正文（仅显示，不保存）
  async function handleExtractContent() {
    try {
      showLoading(true);
      setStatus('正在提取内容...', 'loading');

      const pageData = await extractPageContent();
      showResult(pageData.content.slice(0, 3000) + (pageData.content.length > 3000 ? '\n\n... (内容已截断)' : ''));
      setStatus('提取完成', 'ready');
    } catch (error) {
      showResult(`错误: ${error.message}`);
      setStatus('处理失败', 'error');
    } finally {
      showLoading(false);
    }
  }

  // ============================================
  // Helpers
  // ============================================

  // 生成总结的 Markdown（AI 总结内容，不是原文）
  function generateSummaryMarkdown(pageData, summary) {
    const now = new Date().toLocaleString('zh-CN');
    return `# ${pageData.title || '无标题'}

> 来源: ${pageData.url || '未知链接'}
> 提取时间: ${now}
> AI 总结版本

---

${summary}

---

*由 Page Inspector 自动总结生成*
`;
  }

  function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 50) || 'page';
  }

  // ============================================
  // Minimize / Restore
  // ============================================

  function minimize() {
    palette.style.display = 'none';
    floatingBubble.classList.add('visible');
  }

  function restore() {
    palette.style.display = 'block';
    floatingBubble.classList.remove('visible');
  }

  // ============================================
  // Event Listeners
  // ============================================

  closeBtn.addEventListener('click', () => {
    window.close();
  });

  minimizeBtn.addEventListener('click', minimize);

  floatingBubble.addEventListener('click', restore);

  toggleSettings.addEventListener('click', () => {
    settingsSection.classList.toggle('open');
  });

  saveSettingsBtn.addEventListener('click', saveSettings);

  const summarizeAndSaveBtn = document.getElementById('summarizeAndSaveBtn');
  summarizeAndSaveBtn.addEventListener('click', handleSummarizeAndSave);
  extractContentBtn.addEventListener('click', handleExtractContent);

  copyResultBtn.addEventListener('click', () => {
    if (currentResult) {
      navigator.clipboard.writeText(currentResult).then(() => {
        const originalText = copyResultBtn.innerHTML;
        copyResultBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> 已复制`;
        setTimeout(() => {
          copyResultBtn.innerHTML = originalText;
        }, 1500);
      });
    }
  });

  // ============================================
  // Initialize
  // ============================================

  loadSettings();
  setStatus('就绪');
});
