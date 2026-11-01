import { afterEach, describe, expect, it, vi } from 'vitest';
import { getActivePageContext, readCookies, readPageSnapshot, toOriginPattern } from './chrome-gateway';

afterEach(() => vi.unstubAllGlobals());

describe('toOriginPattern', () => {
  it('reads Piggo visitor from MAIN world only for matching page and token', async () => {
    const snapshot = {url:'https://piggo.me/torrents',origin:'https://piggo.me',host:'piggo.me',storage:[{area:'local',key:'pig_token',value:'fixture'}]};
    const visitorId = '0123456789abcdef0123456789abcdef';
    const executeScript = vi.fn().mockResolvedValueOnce([{result:snapshot}]).mockResolvedValueOnce([{result:{url:snapshot.url,token:'fixture',visitorId}}]);
    vi.stubGlobal('chrome', {scripting:{executeScript}});
    await expect(readPageSnapshot(42)).resolves.toMatchObject({pigVisitorId:visitorId});
    expect(executeScript.mock.calls[1]?.[0]).toMatchObject({world:'MAIN',target:{tabId:42,frameIds:[0]}});
  });

  it.each(['changed-token','changed-url'])('does not combine Piggo credentials after %s', async (change) => {
    const snapshot = {url:'https://piggo.me/torrents',origin:'https://piggo.me',host:'piggo.me',storage:[{area:'local',key:'pig_token',value:'fixture'}]};
    const main = {url:change === 'changed-url' ? 'https://piggo.me/other' : snapshot.url,token:change === 'changed-token' ? 'other' : 'fixture',visitorId:'0'.repeat(32)};
    const executeScript = vi.fn().mockResolvedValueOnce([{result:snapshot}]).mockResolvedValueOnce([{result:main}]);
    vi.stubGlobal('chrome', {scripting:{executeScript}});
    expect((await readPageSnapshot(42)).pigVisitorId).toBeUndefined();
  });

  it('returns the exact HTTP(S) origin pattern', () => {
    expect(toOriginPattern('https://pt.example.com/path?q=1')).toBe('https://pt.example.com/*');
    expect(toOriginPattern('http://localhost:8080/page')).toBe('http://localhost:8080/*');
  });

  it.each(['chrome://extensions', 'file:///tmp/page.html', 'about:blank'])('rejects unsupported URL %s', (url) => {
    expect(() => toOriginPattern(url)).toThrow('请在普通 HTTP 或 HTTPS 站点中使用');
  });

  it('does not treat temporary activeTab access as an explicit Cookie host grant', async () => {
    vi.stubGlobal('chrome', {
      tabs: { query: vi.fn().mockResolvedValue([{ id: 42, url: 'https://hhanclub.net/torrents.php' }]) },
      permissions: {
        contains: vi.fn().mockResolvedValue(true),
        getAll: vi.fn().mockResolvedValue({ permissions: ['activeTab'], origins: [] }),
      },
    });

    await expect(getActivePageContext()).resolves.toMatchObject({
      origin: 'https://hhanclub.net',
      hasPermission: false,
    });
  });

  it.each([
    ['https://hhanclub.net/*'],
    ['https://*/*'],
    ['<all_urls>'],
  ])('accepts an explicit host grant covering the active site: %s', async (originGrant) => {
    vi.stubGlobal('chrome', {
      tabs: { query: vi.fn().mockResolvedValue([{ id: 42, url: 'https://hhanclub.net/torrents.php' }]) },
      permissions: {
        contains: vi.fn().mockResolvedValue(true),
        getAll: vi.fn().mockResolvedValue({ permissions: ['activeTab'], origins: [originGrant] }),
      },
    });

    await expect(getActivePageContext()).resolves.toMatchObject({ hasPermission: true });
  });

  it('reads cookies from the store that owns the active tab', async () => {
    const getAll = vi.fn().mockResolvedValue([
      { name: 'c_secure_uid', value: '1', domain: 'pt.example', path: '/', secure: true },
    ]);
    vi.stubGlobal('chrome', {
      cookies: {
        getAllCookieStores: vi.fn().mockResolvedValue([
          { id: 'default', tabIds: [1, 2] },
          { id: 'incognito', tabIds: [77] },
        ]),
        getAll,
      },
    });

    const cookies = await readCookies('https://pt.example/torrents.php', 77);

    expect(getAll).toHaveBeenCalledWith({ url: 'https://pt.example/torrents.php', storeId: 'incognito' });
    expect(cookies[0]?.name).toBe('c_secure_uid');
  });

  it('falls back to a domain query when Chrome returns no cookies for the page URL', async () => {
    const getAll = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { name: 'c_secure_pass', value: 'secret', domain: '.hhanclub.net', path: '/', secure: true },
      ]);
    vi.stubGlobal('chrome', {
      cookies: {
        getAllCookieStores: vi.fn().mockResolvedValue([{ id: 'default', tabIds: [42] }]),
        getAll,
      },
    });

    const cookies = await readCookies('https://hhanclub.net/torrents.php', 42);

    expect(getAll).toHaveBeenNthCalledWith(1, {
      url: 'https://hhanclub.net/torrents.php',
      storeId: 'default',
    });
    expect(getAll).toHaveBeenNthCalledWith(2, { domain: 'hhanclub.net', storeId: 'default' });
    expect(cookies.map((cookie) => cookie.name)).toEqual(['c_secure_pass']);
  });

  it('recovers HttpOnly cookies from the active store when URL queries return only page-visible cookies', async () => {
    const visibleCookies = [
      { name: 'pigo_session', value: 'visible', domain: 'piggo.me', path: '/', secure: true },
    ];
    const allStoreCookies = [
      ...visibleCookies,
      { name: 'pigo_np_web_session', value: 'http-only', domain: 'piggo.me', path: '/', secure: true },
      { name: 'sl-session', value: 'challenge', domain: '.piggo.me', path: '/', secure: true },
    ];
    const getAll = vi.fn()
      .mockResolvedValueOnce(visibleCookies)
      .mockResolvedValueOnce(visibleCookies)
      .mockResolvedValueOnce(allStoreCookies);
    vi.stubGlobal('chrome', {
      cookies: {
        getAllCookieStores: vi.fn().mockResolvedValue([{ id: 'default', tabIds: [42] }]),
        getAll,
      },
    });

    const cookies = await readCookies('https://piggo.me/torrents.php', 42);

    expect(getAll).toHaveBeenNthCalledWith(3, { storeId: 'default' });
    expect(cookies.map((cookie) => cookie.name)).toEqual([
      'pigo_session',
      'pigo_np_web_session',
      'sl-session',
    ]);
  });

  it('merges ordinary and active-tab partitioned cookies without dropping same-name values', async () => {
    const ordinary = [
      { name: 'session', value: 'ordinary', domain: '.haidan.cc', path: '/', secure: true },
    ];
    const partitioned = [
      {
        name: 'session', value: 'partitioned', domain: '.haidan.cc', path: '/', secure: true,
        partitionKey: { topLevelSite: 'https://haidan.cc', hasCrossSiteAncestor: false },
      },
      {
        name: 'cf_clearance', value: 'clearance', domain: '.haidan.cc', path: '/', secure: true,
        partitionKey: { topLevelSite: 'https://haidan.cc', hasCrossSiteAncestor: false },
      },
    ];
    const getAll = vi.fn()
      .mockResolvedValueOnce(ordinary)
      .mockResolvedValueOnce(ordinary)
      .mockResolvedValueOnce(partitioned)
      .mockResolvedValueOnce(partitioned);
    const partitionKey = { topLevelSite: 'https://haidan.cc', hasCrossSiteAncestor: false };
    const getPartitionKey = vi.fn().mockResolvedValue({ partitionKey });
    vi.stubGlobal('chrome', {
      cookies: {
        getAllCookieStores: vi.fn().mockResolvedValue([{ id: 'default', tabIds: [42] }]),
        getPartitionKey,
        getAll,
      },
    });

    const cookies = await readCookies('https://www.haidan.cc/torrents.php', 42);

    expect(getPartitionKey).toHaveBeenCalledWith({ tabId: 42, frameId: 0 });
    expect(getAll).toHaveBeenNthCalledWith(3, {
      url: 'https://www.haidan.cc/torrents.php',
      storeId: 'default',
      partitionKey,
    });
    expect(getAll).toHaveBeenNthCalledWith(4, {
      domain: 'www.haidan.cc',
      storeId: 'default',
      partitionKey,
    });
    expect(cookies.map((cookie) => `${cookie.name}=${cookie.value}`)).toEqual([
      'session=ordinary',
      'session=partitioned',
      'cf_clearance=clearance',
    ]);
  });
});
