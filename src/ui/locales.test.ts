import { describe, expect, it } from 'vitest';
import { createText, dictionaries, resolveLocale } from './locales';

describe('extension locale', () => {
  it.each([
    [['de-DE', 'en-US'], 'de'],
    [['ZH-Hant'], 'zh'],
    [['fr-CA'], 'fr'],
    [['es-419'], 'es'],
    [['ja', 'zh'], 'en'],
    [[], 'en'],
  ] as const)('chooses only the first device language from %j', (languages, locale) => {
    expect(resolveLocale(languages)).toBe(locale);
  });

  it('provides the same messages and placeholders in every locale', () => {
    const keys = Object.keys(dictionaries.en).sort();
    const placeholders = (message: string) => [...message.matchAll(/\{(\w+)\}/g)]
      .map((match) => match[1]).sort();
    for (const messages of Object.values(dictionaries)) {
      expect(Object.keys(messages).sort()).toEqual(keys);
      for (const key of Object.keys(dictionaries.en) as (keyof typeof dictionaries.en)[]) {
        expect(messages[key].trim()).not.toBe('');
        expect(placeholders(messages[key])).toEqual(placeholders(dictionaries.en[key]));
      }
    }
  });

  it('formats complete messages and preserves supplied values as literal text', () => {
    expect(createText('en')('pageCount', { count: 0, limit: 50 })).toBe('0 / 50');
    expect(createText('zh')('pageIssue', { index: 2, reason: '错误 {index}' }))
      .toBe('第 2 页：错误 {index}');
  });
});
