// ============================================
// Page Inspector - Background Service Worker
// ============================================

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Page Inspector 已安装');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openPopup') {
    // Try to open the extension popup
    chrome.action.openPopup().catch(() => {
      // If openPopup fails (permission issues), try alternative
      console.log('无法自动打开 popup，请点击扩展图标');
    });
  }
  return true;
});
