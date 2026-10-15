import { describe, expect, it } from 'vitest';
import { validEntry } from './evo-entry';

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
