import { describe, expect, it } from 'vitest';
import { detectArchitecture } from './detect-architecture';
import { adaptSite } from './adapt-site';
import type { PageSnapshot } from './types';

describe('PANDA and HDKylin native NP imports', () => {
  it.each([
    ['https://pandapt.net/torrents.php', 'PANDA :: 种子 熊猫高清'],
    ['https://www.hdkyl.in/torrents.php', 'HDKylin - 麒麟 :: 种子 - Powered by NexusPHP'],
  ])('recognizes and preserves the origin of %s', (url, title) => {
    const parsed = new URL(url);
    const snapshot: PageSnapshot = {
      url, title, origin: parsed.origin, host: parsed.hostname,
      userAgent: 'Fixture UA', meta: [], resources: [], storage: [], candidates: [],
      textSample: 'Powered by NexusPHP',
      links: [
        {text:'综合区',href:`${parsed.origin}/torrents.php`},
        {text:'电影',href:`${parsed.origin}/torrents.php?cat=401`},
        {text:'详情',href:`${parsed.origin}/details.php?id=1`},
      ],
    };
    const detection = detectArchitecture(snapshot);
    expect(detection).toMatchObject({id:'nexusphp',supported:true});
    const draft=adaptSite({snapshot,detection,cookieHeader:'session=fixture'});
    expect(draft.address).toBe(parsed.origin);
    expect(draft.pages.some(p=>p.path==='/torrents.php')).toBe(true);
    expect(draft.cookie).toBe('session=fixture');
  });
});
