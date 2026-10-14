import { describe, expect, it } from 'vitest';
import { SITE_TAGS, mapCategoriesToTags } from './site-tags';

describe('mapCategoriesToTags', () => {
  it('exposes the built-in standard tags', () => {
    expect(SITE_TAGS).toEqual(['MOVIE', 'TV', 'MUSIC', 'GAME', 'AUDIO', '9KG', 'BOOK', 'COMICS', 'DOCUMENTARY', 'CARTOON', 'VARIETY SHOW', 'MV', 'MAC', 'SPORTS', 'SOFTWARE']);
  });

  it('maps each Chinese category to its standard tag', () => {
    expect(mapCategoriesToTags(['电影'])).toEqual(['MOVIE']);
    expect(mapCategoriesToTags(['影片'])).toEqual(['MOVIE']);
    expect(mapCategoriesToTags(['电视剧'])).toEqual(['TV']);
    expect(mapCategoriesToTags(['剧集'])).toEqual(['TV']);
    expect(mapCategoriesToTags(['音乐'])).toEqual(['MUSIC']);
    expect(mapCategoriesToTags(['游戏'])).toEqual(['GAME']);
    expect(mapCategoriesToTags(['有声书'])).toEqual(['AUDIO']);
    expect(mapCategoriesToTags(['成人'])).toEqual(['9KG']);
    expect(mapCategoriesToTags(['电子书'])).toEqual(['BOOK']);
    expect(mapCategoriesToTags(['书籍'])).toEqual(['BOOK']);
    expect(mapCategoriesToTags(['动画'])).toEqual(['CARTOON']);
    expect(mapCategoriesToTags(['动漫'])).toEqual(['COMICS']);
    expect(mapCategoriesToTags(['漫画'])).toEqual(['COMICS']);
    expect(mapCategoriesToTags(['纪录片'])).toEqual(['DOCUMENTARY']);
    expect(mapCategoriesToTags(['综艺'])).toEqual(['VARIETY SHOW']);
    expect(mapCategoriesToTags(['MV'])).toEqual(['MV']);
    expect(mapCategoriesToTags(['MAC'])).toEqual(['MAC']);
    expect(mapCategoriesToTags(['Mac'])).toEqual(['MAC']);
    expect(mapCategoriesToTags(['体育'])).toEqual(['SPORTS']);
    expect(mapCategoriesToTags(['软件'])).toEqual(['SOFTWARE']);
    expect(mapCategoriesToTags(['动画片'])).toEqual(['CARTOON']);
  });

  it('keeps SITE_TAGS order and dedupes across categories', () => {
    expect(mapCategoriesToTags(['剧集', '电影', '影片'])).toEqual(['MOVIE', 'TV']);
    expect(mapCategoriesToTags(['音乐', '游戏', '音乐'])).toEqual(['MUSIC', 'GAME']);
  });

  it('ignores unknown or empty categories', () => {
    expect(mapCategoriesToTags(['其他', '未分类', ''])).toEqual([]);
    expect(mapCategoriesToTags([])).toEqual([]);
  });
});
