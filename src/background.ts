import { cleanupExpiredFullscreenQrSessions } from './browser/fullscreen-qr';

function enableActionSidePanel(): void {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
}

function cleanupFullscreenQr(): void {
  void cleanupExpiredFullscreenQrSessions().catch(() => undefined);
}

chrome.runtime.onInstalled.addListener(enableActionSidePanel);
chrome.runtime.onStartup.addListener(cleanupFullscreenQr);
chrome.tabs.onRemoved.addListener(cleanupFullscreenQr);
enableActionSidePanel();
cleanupFullscreenQr();
