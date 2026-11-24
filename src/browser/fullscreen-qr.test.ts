import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumeFullscreenQr, openFullscreenQr, type FullscreenQrSession } from './fullscreen-qr';

const session: FullscreenQrSession = {
  text: 'pocket-evo://import/site?v=1&data=secret',
  siteName: 'Example PT',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fullscreen QR transfer', () => {
  it('stores the QR in memory and opens only an opaque id in a new tab', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue(undefined);

    await openFullscreenQr(session, {
      createId: () => 'transfer-123',
      set,
      remove: vi.fn(),
      open,
      getUrl: (path) => `chrome-extension://fixture/${path}`,
    });

    expect(set).toHaveBeenCalledWith('fullscreenQr:transfer-123', expect.objectContaining(session));
    expect(open).toHaveBeenCalledWith('chrome-extension://fixture/fullscreen.html#transfer-123');
    expect(open.mock.calls[0]?.[0]).not.toContain('secret');
  });

  it('consumes and removes the in-memory QR data', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const result = await consumeFullscreenQr('#transfer-123', {
      get: vi.fn().mockResolvedValue({ ...session, expiresAt: Date.now() + 60_000 }),
      remove,
    });

    expect(result).toEqual(session);
    expect(remove).toHaveBeenCalledWith('fullscreenQr:transfer-123');
  });

  it('rejects an expired transfer and removes its credentials', async () => {
    const pending = new Map<string, unknown>([['fullscreenQr:expired', { ...session, expiresAt: 1 }]]);
    const result = await consumeFullscreenQr('#expired', {
      get: async (key) => pending.get(key),
      remove: async (key) => { pending.delete(key); },
    });
    expect(result).toBeNull();
    expect(pending.size).toBe(0);
  });

  it('cleans abandoned expired transfers while preserving fresh transfers and unrelated storage', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const stored: Record<string, unknown> = {
      'fullscreenQr:abandoned': { ...session, expiresAt: 999_999 },
      'fullscreenQr:fresh': { ...session, expiresAt: 1_100_000 },
      preference: 'dark',
    };
    vi.stubGlobal('chrome', {
      storage: { session: {
        get: async () => ({ ...stored }),
        set: async (items: Record<string, unknown>) => { Object.assign(stored, items); },
        remove: async (keys: string | string[]) => { for (const key of [keys].flat()) delete stored[key]; },
      } },
      runtime: { getURL: (path: string) => `chrome-extension://fixture/${path}` },
      tabs: { create: async () => ({ id: 42 }) },
    });

    await openFullscreenQr(session);

    expect(stored['fullscreenQr:abandoned']).toBeUndefined();
    expect(stored['fullscreenQr:fresh']).toBeDefined();
    expect(stored.preference).toBe('dark');
    const added = Object.entries(stored).find(([key]) => key.startsWith('fullscreenQr:') && key !== 'fullscreenQr:fresh');
    expect(added?.[1]).toMatchObject({ ...session, expiresAt: expect.any(Number) });
    if (!added) throw new Error('expected a new fullscreen transfer');
    await expect(consumeFullscreenQr(`#${added[0].slice('fullscreenQr:'.length)}`)).resolves.toEqual(session);
    expect(stored[added[0]]).toBeUndefined();
  });
});
