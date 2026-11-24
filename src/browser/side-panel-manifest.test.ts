import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface ExtensionManifest {
  name?: string;
  description?: string;
  default_locale?: string;
  version?: string;
  minimum_chrome_version?: string;
  permissions?: string[];
  host_permissions?: string[];
  optional_host_permissions?: string[];
  action?: { default_popup?: string; default_title?: string };
  side_panel?: { default_path?: string };
  background?: { service_worker?: string; type?: string };
}

describe('side panel manifest', () => {
  it('uses the product name consistently in Chrome', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as ExtensionManifest;

    expect(manifest.default_locale).toBe('en');
    for (const locale of ['en', 'zh_CN', 'fr', 'de', 'es']) {
      const messages = JSON.parse(readFileSync(`public/_locales/${locale}/messages.json`, 'utf8'));
      for (const value of [manifest.name, manifest.description, manifest.action?.default_title]) {
        const key = value?.match(/^__MSG_(\w+)__$/)?.[1];
        expect(key).toBeTruthy();
        expect(messages[key!]?.message).toContain('Pocket Evo');
      }
    }
  });

  it('keeps the extension and package versions aligned', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as ExtensionManifest;

    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    expect(manifest.version).toBe(packageJson.version);
    expect(lock.version).toBe(packageJson.version);
    expect(lock.packages[''].version).toBe(packageJson.version);
  });

  it('opens a global side panel from the toolbar action instead of a transient popup', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as ExtensionManifest;

    expect(manifest.permissions).toContain('sidePanel');
    expect(manifest.action?.default_popup).toBeUndefined();
    expect(manifest.side_panel?.default_path).toBe('popup.html');
    expect(manifest.background).toEqual({ service_worker: 'assets/background.js', type: 'module' });
  });

  it('uses persistent tab and host permissions required by the side panel Cookie flow', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as ExtensionManifest;

    expect(manifest.permissions).toEqual(expect.arrayContaining(['tabs', 'cookies', 'scripting', 'sidePanel', 'storage']));
    expect(manifest.permissions).not.toContain('activeTab');
    expect(manifest.host_permissions).toEqual(['http://*/*', 'https://*/*']);
    expect(manifest.optional_host_permissions).toBeUndefined();
  });

  it('requires the Chrome version that can resolve the active frame partition key', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as ExtensionManifest;

    expect(manifest.minimum_chrome_version).toBe('132');
  });
});
