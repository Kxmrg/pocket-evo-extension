export const SITE_TAGS = ['MOVIE', 'TV', 'MUSIC', 'GAME', 'AUDIO', '9KG', 'BOOK', 'COMICS', 'DOCUMENTARY', 'CARTOON', 'VARIETY SHOW', 'MV', 'MAC', 'SPORTS', 'SOFTWARE'] as const;

const TAG_KEYWORDS: Array<{ tag: string; keywords: string[] }> = [
  { tag: 'MOVIE', keywords: ['电影', '影片'] },
  { tag: 'TV', keywords: ['电视剧', '剧集'] },
  { tag: 'MUSIC', keywords: ['音乐'] },
  { tag: 'GAME', keywords: ['游戏'] },
  { tag: 'AUDIO', keywords: ['有声书', '有声'] },
  { tag: '9KG', keywords: ['成人', '色情'] },
  { tag: 'BOOK', keywords: ['电子书', '书籍', '图书'] },
  { tag: 'COMICS', keywords: ['动漫', '漫画'] },
  { tag: 'DOCUMENTARY', keywords: ['纪录片', '纪录'] },
  { tag: 'CARTOON', keywords: ['动画'] },
  { tag: 'VARIETY SHOW', keywords: ['综艺'] },
  { tag: 'MV', keywords: ['MV'] },
  { tag: 'MAC', keywords: ['MAC', 'Mac'] },
  { tag: 'SPORTS', keywords: ['体育', '运动'] },
  { tag: 'SOFTWARE', keywords: ['软件', '软体'] },
];

export function mapCategoriesToTags(categories: string[]): string[] {
  const matched = new Set<string>();
  for (const category of categories) {
    const text = category.trim();
    if (!text) continue;
    for (const { tag, keywords } of TAG_KEYWORDS) {
      if (keywords.some((keyword) => text.includes(keyword))) matched.add(tag);
    }
  }
  return SITE_TAGS.filter((tag) => matched.has(tag));
}
