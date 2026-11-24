import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
function paletteFrom(block: string, base: Record<string, string> = {}): Record<string, string> {
  return {
    ...base,
    ...Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[\da-f]{3,6})\s*;/gi)].flatMap((match) => {
      const [, name, value] = match;
      return name && value ? [[name, value]] : [];
    })),
  };
}

function luminance(hex: string): number {
  const digits = hex.slice(1);
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits;
  const channel = (offset: number) => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return channel(0) * 0.2126 + channel(2) * 0.7152 + channel(4) * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

describe('shared Evo palette accessibility', () => {
  const styles = readFileSync('src/ui/tokens.css', 'utf8');
  const light=paletteFrom(styles),dark={...light};
  for(const match of styles.matchAll(/(--[\w-]+):\s*light-dark\((#[\da-f]+),\s*(#[\da-f]+)\)/gi)){
    light[match[1]!]=match[2]!;dark[match[1]!]=match[3]!;
  }
  for (const [theme, palette] of Object.entries({ light, dark })) {
    it(`keeps ${theme} form and button text readable`, () => {
      for(const [foreground,background] of [['--text','--surface'],['--muted','--surface'],['--muted','--bg'],['--on-soft','--soft'],['--danger','--surface'],['--on-primary','--primary']]){
        expect(contrast(palette[foreground!]!,palette[background!]!),`${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(palette['--focus']!,palette['--surface']!)).toBeGreaterThanOrEqual(3);
    });
  }
});
