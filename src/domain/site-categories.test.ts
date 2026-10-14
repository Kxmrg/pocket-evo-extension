import { describe, expect, it } from 'vitest';
import { extractSiteCategories } from './site-categories';
import type { PageSnapshot } from './types';

function snapshot(links: Array<{ text: string; href: string }>, url = 'https://pt.example/torrents.php'): PageSnapshot {
  const parsed = new URL(url);
  return {
    url,
    origin: parsed.origin,
    host: parsed.hostname,
    title: '',
    userAgent: '',
    meta: [],
    resources: [],
    links,
    textSample: '',
    storage: [],
    candidates: [],
  };
}

describe('extractSiteCategories', () => {
  it('reads NexusPHP category navigation links', () => {
    const categories = extractSiteCategories(snapshot([
      { text: '综合', href: 'https://pt.example/torrents.php' },
      { text: '电影', href: 'https://pt.example/torrents.php?cat=401' },
      { text: '电视剧', href: 'https://pt.example/torrents.php?cat=402' },
      { text: '我的资料', href: 'https://pt.example/userdetails.php?id=42' },
    ]));
    expect(categories).toEqual(['电影', '电视剧']);
  });

  it('reads UNIT3D categoryId, path categories and GazellePW filter_cat', () => {
    const categories = extractSiteCategories(snapshot([
      { text: 'Movies', href: 'https://pt.example/torrents?categoryId=1' },
      { text: 'TV', href: 'https://pt.example/categories/2' },
      { text: 'Music', href: 'https://pt.example/torrents?filter_cat[3]=1' },
    ], 'https://pt.example/torrents'));
    expect(categories).toEqual(['Movies', 'TV', 'Music']);
  });

  it('ignores non-category and excluded catch-all links', () => {
    const categories = extractSiteCategories(snapshot([
      { text: 'All', href: 'https://pt.example/torrents?category=all' },
      { text: '全部', href: 'https://pt.example/torrents?cat=0' },
      { text: '下载', href: 'https://pt.example/download.php?id=7' },
    ]));
    expect(categories).toEqual([]);
  });

  it('drops duplicates and cross-origin links', () => {
    const categories = extractSiteCategories(snapshot([
      { text: '电影', href: 'https://pt.example/torrents.php?cat=401' },
      { text: '电影', href: 'https://pt.example/torrents.php?cat=401&page=2' },
      { text: 'External', href: 'https://other.example/torrents.php?cat=9' },
    ]));
    expect(categories).toEqual(['电影']);
  });
});
