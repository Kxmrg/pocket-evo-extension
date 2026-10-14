import { describe, expect, it } from 'vitest';
import { collectSiteDraft, type CollectionDeps } from './collect-site';
import type { PageSnapshot } from '../domain/types';

function nexusSnapshot(): PageSnapshot {
  return {
    url: 'https://pt.example/torrents.php',
    origin: 'https://pt.example',
    host: 'pt.example',
    title: 'Fixture PT',
    userAgent: 'Browser UA',
    meta: [{ name: 'generator', property: '', content: 'NexusPHP' }],
    resources: [],
    links: [{ text: '综合', href: 'https://pt.example/torrents.php' }],
    textSample: '',
    storage: [],
    candidates: [],
  };
}

function deps(overrides: Partial<CollectionDeps> = {}): CollectionDeps {
  return {
    getContext: async () => ({ url: 'https://pt.example/torrents.php', origin: 'https://pt.example', hasPermission: true }),
    readSnapshot: async () => nexusSnapshot(),
    readCookies: async () => [{ name: 'session', value: 'secret', domain: 'pt.example', path: '/', secure: true }],
    ...overrides,
  };
}

describe('collectSiteDraft', () => {
  it('returns permission-required before reading private page data', async () => {
    let snapshotRead = false;
    const result = await collectSiteDraft(deps({
      getContext: async () => ({ url: 'https://pt.example/', origin: 'https://pt.example', hasPermission: false }),
      readSnapshot: async () => { snapshotRead = true; return nexusSnapshot(); },
    }));
    expect(result).toEqual({ state: 'permission-required', origin: 'https://pt.example' });
    expect(snapshotRead).toBe(false);
  });

  it('returns a real detected and adapted draft', async () => {
    const result = await collectSiteDraft(deps());
    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready result');
    expect(result.detection.id).toBe('nexusphp');
    expect(result.draft).toMatchObject({ scheme: 0, cookie: 'session=secret', address: 'https://pt.example' });
  });

  it('uses page-visible cookies when the Chrome Cookie API returns an empty list', async () => {
    const result = await collectSiteDraft(deps({
      readSnapshot: async () => ({ ...nexusSnapshot(), documentCookie: 'session=page-secret; theme=dark' }),
      readCookies: async () => [],
    }));

    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready result');
    expect(result.draft.cookie).toBe('session=page-secret; theme=dark');
    expect(result.draft.fieldWarnings.cookie).toContain('页面可见 Cookie');
  });

  it('explains when neither Chrome nor the current page returns a Cookie', async () => {
    const result = await collectSiteDraft(deps({
      readSnapshot: async () => ({ ...nexusSnapshot(), documentCookie: '' }),
      readCookies: async () => [],
    }));

    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready result');
    expect(result.draft.cookie).toBe('');
    expect(result.draft.fieldWarnings.cookie).toContain('确认已登录并允许读取本站');
  });

  it('keeps complete API cookies and appends only missing page-visible cookies', async () => {
    const result = await collectSiteDraft(deps({
      readSnapshot: async () => ({ ...nexusSnapshot(), documentCookie: 'session=stale; theme=dark' }),
      readCookies: async () => [
        { name: 'session', value: 'api-secret', domain: 'pt.example', path: '/', secure: true },
        { name: 'uid', value: '42', domain: 'pt.example', path: '/', secure: true },
      ],
    }));

    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready result');
    expect(result.draft.cookie).toBe('session=api-secret; uid=42; theme=dark');
  });

  it('keeps the site editable when the Chrome Cookie API fails', async () => {
    const result = await collectSiteDraft(deps({
      readSnapshot: async () => ({ ...nexusSnapshot(), documentCookie: 'session=page-secret' }),
      readCookies: async () => { throw new Error('Chrome cookie access denied'); },
    }));

    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready result');
    expect(result.draft.cookie).toBe('session=page-secret');
    expect(result.draft.fieldWarnings.cookie).toContain('Chrome 完整 Cookie');
  });

  it('extracts the mTorrent web token and UID while leaving the API token manual', async () => {
    const result = await collectSiteDraft(deps({
      getContext: async () => ({ tabId: 77, url: 'https://kp.m-team.cc/browse', origin: 'https://kp.m-team.cc', hasPermission: true }),
      readSnapshot: async () => ({
        ...nexusSnapshot(), url: 'https://kp.m-team.cc/browse', origin: 'https://kp.m-team.cc', host: 'kp.m-team.cc', meta: [],
        links: [{ text: '用户', href: 'https://kp.m-team.cc/profile/detail/295964' }],
        storage: [
          { area: 'local', key: 'auth', value: 'web-login-token' },
          { area: 'local', key: 'did', value: 'device-id' },
          { area: 'local', key: 'visitorId', value: 'visitor-id' },
        ],
      }),
      readCookies: async (_url, tabId) => {
        expect(tabId).toBe(77);
        return [
          { name: 'session', value: 'm-team-secret', domain: '.m-team.cc', path: '/', secure: true },
          { name: 'x-api-key', value: 'must-not-auto-fill', domain: '.m-team.cc', path: '/', secure: true },
        ];
      },
    }));
    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready result');
    expect(result.draft).toMatchObject({
      architecture: 'mtorrent',
      cookie: '',
      webToken: 'web-login-token',
      webDeviceId: 'device-id',
      webVisitorId: 'visitor-id',
      passkey: '295964',
      token: null,
    });
    expect(result.draft.fieldWarnings.token).toContain('控制台实验室');
    expect(result.draft.fieldWarnings.cookie).toBeUndefined();
  });

  it('keeps an unrecognized site editable with the collected page data', async () => {
    const result = await collectSiteDraft(deps({
      readSnapshot: async () => ({ ...nexusSnapshot(), meta: [], links: [], textSample: '' }),
    }));

    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected editable ready result');
    expect(result.detection).toMatchObject({ id: 'unknown', supported: false });
    expect(result.draft).toMatchObject({
      architecture: 'unknown',
      scheme: null,
      name: 'Fixture PT',
      address: 'https://pt.example',
      cookie: 'session=secret',
      userAgent: 'Browser UA',
      pages: [],
    });
  });

  it('identifies page-probe failures without exposing the underlying error', async () => {
    const result = await collectSiteDraft(deps({ readSnapshot: async () => { throw new Error('private-secret'); } }));
    expect(result).toEqual({ state: 'error', message: '页面数据读取失败（E_PAGE），请刷新站点页面后重试' });
    expect(JSON.stringify(result)).not.toContain('private-secret');
  });
});
