import type { PageSnapshot } from './types';

const EXCLUDED_LABELS = new Set([
  '综合', '全部', '所有', '不限', '全部种子', '所有分类', '全部资源',
  'all', 'browse', 'everything', 'anything', 'any', 'none', 'showall', 'show all',
  'categories', 'category',
]);

const QUERY_KEYS = /^(cat|category|categories|categoryid|catid|cid|f-cid)$/i;
const PATH_CATEGORY = /\/categories\/([^/?#]+)/i;

function hasCategorySignal(url: URL): boolean {
  for (const [key, value] of url.searchParams) {
    if (!value) continue;
    if (QUERY_KEYS.test(key)) return true;
    if (/^filter_cat/i.test(key)) return true;
  }
  return PATH_CATEGORY.test(url.pathname);
}

export function extractSiteCategories(snapshot: PageSnapshot): string[] {
  const categories: string[] = [];
  const seen = new Set<string>();
  for (const link of snapshot.links) {
    let url: URL;
    try {
      url = new URL(link.href, snapshot.url);
    } catch {
      continue;
    }
    if (url.origin !== snapshot.origin) continue;
    if (!hasCategorySignal(url)) continue;
    const label = (link.text || '').trim();
    if (!label) continue;
    if (EXCLUDED_LABELS.has(label.toLowerCase())) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    categories.push(label);
    if (categories.length >= 24) break;
  }
  return categories;
}
