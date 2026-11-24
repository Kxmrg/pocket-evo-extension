// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { CollectionResult } from '../application/collect-site';
import type { SiteDraft } from '../domain/adapt-site';
import type { PageSnapshot } from '../domain/types';
import { createPopupController, type PopupServices } from './controller';
import type { PopupActions, PopupState, PopupView } from './state';

const origin = 'https://pt.example';
const url = `${origin}/torrents.php`;

function fixture(): SiteDraft {
  return {
    architecture: 'nexusphp', scheme: 0, name: 'Example', address: origin, cookie: 'session=fixture',
    webToken: null, webDeviceId: null, webVisitorId: null,
    pages: [{ name: 'All', path: '/torrents.php', tags: null, selected: true }],
    passkey: null, userAgent: null, importUserAgent: false, tags: null, downloadTags: null,
    token: null, fieldWarnings: {}, alternatives: {},
  };
}

function snapshot(): PageSnapshot {
  return {
    url: `${url}?cat=2`, origin, host: 'pt.example', title: 'Example', userAgent: 'Fixture',
    meta: [], resources: [], links: [], textSample: '', storage: [], candidates: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function settle() {
  for (let turn = 0; turn < 8; turn++) await Promise.resolve();
}

function setup() {
  const services = {
    getActivePageContext: vi.fn<PopupServices['getActivePageContext']>().mockResolvedValue({
      tabId: 1, url, origin, hasPermission: true,
    }),
    collectSiteDraft: vi.fn<PopupServices['collectSiteDraft']>().mockImplementation(async () => ({
      state: 'ready', draft: fixture(),
      detection: { id: 'nexusphp', supported: true, confidence: 'certain', reasons: [] },
    })),
    readPageSnapshot: vi.fn<PopupServices['readPageSnapshot']>().mockResolvedValue(snapshot()),
    readCookies: vi.fn<PopupServices['readCookies']>().mockResolvedValue([]),
    requestCurrentOrigin: vi.fn<PopupServices['requestCurrentOrigin']>().mockResolvedValue(true),
    openFullscreenQr: vi.fn<PopupServices['openFullscreenQr']>().mockResolvedValue(undefined),
  };
  let state!: PopupState;
  let actions!: PopupActions;
  const view = {
    render: vi.fn<PopupView['render']>().mockImplementation((next, callbacks) => {
      state = next;
      actions = callbacks;
    }),
    drawQr: vi.fn<PopupView['drawQr']>().mockResolvedValue(undefined),
    confirmRefresh: vi.fn<PopupView['confirmRefresh']>().mockResolvedValue(false),
    focusPage: vi.fn<PopupView['focusPage']>(),
    dispose: vi.fn<PopupView['dispose']>(),
  };
  const controller = createPopupController(services, view);
  controller.start();
  return {
    services, view, controller,
    get state() { return state; },
    get actions() { return actions; },
    async read() { actions.onRead(); await settle(); },
  };
}

describe('popup controller', () => {
  it('starts idle and ignores stale collection after a newer read', async () => {
    const popup = setup();
    expect(popup.state).toEqual({ kind: 'idle' });
    expect(popup.services.getActivePageContext).not.toHaveBeenCalled();
    const previous = deferred<CollectionResult>();
    popup.services.collectSiteDraft.mockReturnValueOnce(previous.promise);
    await popup.read();
    popup.actions.onRefresh(); await settle();
    previous.resolve({ state: 'error', issue: { code: 'contextReadFailed' } }); await settle();
    expect(popup.state).toMatchObject({ kind: 'ready', sourceOrigin: origin });
  });

  it('coalesces confirmation and preserves edits and current-page work on cancel', async () => {
    const popup = setup(); await popup.read();
    popup.actions.onFieldChange('address', 'https://alternate.example');
    const page = deferred<PageSnapshot>();
    const cancel = deferred<boolean>();
    popup.services.readPageSnapshot.mockReturnValueOnce(page.promise);
    popup.view.confirmRefresh.mockReturnValueOnce(cancel.promise);
    popup.actions.onPageAddCurrent(); await settle();
    popup.actions.onRefresh();
    popup.actions.onRefresh();
    expect(popup.view.confirmRefresh).toHaveBeenCalledTimes(1);
    expect(popup.services.collectSiteDraft).toHaveBeenCalledTimes(1);
    cancel.resolve(false); await settle();
    page.resolve(snapshot()); await settle();
    expect(popup.state).toMatchObject({
      kind: 'ready', sourceOrigin: origin, dirty: true,
      draft: { address: 'https://alternate.example', pages: [{ name: 'All' }, { path: '/torrents.php?cat=2' }] },
    });
    expect(popup.view.focusPage).toHaveBeenCalledWith(1);
  });

  it('invalidates an in-flight page read only when discard is confirmed', async () => {
    const popup = setup(); await popup.read();
    popup.actions.onFieldChange('name', 'Edited');
    const page = deferred<PageSnapshot>();
    const confirm = deferred<boolean>();
    popup.services.readPageSnapshot.mockReturnValueOnce(page.promise);
    popup.view.confirmRefresh.mockReturnValueOnce(confirm.promise);
    popup.actions.onPageAddCurrent(); await settle();
    popup.actions.onRefresh(); await settle();
    expect(popup.state).toMatchObject({ kind: 'ready', addingPage: true, draft: { name: 'Edited' } });
    confirm.resolve(true); await settle();
    page.resolve(snapshot()); await settle();
    expect(popup.services.collectSiteDraft).toHaveBeenCalledTimes(2);
    expect(popup.state).toMatchObject({ kind: 'ready', draft: { name: 'Example', pages: [{ name: 'All' }] } });
    expect(popup.view.focusPage).not.toHaveBeenCalled();
  });

  it('keeps a clean draft clean when revealing credentials and discards without confirmation', async () => {
    const popup = setup(); await popup.read();
    popup.actions.onFieldChange('name', 'Example');
    popup.actions.onToggleCredential('cookie');
    popup.actions.onRefresh(); await settle();
    expect(popup.view.confirmRefresh).not.toHaveBeenCalled();
    expect(popup.services.collectSiteDraft).toHaveBeenCalledTimes(2);
  });

  it('ignores confirmation completed after disposal', async () => {
    const popup = setup(); await popup.read();
    popup.actions.onFieldChange('name', 'Edited');
    const confirm = deferred<boolean>();
    popup.view.confirmRefresh.mockReturnValueOnce(confirm.promise);
    popup.actions.onRefresh();
    popup.controller.dispose();
    popup.controller.dispose();
    confirm.resolve(true); await settle();
    popup.actions.onRead(); await settle();
    expect(popup.services.collectSiteDraft).toHaveBeenCalledTimes(1);
    expect(popup.view.dispose).toHaveBeenCalledTimes(1);
  });

  it('ignores stale permission completion after a reread', async () => {
    const popup = setup();
    popup.services.collectSiteDraft.mockResolvedValueOnce({ state: 'permission-required', origin });
    await popup.read();
    const permission = deferred<boolean>();
    popup.services.requestCurrentOrigin.mockReturnValueOnce(permission.promise);
    popup.actions.onRequestPermission();
    popup.actions.onRequestPermission();
    expect(popup.services.requestCurrentOrigin).toHaveBeenCalledExactlyOnceWith(origin);
    popup.actions.onRetry(); await settle();
    permission.resolve(true); await settle();
    expect(popup.services.collectSiteDraft).toHaveBeenCalledTimes(2);
    expect(popup.state.kind).toBe('ready');
  });

  it.each([
    [() => Promise.resolve(false), 'permissionDenied'],
    [() => Promise.reject(new Error('Private gateway details')), 'permissionRequestFailed'],
  ])('shows a recoverable issue for an unsuccessful permission request', async (request, code) => {
    const popup = setup();
    popup.services.collectSiteDraft.mockResolvedValueOnce({ state: 'permission-required', origin });
    popup.services.requestCurrentOrigin.mockImplementationOnce(request);
    await popup.read();
    popup.actions.onRequestPermission(); await settle();
    expect(popup.state).toEqual({ kind: 'error', issue: { code } });
    popup.actions.onRetry(); await settle();
    expect(popup.state.kind).toBe('ready');
  });

  it('rereads the active page after a successful permission request', async () => {
    const popup = setup();
    popup.services.collectSiteDraft.mockResolvedValueOnce({ state: 'permission-required', origin });
    await popup.read();
    popup.actions.onRequestPermission(); await settle();
    expect(popup.services.requestCurrentOrigin).toHaveBeenCalledExactlyOnceWith(origin);
    expect(popup.services.getActivePageContext).toHaveBeenCalledTimes(2);
    expect(popup.state.kind).toBe('ready');
  });

  it('ignores stale QR drawing and fullscreen failures after returning and regenerating', async () => {
    const popup = setup(); await popup.read();
    const draw = deferred<void>();
    const fullscreen = deferred<void>();
    popup.view.drawQr.mockReturnValueOnce(draw.promise);
    popup.services.openFullscreenQr.mockReturnValueOnce(fullscreen.promise);
    popup.actions.onFieldChange('name', 'Edited');
    popup.actions.onToggleCredential('cookie');
    popup.actions.onGenerate();
    popup.actions.onFullscreen();
    popup.actions.onFullscreen();
    expect(popup.services.openFullscreenQr).toHaveBeenCalledTimes(1);
    expect(popup.view.drawQr).toHaveBeenCalledTimes(1);
    popup.actions.onBack();
    expect(popup.state).toMatchObject({ kind: 'ready', sourceOrigin: origin, dirty: true, revealed: new Set() });
    popup.actions.onGenerate();
    draw.reject(new Error('Obsolete draw'));
    fullscreen.reject(new Error('Obsolete fullscreen')); await settle();
    expect(popup.state).toMatchObject({ kind: 'qr', sourceOrigin: origin, dirty: true });
    expect(popup.state).not.toHaveProperty('error');
    expect(popup.view.drawQr).toHaveBeenCalledTimes(2);
    popup.actions.onRefresh(); await settle();
    expect(popup.view.confirmRefresh).toHaveBeenCalledTimes(1);
    expect(popup.state.kind).toBe('qr');
  });

  it('keeps a concurrent canvas failure visible when fullscreen succeeds', async () => {
    const popup = setup(); await popup.read();
    const draw = deferred<void>();
    const fullscreen = deferred<void>();
    popup.view.drawQr.mockReturnValueOnce(draw.promise);
    popup.services.openFullscreenQr.mockReturnValueOnce(fullscreen.promise);
    popup.actions.onGenerate();
    popup.actions.onFullscreen();
    draw.reject(new Error('Canvas unavailable')); await settle();
    fullscreen.resolve(undefined); await settle();
    expect(popup.state).toMatchObject({ kind: 'qr', error: { code: 'qrDrawFailed' }, openingFullscreen: false });
    expect(popup.view.drawQr).toHaveBeenCalledTimes(1);
    popup.actions.onFullscreen(); await settle();
    expect(popup.services.openFullscreenQr).toHaveBeenCalledTimes(1);
    expect(popup.state).toMatchObject({ kind: 'qr', error: { code: 'qrDrawFailed' } });
    popup.actions.onBack();
    expect(popup.state.kind).toBe('ready');
  });
});
