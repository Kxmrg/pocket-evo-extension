import type { CookieLike } from '../domain/cookies';
import type { PageSnapshot } from '../domain/types';
import { collectPageSnapshot } from './page-probe';

// Serialized by chrome.scripting and executed in the page's MAIN world.
export function readPiggoSession(): { url: string; token: string; visitorId: string } | null {
  if (window.location.origin !== 'https://piggo.me') return null;
  try {
    const value = (window as Window & { __ptvisitorid?: unknown }).__ptvisitorid;
    const token = window.localStorage.getItem('pig_token') ?? '';
    if (typeof value !== 'string' || !/^[0-9a-f]{32}$/.test(value) || token.length > 4096) return null;
    return { url: window.location.href, token, visitorId: value };
  } catch { return null; }
}

export interface ActivePageContext {
  tabId: number;
  url: string;
  origin: string;
  hasPermission: boolean;
}

export function toOriginPattern(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('请在普通 HTTP 或 HTTPS 站点中使用');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('请在普通 HTTP 或 HTTPS 站点中使用');
  }
  return `${url.origin}/*`;
}

function grantedPatternCoversUrl(pattern: string, url: URL): boolean {
  if (pattern === '<all_urls>') return true;
  const match = /^(\*|https?):\/\/([^/]+)\//i.exec(pattern);
  if (!match) return false;
  const scheme = match[1];
  const hostPatternValue = match[2];
  if (!scheme || !hostPatternValue) return false;
  if (scheme !== '*' && `${scheme.toLowerCase()}:` !== url.protocol) return false;

  const hostPattern = hostPatternValue.toLowerCase();
  const targetHost = url.host.toLowerCase();
  if (hostPattern === '*') return true;
  if (hostPattern.startsWith('*.')) {
    const baseHost = hostPattern.slice(2);
    const targetHostname = url.hostname.toLowerCase();
    return targetHostname === baseHost || targetHostname.endsWith(`.${baseHost}`);
  }
  return hostPattern === targetHost;
}

export async function getActivePageContext(): Promise<ActivePageContext> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error('未找到当前页面，请重新打开站点后重试');
  toOriginPattern(tab.url);
  const url = new URL(tab.url);
  const granted = await chrome.permissions.getAll();
  const hasPermission = (granted.origins ?? []).some((pattern) => grantedPatternCoversUrl(pattern, url));
  return { tabId: tab.id, url: tab.url, origin: url.origin, hasPermission };
}

export async function requestCurrentOrigin(origin: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [toOriginPattern(origin)] });
}

export async function readPageSnapshot(tabId: number): Promise<PageSnapshot> {
  const results = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: collectPageSnapshot,
  });
  const snapshot = results[0]?.result as PageSnapshot | undefined;
  if (!snapshot) throw new Error('页面未返回可读取的信息');
  if (snapshot.origin === 'https://piggo.me' && snapshot.host === 'piggo.me') {
    try {
      const main = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [0] }, world: 'MAIN', func: readPiggoSession,
      });
      const session = main[0]?.result as ReturnType<typeof readPiggoSession>;
      const token = snapshot.storage.find((entry) => entry.area === 'local' && entry.key === 'pig_token')?.value;
      if (session?.url === snapshot.url && session.token === token && /^[0-9a-f]{32}$/.test(session.visitorId)) {
        snapshot.pigVisitorId = session.visitorId;
      }
    } catch { /* Validation will require a fresh read when the page is not ready. */ }
  }
  return snapshot;
}

export async function readCookies(url: string, tabId?: number): Promise<CookieLike[]> {
  const selectedTabId = tabId;
  const stores = selectedTabId === undefined ? [] : await chrome.cookies.getAllCookieStores();
  const storeId = selectedTabId === undefined
    ? undefined
    : stores.find((store) => store.tabIds.includes(selectedTabId))?.id;
  const hostname = new URL(url).hostname;
  let partitionKey: chrome.cookies.CookiePartitionKey | undefined;
  if (selectedTabId !== undefined && typeof chrome.cookies.getPartitionKey === 'function') {
    try {
      partitionKey = (await chrome.cookies.getPartitionKey({ tabId: selectedTabId, frameId: 0 })).partitionKey;
    } catch {
      // Ordinary cookies remain readable if Chrome cannot resolve a partition key.
    }
  }
  const queryDetails: chrome.cookies.GetAllDetails[] = [
    storeId ? { url, storeId } : { url },
    storeId ? { domain: hostname, storeId } : { domain: hostname },
  ];
  if (partitionKey) {
    queryDetails.push(
      storeId ? { url, storeId, partitionKey } : { url, partitionKey },
      storeId ? { domain: hostname, storeId, partitionKey } : { domain: hostname, partitionKey },
    );
  }
  // Some Chromium builds return only the document-visible subset for URL and
  // domain queries. Reading the granted store as a final source recovers
  // HttpOnly authentication/challenge cookies; host permissions still limit
  // what the extension can see, and formatCookieHeader filters by URL below.
  queryDetails.push(storeId ? { storeId } : {});
  if (partitionKey) {
    queryDetails.push(storeId ? { storeId, partitionKey } : { partitionKey });
  }
  const cookieQueries = await Promise.allSettled(queryDetails.map((details) => chrome.cookies.getAll(details)));
  const fulfilledQueries = cookieQueries
    .filter((result): result is PromiseFulfilledResult<chrome.cookies.Cookie[]> =>
      result.status === 'fulfilled' && Array.isArray(result.value));
  if (fulfilledQueries.length === 0) throw new Error('Chrome Cookie API unavailable');

  const uniqueCookies = new Map<string, chrome.cookies.Cookie>();
  for (const result of fulfilledQueries) {
    for (const cookie of result.value) {
      const partition = cookie.partitionKey
        ? `${cookie.partitionKey.topLevelSite ?? ''}\u0000${cookie.partitionKey.hasCrossSiteAncestor ?? ''}`
        : '';
      const key = `${cookie.name}\u0000${cookie.domain}\u0000${cookie.path}\u0000${partition}`;
      if (!uniqueCookies.has(key)) uniqueCookies.set(key, cookie);
    }
  }
  return [...uniqueCookies.values()].map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
  }));
}
