import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageSnapshot } from '../domain/types';
import { issueText } from '../ui/issue-text';
import { inflateSync } from 'fflate';

const browser = vi.hoisted(() => ({
  context: vi.fn(), snapshot: vi.fn(), cookies: vi.fn(), fullscreen: vi.fn(), draw: vi.fn(), permission: vi.fn(),
}));
vi.mock('../browser/chrome-gateway', () => ({
  getActivePageContext: browser.context, readPageSnapshot: browser.snapshot,
  readCookies: browser.cookies, requestCurrentOrigin: browser.permission,
}));
vi.mock('../browser/fullscreen-qr', () => ({ openFullscreenQr: browser.fullscreen }));
vi.mock('qrcode', async importOriginal => {
  const actual = await importOriginal<typeof import('qrcode')>();
  return { ...actual, toCanvas: browser.draw, default: { ...actual, toCanvas: browser.draw } };
});

function snapshot(url='https://pt.example/torrents.php?cat=401'): PageSnapshot {
  const u=new URL(url);
  return {
    url, origin:u.origin, host:u.host, title:'Example', userAgent:'Fixture',
    meta:[{name:'generator',property:'',content:'NexusPHP'}],
    resources:[], links:[], textSample:'', storage:[], candidates:[],
  };
}
const settle = async () => { for(let i=0;i<12;i++) await Promise.resolve(); };
const click = (selector:string) => document.querySelector<HTMLButtonElement>(selector)!.click();
function type(selector:string, value:string) {
  const input=document.querySelector<HTMLInputElement>(selector)!;
  input.focus(); input.value=value; input.dispatchEvent(new Event('input',{bubbles:true}));
  return input;
}
async function boot() {
  await import('./main');
  click('[data-action="read"]'); await settle();
}
function generatedSite() {
  const text=browser.draw.mock.calls.at(-1)![1] as string;
  const encoded=new URL(text).searchParams.get('data')!;
  const bytes=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(inflateSync(bytes))).site;
}

const dialogPrototype = HTMLDialogElement.prototype;
const dialogShims = new Map<PropertyKey, PropertyDescriptor | undefined>();

beforeAll(() => {
  const shims = {
    showModal(this: HTMLDialogElement) { this.open = true; },
    close(this: HTMLDialogElement, returnValue?: string) {
      if (!this.open) return;
      this.open = false;
      if (returnValue !== undefined) this.returnValue = returnValue;
      queueMicrotask(() => this.dispatchEvent(new Event('close')));
    },
  };
  for (const key of ['showModal', 'close'] as const) {
    if (typeof dialogPrototype[key] === 'function') continue;
    dialogShims.set(key, Object.getOwnPropertyDescriptor(dialogPrototype, key));
    Object.defineProperty(dialogPrototype, key, { configurable: true, value: shims[key] });
  }
});

afterAll(() => {
  for (const [key, original] of dialogShims) {
    if (original) Object.defineProperty(dialogPrototype, key, original);
    else Reflect.deleteProperty(dialogPrototype, key);
  }
});

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN']);
  document.body.innerHTML='<main id="app"></main>';
  browser.context.mockResolvedValue({tabId:1,url:'https://pt.example/torrents.php',origin:'https://pt.example',hasPermission:true});
  browser.snapshot.mockResolvedValue(snapshot());
  browser.cookies.mockResolvedValue([{ name:'session', value:'fixture', domain:'pt.example', path:'/', secure:true }]);
  browser.draw.mockResolvedValue(undefined);
  browser.fullscreen.mockResolvedValue(undefined);
});

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  vi.restoreAllMocks();
});

describe('popup editing and async boundaries', () => {
  it('exports the latest typed fields without blur and keeps the input and caret alive', async () => {
    await boot();
    const input=type('#site-name','Edited');
    input.setSelectionRange(2,2);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(2);
    type('#download-tags','custom');
    click('[data-action="generate"]'); await settle();
    expect(generatedSite()).toMatchObject({name:'Edited',downloadTags:['custom']});
  });

  it('enables generation while a new page name is still focused', async () => {
    await boot(); click('[data-action="add-manual-page"]');
    expect(document.querySelector<HTMLButtonElement>('[data-action="generate"]')!.disabled).toBe(true);
    const name=type('#page-name-1','电影');
    expect(document.activeElement).toBe(name);
    expect(document.querySelector<HTMLButtonElement>('[data-action="generate"]')!.disabled).toBe(false);
    click('[data-action="generate"]'); await settle();
    expect(generatedSite().entries[1].name).toBe('电影');
  });

  it('commits edits from a change event without a preceding input event', async () => {
    await boot();
    const name = document.querySelector<HTMLInputElement>('#site-name')!;
    name.value = 'Autofilled';
    name.dispatchEvent(new Event('change', { bubbles: true }));
    click('[data-action="generate"]'); await settle();
    expect(generatedSite().name).toBe('Autofilled');
  });

  it('does not replace a Chinese composition when toggling another field', async () => {
    await boot(); const input=type('#site-name','中文');
    input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
    input.value='中文站点'; input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
    expect(document.activeElement).toBe(input);
    input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));
    click('[data-reveal="cookie"]');
    expect(document.querySelector<HTMLInputElement>('#site-name')!.value).toBe('中文站点');
    expect(document.querySelector('[data-reveal="cookie"]')!.getAttribute('aria-label')).toContain('隐藏');
  });

  it('drops an in-flight add-page result after the user refreshes the draft', async () => {
    await boot(); let finish!:(value:PageSnapshot)=>void;
    browser.snapshot.mockReturnValueOnce(new Promise<PageSnapshot>(resolve=>{finish=resolve;}));
    click('[data-action="add-current-page"]'); await settle();
    click('[data-action="refresh"]'); await settle();
    finish(snapshot()); await settle();
    expect(document.querySelectorAll('.page-row')).toHaveLength(1);
    expect(document.querySelector<HTMLInputElement>('#site-name')!.value).toBe('Example');
  });

  it('keeps the edited DOM and selected source on dialog cancellation', async () => {
    await boot();
    const name = type('#site-name', 'Edited');
    const refresh = document.querySelector<HTMLButtonElement>('[data-action="refresh"]')!;
    refresh.focus();
    refresh.click();
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')!;
    expect(dialog).toBeTruthy();
    expect(browser.context).toHaveBeenCalledTimes(1);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle();
    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(document.querySelector('#site-name')).toBe(name);
    expect(name.value).toBe('Edited');
    expect(document.activeElement).toBe(refresh);
    expect(document.querySelector('[data-site-context]')?.textContent).toContain('pt.example');
    expect(browser.context).toHaveBeenCalledTimes(1);
  });

  it('rereads only after the discard confirmation and replaces the edited draft', async () => {
    await boot();
    type('#site-name', 'Edited');
    browser.snapshot.mockResolvedValue({ ...snapshot(), title: 'Fresh site name' });
    click('[data-action="refresh"]');
    expect(browser.context).toHaveBeenCalledTimes(1);
    click('dialog[open] [data-action="confirm-refresh"]');
    await settle();
    expect(browser.context).toHaveBeenCalledTimes(2);
    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(document.querySelector<HTMLInputElement>('#site-name')!.value).toBe('Fresh site name');
  });

  it('rejects a snapshot that navigated away after the active-tab check', async () => {
    await boot(); browser.snapshot.mockResolvedValue(snapshot('https://other.example/torrents.php'));
    click('[data-action="add-current-page"]'); await settle();
    expect(document.querySelectorAll('.page-row')).toHaveLength(1);
    expect(document.querySelector('[data-page-action-error]')?.textContent).toBe(issueText({ code: 'pageChanged' }, 'zh'));
  });

  it('keeps add-page failures recoverable without invalidating a valid draft', async () => {
    await boot(); browser.snapshot.mockRejectedValue(new Error('Untrusted browser error'));
    click('[data-action="add-current-page"]'); await settle();
    expect(document.querySelector('[data-page-action-error]')?.textContent).toBeTruthy();
    expect(document.querySelector<HTMLButtonElement>('[data-action="generate"]')!.disabled).toBe(false);
    expect(document.body.textContent).not.toContain('Untrusted browser error');
  });

  it('prevents duplicate add-current requests and caps the list at fifty entries', async () => {
    await boot();
    for (let index = 0; index < 48; index++) click('[data-action="add-manual-page"]');
    let finish!:(value:PageSnapshot)=>void;
    browser.snapshot.mockReturnValueOnce(new Promise<PageSnapshot>(resolve=>{finish=resolve;}));
    click('[data-action="add-current-page"]'); click('[data-action="add-current-page"]'); await settle();
    expect(browser.snapshot).toHaveBeenCalledTimes(2);
    finish(snapshot()); await settle();
    expect(document.querySelectorAll('.page-row')).toHaveLength(50);
    expect(document.querySelector<HTMLButtonElement>('[data-action="add-current-page"]')!.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[data-action="add-manual-page"]')!.disabled).toBe(true);
  });

  it('lets CSS size the QR canvas while retaining its bitmap dimensions', async () => {
    await boot();
    browser.draw.mockImplementationOnce((canvas: HTMLCanvasElement) => {
      canvas.width = 512;
      canvas.height = 512;
      canvas.style.width = '512px';
      canvas.style.height = '512px';
      return Promise.resolve();
    });
    click('[data-action="generate"]'); await settle();
    const canvas = document.querySelector<HTMLCanvasElement>('#qr-canvas')!;
    expect(canvas).toBe(browser.draw.mock.calls[0]?.[0]);
    expect(canvas.width).toBe(512);
    expect(canvas.height).toBe(512);
    expect(canvas.style.width).toBe('');
    expect(canvas.style.height).toBe('');
  });

  it('keeps fullscreen opening failures visible and clears them after a successful retry', async () => {
    await boot(); click('[data-action="generate"]'); await settle();
    const canvas = document.querySelector('#qr-canvas');
    browser.fullscreen.mockRejectedValueOnce(new Error('storage unavailable'));
    click('[data-action="fullscreen"]'); await settle();
    expect(document.querySelector('[data-qr-error]')?.textContent).toBe(issueText({ code: 'fullscreenOpenFailed' }, 'zh'));
    expect(document.querySelector<HTMLButtonElement>('[data-action="fullscreen"]')!.disabled).toBe(false);
    click('[data-action="fullscreen"]'); await settle();
    expect(document.querySelector<HTMLElement>('[data-qr-error]')!.textContent).toBe('');
    expect(document.querySelector('#qr-canvas')).toBe(canvas);
    expect(browser.draw).toHaveBeenCalledTimes(1);
  });

  it('shows a QR drawing failure and allows returning to the original draft', async () => {
    await boot(); browser.draw.mockRejectedValueOnce(new Error('canvas unavailable'));
    click('[data-action="generate"]'); await settle();
    expect(document.querySelector('[data-qr-error]')?.textContent).toBe(issueText({ code: 'qrDrawFailed' }, 'zh'));
    click('[data-action="back"]'); await settle();
    expect(document.querySelector<HTMLInputElement>('#site-name')!.value).toBe('Example');
    expect(document.querySelector('[data-site-context]')?.textContent).toContain('pt.example');
  });

  it('retains keyboard focus when toggling a preset or revealing a credential', async () => {
    await boot();
    const tag=document.querySelector<HTMLButtonElement>('[data-tag-toggle="MOVIE"]')!;
    tag.focus(); tag.click();
    expect(document.activeElement).toBe(tag);
    expect(tag.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector<HTMLInputElement>('#site-tags')!.value).toBe('MOVIE');
    const reveal=document.querySelector<HTMLButtonElement>('[data-reveal="cookie"]')!;
    reveal.focus(); reveal.click();
    expect(document.activeElement).toBe(reveal);
    expect(reveal.getAttribute('aria-label')).toContain('隐藏');
  });

});

it('keeps Piggo credentials when editing the address through an incomplete host', async () => {
  const token = `a.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).replace(/=+$/, '')}.a`;
  const visitorId = 'a'.repeat(32);
  browser.snapshot.mockResolvedValue({
    ...snapshot('https://piggo.me/torrents'), pigVisitorId: visitorId,
    storage: [{ area: 'local', key: 'pig_token', value: token }],
  });
  browser.context.mockResolvedValue({ tabId: 1, url: 'https://piggo.me/torrents', origin: 'https://piggo.me', hasPermission: true });
  await boot();
  type('#site-address', 'https://piggo.m');
  expect(document.querySelector<HTMLButtonElement>('[data-action="generate"]')!.disabled).toBe(true);
  type('#site-address', 'https://piggo.me');
  expect(document.querySelector<HTMLButtonElement>('[data-action="generate"]')!.disabled).toBe(false);
  click('[data-action="generate"]'); await settle();
  expect(generatedSite().secrets).toEqual({ pigToken: token, pigVisitorId: visitorId });
});
