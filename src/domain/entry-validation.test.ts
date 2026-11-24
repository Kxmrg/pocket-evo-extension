import { describe, expect, it } from 'vitest';
import { safeEntryPath, validEntry } from './evo-entry';

describe('API entry limits match Evo importer', () => {
  for (const [architecture, path, key] of [
    ['haidan', '/torrents.php', 'cat'],
    ['sunnypt', '/torrents', 'category'],
  ] as const) {
    it(`${architecture} rejects duplicate and oversized values`, () => {
      expect(validEntry(architecture, `${path}?${key}=1&${key}=2`)).toBe(false);
      expect(validEntry(architecture, `${path}?${key}=${'a'.repeat(1025)}`)).toBe(false);
      expect(validEntry(architecture, `${path}?${key}=${'a'.repeat(1024)}`)).toBe(true);
      expect(validEntry(architecture, path)).toBe(true);
    });
  }
});

it('rejects even an empty fragment because Evo forbids entry fragments', () => {
 expect(safeEntryPath('/torrents.php#')).toBe(false);
 expect(validEntry('nexusphp', '/torrents.php#')).toBe(false);
});

it('rejects MT category numbers outside the Evo integer range', () => {
 expect(validEntry('mtorrent', '/browse?cat=9223372036854775808')).toBe(false);
 expect(validEntry('mtorrent', '/browse?cat=9223372036854775807')).toBe(true);
});
