// ============================================
// Page Inspector - Content Script
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    sendResponse(extractPageContent());
  }
  return true;
});

// ============================================
// Floating Button & Dialog
// ============================================

let dialogInstance = null;

function createFloatingButton() {
  if (document.getElementById('page-inspector-float')) return;
  try {

  const button = document.createElement('div');
  button.id = 'page-inspector-float';
  button.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    </svg>
  `;

  let isDragging = false, hasDragged = false;
  let startX, startY, initialX, initialY;

  button.addEventListener('mousedown', (e) => {
    isDragging = true;
    hasDragged = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = button.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    button.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasDragged = true;
    if (hasDragged) {
      button.style.left = (initialX + dx) + 'px';
      button.style.top = (initialY + dy) + 'px';
      button.style.right = 'auto';
      button.style.bottom = 'auto';
      // 同步更新弹窗位置
      if (dialogInstance) {
        const newRect = button.getBoundingClientRect();
        let top = newRect.top - 520;
        if (top < 0) top = newRect.bottom + 10;
        dialogInstance.style.top = top + 'px';
        dialogInstance.style.right = (window.innerWidth - newRect.right) + 'px';
      }
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      button.style.cursor = 'grab';
    }
  });

  button.addEventListener('click', (e) => {
    if (hasDragged) { e.preventDefault(); return; }
    e.stopPropagation();
    if (dialogInstance) {
      closeDialog();
    } else {
      openDialog(button);
    }
  });

  button.style.cssText = `
    position: fixed; top: 74px; right: 124px;
    width: 48px; height: 48px;
    background: #0d0d0d; border: 2px solid #ffb000; border-radius: 50%;
    color: #ffb000; display: flex; align-items: center; justify-content: center;
    cursor: grab; z-index: 2147483647;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 20px rgba(255,176,0,0.15);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  `;
  button.title = 'PageBrief - AI 网页总结工具';
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
    button.style.boxShadow = '0 6px 28px rgba(0,0,0,0.5), 0 0 30px rgba(255,176,0,0.2)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4), 0 0 20px rgba(255,176,0,0.15)';
  });

  document.body.appendChild(button);
  } catch (err) { console.error('PageBrief error:', err); }
}

if (document.body) createFloatingButton();
else document.addEventListener('DOMContentLoaded', createFloatingButton);

function openDialog(floatingBtn) {
  const rect = floatingBtn.getBoundingClientRect();
  let top = rect.top - 520;
  if (top < 0) top = rect.bottom + 10;

  const dialog = document.createElement('div');
  dialog.id = 'page-inspector-dialog';
  dialog.dataset.floatingBtnRight = rect.right;
  dialog.style.cssText = `
    position: fixed; top: ${top}px; right: ${window.innerWidth - rect.right}px;
    width: 420px; max-height: 580px;
    background: #0d0d0d; border: 1px solid rgba(255,176,0,0.3);
    border-radius: 14px; box-shadow: 0 4px 24px rgba(0,0,0,0.4), 0 0 20px rgba(255,176,0,0.1);
    z-index: 2147483646; display: flex; flex-direction: column;
    font-family: 'Inter', -apple-system, sans-serif; color: #e8e8e8; overflow: hidden;
    animation: dialogIn 0.25s ease;
  `;

  dialog.innerHTML = getDialogHTML();
  document.body.appendChild(dialog);
  dialogInstance = dialog;
  initDialogEvents();

  // 自动提取正文
  setTimeout(() => document.getElementById('diExtractBtn')?.click(), 100);

  // 监听滚动和窗口变化，让弹窗跟随悬浮球
  const floatBtn = document.getElementById('page-inspector-float');
  const updatePosition = () => {
    if (!dialogInstance || !floatBtn) return;
    const r = floatBtn.getBoundingClientRect();
    let t = r.top - 520;
    if (t < 0) t = r.bottom + 10;
    dialogInstance.style.top = t + 'px';
    dialogInstance.style.right = (window.innerWidth - r.right) + 'px';
  };

  window.addEventListener('scroll', updatePosition, true);
  window.addEventListener('resize', updatePosition);
  dialogInstance._updatePosition = updatePosition;
}

function getDialogHTML() {
  return `
    <style>
      @keyframes dialogIn {
        from { opacity: 0; transform: scale(0.96) translateY(-10px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      @keyframes spin { to { transform: rotate(360deg); } }
      #page-inspector-dialog * { margin: 0; padding: 0; box-sizing: border-box; }

      #page-inspector-dialog .di-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px; background: #1a1a1a; border-bottom: 1px solid rgba(255,176,0,0.15); flex-shrink: 0;
      }
      #page-inspector-dialog .di-logo {
        display: flex; align-items: center; gap: 10px; color: #ffb000;
        font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 600;
      }
      #page-inspector-dialog .di-close,
      #page-inspector-dialog .di-settings-toggle {
        width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
        background: transparent; border: none; border-radius: 6px; color: #888; cursor: pointer;
      }
      #page-inspector-dialog .di-close:hover,
      #page-inspector-dialog .di-settings-toggle:hover { background: #2a2a2a; color: #e8e8e8; }
      #page-inspector-dialog .di-settings-toggle:hover { color: #ffb000; }
      #page-inspector-dialog .di-header-btn {
        width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
        background: transparent; border: none; border-radius: 6px; color: #888; cursor: pointer;
      }
      #page-inspector-dialog .di-header-btn:hover { background: #2a2a2a; color: #ffb000; }
      #page-inspector-dialog .di-header-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      #page-inspector-dialog .di-header-btn:disabled:hover { background: transparent; color: #888; }

      #page-inspector-dialog .di-settings {
        padding: 16px; background: #1a1a1a; border-bottom: 1px solid rgba(255,176,0,0.1); display: none; flex-shrink: 0;
      }
      #page-inspector-dialog .di-settings.open { display: block; }
      #page-inspector-dialog .di-settings-row { margin-bottom: 12px; }
      #page-inspector-dialog .di-settings-row:last-child { margin-bottom: 0; }
      #page-inspector-dialog .di-settings-row label {
        display: block; font-size: 11px; font-weight: 500; color: #888;
        text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;
      }
      #page-inspector-dialog .di-settings-row input {
        width: 100%; padding: 10px 12px; background: #0d0d0d; border: 1px solid #252525;
        border-radius: 6px; color: #e8e8e8; font-family: 'JetBrains Mono', monospace; font-size: 12px;
      }
      #page-inspector-dialog .di-settings-row input:focus {
        outline: none; border-color: #ffb000; box-shadow: 0 0 0 3px rgba(255,176,0,0.15);
      }
      #page-inspector-dialog .di-settings-row textarea {
        width: 100%; padding: 10px 12px; background: #0d0d0d; border: 1px solid #252525;
        border-radius: 6px; color: #e8e8e8; font-family: 'JetBrains Mono', monospace; font-size: 11px;
        line-height: 1.5; resize: vertical; min-height: 80px;
      }
      #page-inspector-dialog .di-settings-row textarea:focus {
        outline: none; border-color: #ffb000; box-shadow: 0 0 0 3px rgba(255,176,0,0.15);
      }
      #page-inspector-dialog .di-save-btn {
        width: 100%; padding: 10px 16px; background: #ffb000; border: none; border-radius: 6px;
        color: #000; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; cursor: pointer;
      }
      #page-inspector-dialog .di-save-btn:hover { background: #ffc233; }

      #page-inspector-dialog .di-toggle-row {
        display: flex; align-items: center; justify-content: space-between;
      }
      #page-inspector-dialog .di-toggle-row label { margin-bottom: 0; }
      #page-inspector-dialog .di-toggle {
        position: relative; width: 44px; height: 24px; flex-shrink: 0; cursor: pointer;
      }
      #page-inspector-dialog .di-toggle input { opacity: 0; width: 0; height: 0; }
      #page-inspector-dialog .di-toggle-slider {
        position: absolute; cursor: pointer; inset: 0;
        background: #252525; border-radius: 24px; transition: all 0.2s ease;
      }
      #page-inspector-dialog .di-toggle-slider::before {
        content: ''; position: absolute; width: 18px; height: 18px;
        left: 3px; bottom: 3px; background: #888; border-radius: 50%;
        transition: all 0.2s ease;
      }
      #page-inspector-dialog .di-toggle input:checked + .di-toggle-slider {
        background: rgba(255,176,0,0.3); border-color: #ffb000;
      }
      #page-inspector-dialog .di-toggle input:checked + .di-toggle-slider::before {
        transform: translateX(20px); background: #ffb000;
      }

      #page-inspector-dialog .di-status {
        display: flex; align-items: center; gap: 8px; padding: 8px 16px;
        background: #0d0d0d; border-bottom: 1px solid rgba(255,255,255,0.05); flex-shrink: 0;
      }
      #page-inspector-dialog .di-status-dot {
        width: 6px; height: 6px; border-radius: 50%; background: #4ade80;
        box-shadow: 0 0 6px #4ade80; animation: pulse 2s ease-in-out infinite;
      }
      #page-inspector-dialog .di-status-dot.loading { background: #ffb000; box-shadow: 0 0 6px #ffb000; animation: pulse 0.8s ease-in-out infinite; }
      #page-inspector-dialog .di-status-dot.error { background: #f87171; box-shadow: 0 0 6px #f87171; animation: none; }
      #page-inspector-dialog .di-status-text { font-size: 11px; color: #555; font-family: 'JetBrains Mono', monospace; }

      #page-inspector-dialog .di-actions {
        padding: 12px; display: none; flex-shrink: 0;
      }
      #page-inspector-dialog .di-action-btn {
        flex: 1; display: flex; align-items: center; gap: 10px; padding: 12px 14px;
        background: #1a1a1a; border: 1px solid #252525; border-radius: 10px;
        cursor: pointer; transition: all 0.2s ease; color: #e8e8e8;
      }
      #page-inspector-dialog .di-action-btn:hover {
        background: #2a2a2a; border-color: rgba(255,176,0,0.3); transform: translateY(-1px);
      }
      #page-inspector-dialog .di-action-btn.primary {
        background: linear-gradient(135deg, rgba(255,176,0,0.12) 0%, rgba(255,176,0,0.06) 100%);
        border-color: rgba(255,176,0,0.3); color: #ffb000;
      }
      #page-inspector-dialog .di-action-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
      #page-inspector-dialog .di-action-btn .di-btn-icon {
        width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      #page-inspector-dialog .di-btn-text { flex: 1; }
      #page-inspector-dialog .di-btn-title { font-size: 13px; font-weight: 500; }
      #page-inspector-dialog .di-btn-desc { font-size: 10px; color: #888; margin-top: 1px; }

      #page-inspector-dialog .di-result-area {
        flex: 1; margin: 0 12px 12px; display: flex; flex-direction: column; min-height: 0; overflow: hidden;
      }
      #page-inspector-dialog .di-tabs {
        display: flex; background: #1a1a1a; border: 1px solid #252525; border-radius: 10px 10px 0 0; overflow: hidden; flex-shrink: 0;
      }
      #page-inspector-dialog .di-tab {
        flex: 1; padding: 10px; text-align: center; font-size: 12px; font-weight: 500; color: #888;
        cursor: pointer; transition: all 0.15s ease; border: none; background: transparent;
      }
      #page-inspector-dialog .di-tab:hover { color: #e8e8e8; }
      #page-inspector-dialog .di-tab.active { background: #252525; color: #ffb000; }
      #page-inspector-dialog .di-tab.has-content::after {
        content: ''; display: inline-block; width: 6px; height: 6px; background: #4ade80;
        border-radius: 50%; margin-left: 6px; vertical-align: middle;
      }
      #page-inspector-dialog .di-tab-content {
        flex: 1; background: #1a1a1a; border: 1px solid #252525; border-top: none;
        border-radius: 0 0 10px 10px; overflow: hidden; display: none;
      }
      #page-inspector-dialog .di-tab-content.active { display: flex; flex-direction: column; }
      #page-inspector-dialog .di-content-body {
        flex: 1; padding: 14px; max-height: 220px; overflow-y: auto; font-size: 12px; line-height: 1.7; color: #888;
      }
      #page-inspector-dialog .di-content-body::-webkit-scrollbar { width: 6px; }
      #page-inspector-dialog .di-content-body::-webkit-scrollbar-track { background: transparent; }
      #page-inspector-dialog .di-content-body::-webkit-scrollbar-thumb { background: #252525; border-radius: 3px; }
      #page-inspector-dialog .di-content-body pre { white-space: pre-wrap; word-break: break-word; font-family: 'JetBrains Mono', monospace; color: #e8e8e8; }
      #page-inspector-dialog .di-content-body .placeholder { color: #555; font-style: italic; }
      #page-inspector-dialog .di-action-bar {
        display: flex; gap: 8px; padding: 10px 14px; background: #252525; border-top: 1px solid rgba(255,255,255,0.05);
      }
      #page-inspector-dialog .di-action-bar .di-copy-btn,
      #page-inspector-dialog .di-action-bar .di-export-btn {
        flex: 1; padding: 8px 12px; border: none; border-radius: 6px; font-size: 11px;
        font-weight: 500; cursor: pointer; transition: all 0.15s ease; display: flex; align-items: center; justify-content: center; gap: 5px;
      }
      #page-inspector-dialog .di-action-bar .di-copy-btn {
        background: #252525; color: #e8e8e8; border: 1px solid #333;
      }
      #page-inspector-dialog .di-action-bar .di-copy-btn:hover { background: #333; }
      #page-inspector-dialog .di-action-bar .di-export-btn {
        background: #ffb000; color: #000;
      }
      #page-inspector-dialog .di-action-bar .di-export-btn:hover { background: #ffc233; }
      #page-inspector-dialog .di-action-bar .di-export-btn:disabled { background: #333; color: #666; cursor: not-allowed; }

      #page-inspector-dialog .di-loading {
        position: absolute; inset: 0; display: none; flex-direction: column;
        align-items: center; justify-content: center; gap: 12px;
        background: rgba(13,13,13,0.92); backdrop-filter: blur(4px); z-index: 100;
      }
      #page-inspector-dialog .di-loading.active { display: flex; }
      #page-inspector-dialog .di-spinner {
        width: 32px; height: 32px; border: 2px solid #252525; border-top-color: #ffb000;
        border-radius: 50%; animation: spin 0.8s linear infinite;
      }
      #page-inspector-dialog .di-loading span { font-size: 12px; color: #888; font-family: 'JetBrains Mono', monospace; }
    </style>

    <header class="di-header">
      <div class="di-logo" title="PageBrief - AI 网页总结工具">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        </svg>
        <span>PageBrief</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button class="di-header-btn" id="diExtractBtn" title="提取正文">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.3"/>
            <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="di-header-btn" id="diSummarizeBtn" title="总结内容" disabled>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M10 3l1.5 4.5H16l-3.5 2.5 1.5 4.5L10 12l-4 2.5 1.5-4.5L4 7.5h4.5L10 3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
        </button>
        <div style="width:1px;height:20px;background:#333;margin:0 2px;"></div>
        <button class="di-settings-toggle" id="diSettingsToggle" title="设置">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13.5 6.5L12 5l-1.5 1.5L12 8l1.5-1.5zM13.5 9.5L12 8l-1.5 1.5L12 11l1.5-1.5zM9.5 6.5L8 5 6.5 6.5 8 8l1.5-1.5zM2.5 6.5L5 4l1 1-2.5 2.5-1-1zM5 12l-2.5-2.5 1-1L6 11l-1 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
            <path d="M8 3v2M8 11v2M3 8h2M11 8h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="di-close" id="diCloseBtn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </header>

    <section class="di-settings" id="diSettings">
      <div class="di-settings-row">
        <label>API URL</label>
        <input type="text" id="diApiUrl" placeholder="https://api.minimaxi.com/v1/chat/completions">
      </div>
      <div class="di-settings-row">
        <label>API Key</label>
        <input type="password" id="diApiKey" placeholder="sk-...">
      </div>
      <div class="di-settings-row">
        <label>Model</label>
        <input type="text" id="diModel" placeholder="MiniMax-M2.7">
      </div>
      <div class="di-settings-row di-toggle-row">
        <label>深度思考 (Thinking)</label>
        <label class="di-toggle">
          <input type="checkbox" id="diThinking">
          <span class="di-toggle-slider"></span>
        </label>
      </div>
      <div class="di-settings-row">
        <label>总结提示词 (System Prompt)</label>
        <textarea id="diPrompt" rows="4" placeholder="输入 AI 总结提示词..."></textarea>
      </div>
      <button class="di-save-btn" id="diSaveBtn">保存配置</button>
    </section>

    <div class="di-status">
      <span class="di-status-dot" id="diStatusDot"></span>
      <span class="di-status-text" id="diStatusText">就绪</span>
    </div>

    <div class="di-actions">
      <button class="di-action-btn primary" id="diExtractBtnOld">
        <div class="di-btn-icon">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.3"/>
            <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="di-btn-text">
          <div class="di-btn-title">提取正文</div>
          <div class="di-btn-desc">获取网页纯文本</div>
        </div>
      </button>
      <button class="di-action-btn" id="diSummarizeBtnOld" disabled>
        <div class="di-btn-icon">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L3 7v11h14V7l-7-5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M7 17v-6h6v6M7 11h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="di-btn-text">
          <div class="di-btn-title">总结内容</div>
          <div class="di-btn-desc">AI 总结并导出 Markdown</div>
        </div>
      </button>
    </div>

    <div class="di-result-area">
      <div class="di-tabs">
        <button class="di-tab active" data-tab="original">原文</button>
        <button class="di-tab" data-tab="summary">总结</button>
      </div>
      <div class="di-tab-content active" id="diOriginalContent">
        <div class="di-content-body" id="diOriginalBody">
          <span class="placeholder">点击「提取正文」开始...</span>
        </div>
        <div class="di-action-bar" id="diOriginalActionBar" style="display: none;">
          <button class="di-copy-btn" id="diOriginalCopyBtn">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/>
              <path d="M2 10V3a1 1 0 011-1h7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            复制
          </button>
        </div>
      </div>
      <div class="di-tab-content" id="diSummaryContent">
        <div class="di-content-body" id="diSummaryBody">
          <span class="placeholder">总结内容将在此显示</span>
        </div>
        <div class="di-action-bar" id="diActionBar" style="display: none;">
          <button class="di-copy-btn" id="diCopyBtn">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/>
              <path d="M2 10V3a1 1 0 011-1h7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            复制
          </button>
          <button class="di-export-btn" id="diExportBtn" disabled>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v8M4 7l3 3 3-3M2 12h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            导出 Markdown
          </button>
        </div>
      </div>
    </div>

    <div class="di-loading" id="diLoading">
      <div class="di-spinner"></div>
      <span id="diLoadingText">处理中...</span>
    </div>
  `;
}

function initDialogEvents() {
  let pageData = null;
  let summaryContent = '';
  let originalContent = '';

  document.getElementById('diCloseBtn').addEventListener('click', closeDialog);

  // Tab switching
  document.querySelectorAll('.di-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.di-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.di-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('di' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1) + 'Content').classList.add('active');
    });
  });

  // Settings toggle
  document.getElementById('diSettingsToggle').addEventListener('click', () => {
    const settings = document.getElementById('diSettings');
    const resultArea = document.querySelector('.di-result-area');
    settings.classList.toggle('open');
    if (resultArea) resultArea.style.display = settings.classList.contains('open') ? 'none' : '';
  });

  // Load settings
  chrome.storage.local.get(['apiUrl', 'apiKey', 'model', 'thinking', 'prompt'], (result) => {
    document.getElementById('diApiUrl').value = result.apiUrl || 'https://api.minimaxi.com/v1/chat/completions';
    document.getElementById('diApiKey').value = result.apiKey || '';
    document.getElementById('diModel').value = result.model || 'MiniMax-M2.7';
    document.getElementById('diThinking').checked = result.thinking || false;
    document.getElementById('diPrompt').value = result.prompt || getDefaultPrompt();
  });

  // Save settings
  document.getElementById('diSaveBtn').addEventListener('click', () => {
    chrome.storage.local.set({
      apiUrl: document.getElementById('diApiUrl').value.trim(),
      apiKey: document.getElementById('diApiKey').value.trim(),
      model: document.getElementById('diModel').value.trim(),
      thinking: document.getElementById('diThinking').checked,
      prompt: document.getElementById('diPrompt').value.trim()
    }, () => {
      document.getElementById('diSettings').classList.remove('open');
      const resultArea = document.querySelector('.di-result-area');
      if (resultArea) resultArea.style.display = '';
      setStatus('配置已保存', 'ready');
      setTimeout(() => setStatus('就绪'), 1500);
    });
  });

  // Extract button
  document.getElementById('diExtractBtn').addEventListener('click', async () => {
    try {
      showLoading(true, '正在提取内容...');
      setStatus('正在提取...', 'loading');

      pageData = extractPageContent();
      originalContent = pageData.content;

      document.getElementById('diOriginalBody').innerHTML = `<pre>${escapeHtml(originalContent.slice(0, 5000))}${originalContent.length > 5000 ? '\n\n... (内容已截断)' : ''}</pre>`;
      document.querySelector('[data-tab="original"]').classList.add('has-content');
      document.getElementById('diOriginalActionBar').style.display = 'flex';

      document.getElementById('diSummarizeBtn').disabled = false;
      setStatus('提取完成', 'ready');

      // Switch to original tab
      document.querySelector('[data-tab="original"]').click();
    } catch (error) {
      document.getElementById('diOriginalBody').innerHTML = `<span style="color: #f87171;">错误: ${error.message}</span>`;
      setStatus('提取失败', 'error');
    } finally {
      showLoading(false);
    }
  });

  // Summarize button
  document.getElementById('diSummarizeBtn').addEventListener('click', async () => {
    if (!originalContent) return;
    try {
      showLoading(true, '正在 AI 总结...');
      setStatus('正在总结...', 'loading');

      summaryContent = await summarizeContent(originalContent);
      // Remove think blocks
      summaryContent = summaryContent.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim();

      document.getElementById('diSummaryBody').innerHTML = `<pre>${escapeHtml(summaryContent)}</pre>`;
      document.querySelector('[data-tab="summary"]').classList.add('has-content');
      document.getElementById('diActionBar').style.display = 'flex';
      document.getElementById('diExportBtn').disabled = false;

      setStatus('总结完成', 'ready');
      document.querySelector('[data-tab="summary"]').click();
    } catch (error) {
      document.getElementById('diSummaryBody').innerHTML = `<span style="color: #f87171;">错误: ${error.message}</span>`;
      setStatus('总结失败', 'error');
    } finally {
      showLoading(false);
    }
  });

  // Copy button (for summary tab)
  document.getElementById('diCopyBtn').addEventListener('click', () => {
    if (summaryContent) {
      navigator.clipboard.writeText(summaryContent).then(() => {
        const btn = document.getElementById('diCopyBtn');
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> 已复制`;
        setTimeout(() => {
          btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M2 10V3a1 1 0 011-1h7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg> 复制`;
        }, 1500);
      });
    }
  });

  // Copy button (for original tab)
  document.getElementById('diOriginalCopyBtn').addEventListener('click', () => {
    if (originalContent) {
      navigator.clipboard.writeText(originalContent).then(() => {
        const btn = document.getElementById('diOriginalCopyBtn');
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> 已复制`;
        setTimeout(() => {
          btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M2 10V3a1 1 0 011-1h7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg> 复制`;
        }, 1500);
      });
    }
  });

  // Export button
  document.getElementById('diExportBtn').addEventListener('click', () => {
    if (!summaryContent || !pageData) return;
    const markdown = generateMarkdownExport(pageData, summaryContent);
    downloadMarkdown(pageData, markdown);
  });

  // Helpers
  function setStatus(text, state = 'ready') {
    const dot = document.getElementById('diStatusDot');
    const textEl = document.getElementById('diStatusText');
    textEl.textContent = text;
    dot.className = 'di-status-dot';
    if (state === 'loading') dot.classList.add('loading');
    if (state === 'error') dot.classList.add('error');
  }

  const spinnerVerbs = [
    '正在思考', '正在分析', '正在理解', '正在提取', '正在整理',
    '正在总结', '正在归纳', '正在组织', '正在优化', '正在生成',
    '正在润色', '正在加工', '正在转译', '正在构建', '正在编排',
    '正在解析', '正在处理', '正在计算', '正在推理', '正在学习',
    '正在理解', '正在消化', '正在吸收', '正在压缩', '正在格式化',
    '正在翻译', '正在改写', '正在浓缩', '正在提炼', '正在摘录',
    '正在筛选', '正在分类', '正在排序', '正在过滤', '正在诊断',
    '正在评估', '正在对比', '正在匹配', '正在查找', '正在搜索',
    '正在识别', '正在认知', '正在感知', '正在发现', '正在探索',
    '正在研究', '正在钻研', '正在推敲', '正在琢磨'
  ];
  let spinnerIndex = 0;
  let spinnerInterval = null;

  function showLoading(show, text = '处理中...') {
    if (show) {
      spinnerIndex = 0;
      document.getElementById('diLoading').classList.add('active');
      document.getElementById('diLoadingText').textContent = text + spinnerVerbs[0];
      spinnerInterval = setInterval(() => {
        spinnerIndex = (spinnerIndex + 1) % spinnerVerbs.length;
        document.getElementById('diLoadingText').textContent = text + spinnerVerbs[spinnerIndex];
      }, 500);
    } else {
      document.getElementById('diLoading').classList.remove('active');
      if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
      }
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function summarizeContent(content) {
    const settings = await new Promise(r => chrome.storage.local.get(['apiUrl', 'apiKey', 'model', 'thinking', 'prompt'], r));

    if (!settings.apiUrl || !settings.apiKey || !settings.model) {
      throw new Error('请先配置 API 参数');
    }

    // 根据设置决定是否启用深度思考
    const thinkingConfig = settings.thinking
      ? { type: "enabled" }
      : { type: "disabled" };

    // 使用用户自定义提示词或默认提示词
    const systemPrompt = settings.prompt || getDefaultPrompt();

    const response = await fetch(settings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        thinking: thinkingConfig,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `请将以下网页内容总结成带 YAML 元信息的 Markdown 格式：\n\n${content.slice(0, 8000)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '未能生成摘要';
  }

  function getDefaultPrompt() {
    return `你是一个网页内容分析助手。请将用户提供的网页内容总结成规范的 Markdown 格式。
总结要求：
1. 保留原文的核心观点和重要细节
2. 使用 Markdown 格式组织内容（标题、列表、引用等）
3. 在内容开头添加 YAML frontmatter 元信息
4. 不要使用任何代码块标记（\`\`\`yaml 或 \`\`\`markdown），直接输出 YAML 和 Markdown 正文`;
  }

  function generateMarkdownExport(pageData, summary) {
    // Strip markdown code fences if present
    let cleaned = summary.replace(/^```(markdown|yaml)?\s*/i, '').replace(/```\s*$/, '').trim();

    const now = new Date();
    const published = pageData.published || '';
    const author = pageData.author || [];

    // Parse frontmatter if already present in cleaned summary
    if (cleaned.startsWith('---')) {
      return cleaned;
    }

    // Build YAML frontmatter
    const frontmatter = `---
title: "${pageData.title || '无标题'}"
source: "${pageData.url || ''}"
${author.length > 0 ? `author:\n${author.map(a => `  - "${a}"`).join('\n')}` : 'author: []'}
${published ? `published: ${published}` : ''}
created: ${now.toISOString().split('T')[0]}
---`;

    return `${frontmatter}\n\n${cleaned}`;
  }

  function downloadMarkdown(pageData, markdown) {
    // Remove <think>...</think> blocks if present
    markdown = markdown.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim();

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(pageData.title || 'page')}_总结.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 50) || 'page';
  }
}

function closeDialog() {
  if (dialogInstance) {
    if (dialogInstance._updatePosition) {
      window.removeEventListener('scroll', dialogInstance._updatePosition, true);
      window.removeEventListener('resize', dialogInstance._updatePosition);
    }
    dialogInstance.remove();
    dialogInstance = null;
  }
}

document.addEventListener('click', (e) => {
  if (dialogInstance && !dialogInstance.contains(e.target) && !document.getElementById('page-inspector-float')?.contains(e.target)) {
    closeDialog();
  }
});

// ============================================
// Content Extraction
// ============================================

function extractPageContent() {
  const title = document.title || document.querySelector('h1')?.textContent || '';
  const url = window.location.href;
  const content = getPageContent();

  // Try to extract additional metadata
  const author = [];
  const authorMeta = document.querySelector('meta[name="author"]') || document.querySelector('meta[property="article:author"]');
  if (authorMeta) author.push(authorMeta.getAttribute('content'));

  const publishedMeta = document.querySelector('meta[property="article:published_time"]') || document.querySelector('time');
  let published = '';
  if (publishedMeta) {
    published = publishedMeta.getAttribute('content') || publishedMeta.textContent;
    if (published) published = published.split('T')[0];
  }

  return {
    title: title.trim(),
    url: url,
    content: content,
    author: author,
    published: published
  };
}

function getPageContent() {
  const selectors = ['article', '[role="main"]', 'main', '.post-content', '.article-content', '.entry-content', '.content', '#content', '.post', '.article'];
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.length > 200) {
      return cleanText(element.textContent);
    }
  }

  const body = document.body.cloneNode(true);
  const removeSelectors = ['script', 'style', 'noscript', 'iframe', 'nav', 'header', 'footer', 'aside', '.sidebar', '.navigation', '.menu', '.comments', '.advertisement', '.ad', '.social-share', '.related-posts'];
  removeSelectors.forEach(selector => {
    body.querySelectorAll(selector).forEach(el => el.remove());
  });

  return cleanText(body.textContent);
}

function cleanText(text) {
  return text.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim().slice(0, 50000);
}
