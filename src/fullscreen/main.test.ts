import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toCanvas = vi.hoisted(() => vi.fn());
vi.mock('qrcode', () => ({ default: { toCanvas } }));

const payload = 'pocket-evo://import/site?v=1&data=private-fixture';
const siteName = '<img src=x onerror="alert(1)">';

function stubSession(get = async () => ({
  'fullscreenQr:fixture': { text: payload, siteName, expiresAt: Date.now() + 60_000 },
})) {
  const session = { get: vi.fn(get), remove: vi.fn(async () => undefined) };
  vi.stubGlobal('chrome', { storage: { session } });
  return session;
}

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
  toCanvas.mockReset().mockResolvedValue(undefined);
  document.body.innerHTML = '<main id="fullscreen-app"></main>';
  window.location.hash = '#fixture';
});

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fullscreen QR page', () => {
  it('consumes once and displays the site name as text with a localized privacy note', async () => {
    const { get, remove } = stubSession();
    await import('./main');
    await vi.waitFor(() => expect(document.querySelector('#fullscreen-qr')).not.toBeNull());

    expect(get).toHaveBeenCalledExactlyOnceWith('fullscreenQr:fixture');
    expect(remove).toHaveBeenCalledExactlyOnceWith('fullscreenQr:fixture');
    expect(document.querySelector('.fullscreen-site strong')?.textContent).toBe(siteName);
    expect(document.querySelector('.fullscreen-site img')).toBeNull();
    expect(document.querySelector('.privacy')?.textContent).toContain('login credentials');
    expect(document.body.innerHTML).not.toContain(payload);
    expect(document.querySelector('#fullscreen-qr')?.getAttribute('aria-label')).toBe('Pocket Evo site import QR code');
    expect(toCanvas).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), payload, expect.objectContaining({
      errorCorrectionLevel: 'L',
      margin: 4,
      color: { dark: '#17233a', light: '#fff' },
    }));
  });

  it('localizes a session read failure without exposing the underlying error', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['zh-CN']);
    stubSession(async () => { throw new Error('private-cookie-value'); });
    await import('./main');
    await vi.waitFor(() => expect(document.querySelector('.fullscreen-error h1')?.textContent).toBe('二维码暂时无法显示'));
    expect(document.querySelector('.fullscreen-error p')?.textContent).toBe('请在扩展中重新打开全屏。');
    expect(document.querySelector('.fullscreen-error .astronaut')).not.toBeNull();
    expect(document.body.textContent).not.toContain('private-cookie-value');
    expect(document.documentElement.lang).toBe('zh');
  });

  it('shows an expired transfer with localized recovery and disposes its illustration', async () => {
    const destroy = vi.fn();
    vi.stubGlobal('lottie', { loadAnimation: () => ({
      play: () => undefined, pause: () => undefined, goToAndStop: () => undefined,
      addEventListener: () => undefined, removeEventListener: () => undefined, destroy,
    }) });
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['fr-FR']);
    stubSession(async () => ({
      'fullscreenQr:fixture': { text: payload, siteName, expiresAt: Date.now() - 1 },
    }));
    await import('./main');
    await vi.waitFor(() => expect(document.querySelector('.fullscreen-error h1')?.textContent).toBe('Ce code QR a expiré'));
    expect(document.querySelector('.fullscreen-error .astronaut')).not.toBeNull();
    expect(toCanvas).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('pagehide'));
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('replaces a failed draw with the localized recovery view', async () => {
    stubSession();
    toCanvas.mockRejectedValue(new Error('secret render failure'));
    await import('./main');
    await vi.waitFor(() => expect(document.querySelector('.fullscreen-error h1')?.textContent).toBe('QR code is unavailable'));
    expect(document.querySelector('canvas')).toBeNull();
    expect(document.body.textContent).not.toContain('secret');
    expect(document.body.textContent).not.toContain(siteName);
  });

  it('ignores stale draw errors after a newer resize succeeds', async () => {
    const { get } = stubSession();
    let rejectInitial!: (cause: Error) => void;
    toCanvas.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectInitial = reject; }));
    await import('./main');
    await vi.waitFor(() => expect(toCanvas).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event('resize'));
    await vi.waitFor(() => expect(document.querySelector('canvas')).not.toBeNull());
    rejectInitial(new Error('stale draw'));
    await new Promise(resolve => window.setTimeout(resolve, 0));

    expect(document.querySelector('.fullscreen-error')).toBeNull();
    expect(toCanvas).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('does not mount a pending draw or run queued resizes after pagehide', async () => {
    stubSession();
    let finishDraw!: () => void;
    toCanvas.mockImplementationOnce(() => new Promise<void>(resolve => { finishDraw = resolve; }));
    await import('./main');
    await vi.waitFor(() => expect(toCanvas).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('pagehide'));
    finishDraw();
    window.dispatchEvent(new Event('resize'));
    await new Promise(resolve => window.setTimeout(resolve, 120));

    expect(document.querySelector('canvas')).toBeNull();
    expect(toCanvas).toHaveBeenCalledTimes(1);
  });
});
