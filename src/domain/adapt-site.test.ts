import { describe, expect, it } from 'vitest';
import { detectArchitecture } from './detect-architecture';
import { adaptSite } from './adapt-site';
import type { ArchitectureId, DetectionResult, PageSnapshot } from './types';

function input(id: ArchitectureId, url: string, overrides: Partial<PageSnapshot> = {}, cookieHeader = 'session=secret') {
  const parsed = new URL(url);
  const detection: DetectionResult = { id, supported: true, confidence: 'certain', reasons: ['test'] };
  const snapshot: PageSnapshot = {
    url,
    origin: parsed.origin,
    host: parsed.hostname,
    title: 'Example PT - 首页',
    userAgent: 'Browser UA',
    meta: [],
    resources: [],
    links: [],
    textSample: '',
    storage: [],
    candidates: [],
    ...overrides,
  };
  return { detection, snapshot, cookieHeader };
}

describe('adaptSite', () => {
  it('maps NexusPHP directly to Flutter SiteConfig fields', () => {
    const draft = adaptSite(input('nexusphp', 'https://pt.example/torrents.php'));
    expect(draft).toMatchObject({
      architecture: 'nexusphp', scheme: 0, name: 'Example PT',
      address: 'https://pt.example', cookie: 'session=secret',
      token: null,
    });
    expect(draft.pages[0]?.path).toBe('/torrents.php');
  });

  it('keeps only the site brand from a decorated page title', () => {
    const draft = adaptSite(input('mtorrent', 'https://kp.m-team.cc/browse', {
      title: 'M-Team - TP :: 首頁 - Powered by mTorrent',
      links: [{ text: '我的资料', href: 'https://kp.m-team.cc/profile/detail/295964' }],
    }));
    expect(draft.name).toBe('M-Team');
  });

  it('maps TNode CSRF token and passkey', () => {
    const draft = adaptSite(input('tnode', 'https://zhuque.in/torrent/search', {
      title: '种子列表 - 种子 :: 朱雀 - ZHUQUE :: Powered By TNode',
      meta: [{ name: 'csrf-token', property: '', content: 'csrf-secret' }],
      links: [{ text: '下载', href: 'https://zhuque.in/api/torrent/download/7/pass-key' }],
    }));
    expect(draft).toMatchObject({ scheme: 1, name: 'ZhuQue', address: 'https://zhuque.in', cookie: 'session=secret', token: null, passkey: 'pass-key' });
  });

  it.each([
    ['https://kp.m-team.cc/browse', 'https://kp.m-team.cc'],
    ['https://zp.m-team.io/browse', 'https://zp.m-team.io'],
    ['https://api.m-team.cc/browse', 'https://kp.m-team.cc'],
  ])('normalizes M-Team address %s to %s', (url, address) => {
    const draft = adaptSite(input('mtorrent', url, {
      links: [{ text: '我的资料', href: `${new URL(url).origin}/profile/detail/295964` }],
      storage: [
        { area: 'local', key: 'auth', value: 'web-login-token' },
        { area: 'local', key: 'did', value: 'device-id' },
        { area: 'local', key: 'visitorId', value: 'visitor-id' },
      ],
    }));
    expect(draft).toMatchObject({
      scheme: 2,
      address,
      cookie: '',
      webToken: 'web-login-token',
      webDeviceId: 'device-id',
      webVisitorId: 'visitor-id',
      passkey: '295964',
      token: null,
    });
    expect(draft.fieldWarnings.token).toBe('请前往控制台实验室复制令牌并手动填写');
  });

  it('auto-fills site tags from categories and download tags from the site name', () => {
    const draft = adaptSite(input('nexusphp', 'https://pt.example/torrents.php', {
      title: 'Example PT - 首页',
      links: [
        { text: '综合', href: 'https://pt.example/torrents.php' },
        { text: '电影', href: 'https://pt.example/torrents.php?cat=401' },
        { text: '电视剧', href: 'https://pt.example/torrents.php?cat=402' },
      ],
    }));
    expect(draft.tags).toBe('MOVIE,TV');
    expect(draft.downloadTags).toBe('Example PT');
  });

  it('marks required special credentials when extraction fails', () => {
    const draft = adaptSite(input('mtorrent', 'https://kp.m-team.cc/browse'));
    expect(draft.fieldWarnings).toMatchObject({
      passkey: '未自动获取 UID',
      webToken: '未自动获取 Auth（可选）',
      webDeviceId: '未自动获取 DID（可选）',
      webVisitorId: '未自动获取 VID（可选）',
      token: '请前往控制台实验室复制令牌并手动填写',
    });
  });
});

for (const zone of ['cc', 'io']) {
  it(`extracts mobile MT ${zone} credentials without losing web origin`, () => {
    const source = input('mtorrent', `https://h5.m-team.${zone}/index#/home`, {
      storage: [
        {area:'local',key:'auth_token',value:'mobile-auth'},
        {area:'local',key:'device_id',value:'mobile-did'},
        {area:'local',key:'visitor_id',value:'mobile-vid'},
        {area:'local',key:'user_data',value:JSON.stringify({id: '42', username: 'sample'})},
      ],
    });
    expect(detectArchitecture(source.snapshot).id).toBe('mtorrent');
    expect(adaptSite(source)).toMatchObject({address:`https://h5.m-team.${zone}`,
      passkey:'42',webToken:'mobile-auth',webDeviceId:'mobile-did',webVisitorId:'mobile-vid',cookie:''});
    expect(adaptSite(source).pages[0]?.path).toBe('/browse');
  });
}
