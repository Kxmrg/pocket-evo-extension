import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteDraft } from '../domain/adapt-site';
import { createPopupView } from './view';
import type { PopupActions, PopupState, PopupView } from './state';
import { createText, type Locale } from '../ui/locales';

function draft(overrides: Partial<SiteDraft> = {}): SiteDraft {
  return {
    architecture: 'nexusphp', scheme: 0, name: 'Example PT', address: 'https://pt.example',
    cookie: 'session=secret',
    webToken: null,
    webDeviceId: null,
    webVisitorId: null,
    pages: [
      { name: '综合', path: '/torrents.php', tags: null, selected: true },
      { name: '电影', path: '/torrents.php?cat=401', tags: null, selected: true },
    ],
    passkey: null, userAgent: 'Browser UA', importUserAgent: true, tags: null, downloadTags: null,
    token: null,   fieldWarnings: {}, alternatives: {},
    ...overrides,
  };
}

function actions(): PopupActions {
  return {
    onRead: vi.fn(), onRefresh: vi.fn(), onRequestPermission: vi.fn(), onRetry: vi.fn(), onArchitectureChange: vi.fn(),
    onFieldChange: vi.fn(), onToggleCredential: vi.fn(),
    onTagToggle: vi.fn(),
    onPageChange: vi.fn(), onPageRemove: vi.fn(), onPageAddCurrent: vi.fn(), onPageAddManual: vi.fn(),
    onGenerate: vi.fn(), onFullscreen: vi.fn(), onBack: vi.fn(),
  };
}

let root: HTMLElement;
let view: PopupView;
let handlers: PopupActions;
const ready = (overrides: Partial<Extract<PopupState,{kind:'ready'}>> = {}): Extract<PopupState,{kind:'ready'}> => ({kind:'ready',draft:draft(),errors:{},revealed:new Set(),...overrides});
const input = (id:string) => root.querySelector<HTMLInputElement>(`#${id}`)!;
const click = (selector:string) => root.querySelector<HTMLButtonElement>(selector)!.click();
beforeEach(() => {
  document.body.innerHTML='<main id="app"></main>';
  root=document.querySelector('#app')!;view=createPopupView(root,'zh');handlers=actions();
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}));
  if(!HTMLDialogElement.prototype.showModal)HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
});
afterEach(()=>{view.dispose();vi.useRealTimers();vi.unstubAllGlobals();});

describe('production view interactions',()=>{
  it('requires explicit read and has one concise three-step guide',()=>{
    view.render({kind:'idle'},handlers);
    expect(root.querySelector('#site-form')).toBeNull();
    expect(root.querySelectorAll('.guide li')).toHaveLength(3);
    expect(root.querySelector<HTMLImageElement>('.brand img')?.getAttribute('src')).toBe('/branding/ring-a.png');
    click('[data-action=read]');expect(handlers.onRead).toHaveBeenCalledOnce();
    expect([...root.querySelectorAll('.resource-links a')].every(a=>a.getAttribute('rel')==='noreferrer')).toBe(true);
  });
  it('keeps category actions below the title, advanced fields expanded, and no default tags',()=>{
    view.render(ready(),handlers);
    const section=root.querySelector('#pages')!;
    expect(section.children[0]!.textContent).toContain('分类页面');
    expect(section.children[1]!.className).toBe('page-actions');
    expect(root.querySelector('details')).toBeNull();
    expect(input('site-tags').value).toBe('');expect(input('download-tags').value).toBe('');
    expect(root.querySelectorAll('[data-tag-toggle][aria-pressed=true]')).toHaveLength(0);
    expect(input('page-name-0').placeholder).toBe('请输入页面名称');
  });
  it('retains input identity, caret and composition text across validation and tag changes',()=>{
    const state=ready();view.render(state,handlers);
    const name=input('site-name');name.focus();name.value='新站点';name.setSelectionRange(1,1);
    name.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
    name.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
    expect(handlers.onFieldChange).toHaveBeenCalledWith('name','新站点');
    view.render({...state,draft:{...state.draft,name:'新站点',tags:'TV,CUSTOM'}},handlers);
    expect(input('site-name')).toBe(name);expect(document.activeElement).toBe(name);expect(name.selectionStart).toBe(1);
    expect(input('site-tags').value).toBe('TV,CUSTOM');
    expect(root.querySelector('[data-tag-toggle=TV]')?.getAttribute('aria-pressed')).toBe('true');
  });
  it('submits change-only edits, page edits and User-Agent switch',()=>{
    view.render(ready(),handlers);
    input('site-name').value='Autofill';input('site-name').dispatchEvent(new Event('change',{bubbles:true}));
    input('page-name-0').value='分类';input('page-name-0').dispatchEvent(new Event('input',{bubbles:true}));
    input('import-user-agent').click();
    expect(handlers.onFieldChange).toHaveBeenCalledWith('name','Autofill');
    expect(handlers.onFieldChange).toHaveBeenCalledWith('importUserAgent',false);
    expect(handlers.onPageChange).toHaveBeenCalledWith(0,'name','分类');
  });
  it('supports keyboard architecture selection and Escape without replacing controls',()=>{
    view.render(ready(),handlers);const trigger=root.querySelector<HTMLButtonElement>('[data-architecture-trigger]')!;
    trigger.focus();trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));
    expect((document.activeElement as HTMLElement).dataset.architectureOption).toBe('api');
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    expect(document.activeElement).toBe(trigger);expect(trigger.getAttribute('aria-expanded')).toBe('false');
    click('[data-architecture-trigger]');click('[data-architecture-option=gazelle]');
    expect(handlers.onArchitectureChange).toHaveBeenCalledWith('gazelle');
  });
  it.each([
    ['nexusphp',['cookie','passkey']],['tnode',['cookie']],['gazelle',['cookie']],['unit3d',['cookie']],
    ['btitracker',['cookie']],['mtorrent',['passkey','token','webDeviceId','webVisitorId','webToken']],
    ['piggo',['token','pigVisitorId']],['haidan',['cookie','passkey']],['rousi',['cookie']],
    ['yema',['cookie']],['cola',['cookie']],['sunnypt',['cookie']],['private',['cookie']],['beyondhd',['cookie']],
    ['exoticaz',['cookie']],['filelist',['cookie']],['cinemageddon',['cookie']],['hdbits',['cookie']],
    ['karagarga',['cookie']],['torrentleech',['cookie']],['ying',['cookie']],['iptorrents',['cookie']],['yzyy',['cookie']],
  ] as const)('preserves the %s credential field group',(architecture,ids)=>{
    view.render(ready({draft:draft({architecture})}),handlers);
    expect([...root.querySelectorAll('.sensitive-panel input')].map(x=>x.id)).toEqual(ids);
    expect([...root.querySelectorAll<HTMLInputElement>('.sensitive-panel input')].every(x=>x.type==='password')).toBe(true);
  });
  it('reveals only the selected credential without replacing the input',()=>{
    const state=ready();view.render(state,handlers);const cookie=input('cookie');
    click('[data-reveal=cookie]');expect(handlers.onToggleCredential).toHaveBeenCalledWith('cookie');
    view.render({...state,revealed:new Set(['cookie'])},handlers);
    expect(input('cookie')).toBe(cookie);expect(cookie.type).toBe('text');expect(input('passkey').type).toBe('password');
  });
  it('keeps error descriptions and locates original page row with a temporary toast',()=>{
    vi.useFakeTimers();view.render(ready({errors:{pages:{code:'pageNameRequired',index:1}}}),handlers);
    expect(input('page-name-1').getAttribute('aria-invalid')).toBe('true');
    expect(input('page-name-0').getAttribute('aria-invalid')).toBe('false');
    click('[data-action=locate]');expect(document.activeElement).toBe(input('page-name-1'));
    expect(root.querySelector('.evo-toast')?.textContent).toBe('请输入页面名称');
    vi.advanceTimersByTime(3000);expect(root.querySelector('.evo-toast')?.textContent).toBe('');
    expect(root.querySelector('#error-page-name-1')?.textContent).toBe('请输入页面名称');
    expect(root.querySelector<HTMLButtonElement>('[data-action=generate]')!.disabled).toBe(true);
  });
  it('locates the category section when the page list is empty',()=>{
    view.render(ready({draft:draft({pages:[]}),errors:{pages:{code:'pagesCount'}}}),handlers);
    click('[data-action=locate]');expect((document.activeElement as HTMLElement).dataset.action).toBe('add-manual-page');
  });
  it('preserves busy labels and locks duplicate page actions',()=>{
    const state=ready();view.render(state,handlers);
    const button=root.querySelector<HTMLButtonElement>('[data-action=add-current-page]')!;const label=button.textContent;
    view.render({...state,addingPage:true},handlers);
    expect(button.textContent).toBe(label);expect(button.disabled).toBe(true);expect(button.querySelectorAll('.evo-spinner i')).toHaveLength(12);
    expect(root.querySelector<HTMLButtonElement>('[data-action=add-manual-page]')!.disabled).toBe(true);
    view.render(state,handlers);expect(button.disabled).toBe(false);
  });
  it('escapes names, paths, hosts and credentials',()=>{
    view.render(ready({draft:draft({name:'<img src=x onerror=alert(1)>',cookie:'" onfocus=alert(1) x="',pages:[{name:'<script>x</script>',path:'/torrents.php',tags:null,selected:true}]})}),handlers);
    expect(root.querySelectorAll('script,[onerror],[onfocus]')).toHaveLength(0);
    expect(input('site-name').value).toBe('<img src=x onerror=alert(1)>');
  });
  it('cancels reread via Escape, confirms explicitly and resolves pending dialog on dispose',async()=>{
    view.render(ready(),handlers);
    const refresh=root.querySelector<HTMLButtonElement>('[data-action=refresh]')!;refresh.focus();
    const canceled=view.confirmRefresh();expect(root.querySelector('dialog[open]')?.getAttribute('aria-labelledby')).toBe('refresh-title');
    root.querySelector('dialog')!.dispatchEvent(new Event('cancel',{cancelable:true}));expect(await canceled).toBe(false);expect(document.activeElement).toBe(refresh);
    const confirmed=view.confirmRefresh();click('[data-action=confirm-refresh]');expect(await confirmed).toBe(true);
    const pending=view.confirmRefresh();view.dispose();expect(await pending).toBe(false);
  });
  it('keeps a pending refresh decision and IME input intact when an async page arrives',async()=>{
    const state=ready();view.render(state,handlers);const name=input('site-name');name.focus();
    name.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
    view.render({...state,draft:{...state.draft,pages:[...state.draft.pages,{name:'',path:'/torrents.php',tags:null,selected:true}]}},handlers);
    view.focusPage(2);expect(input('site-name')).toBe(name);expect(document.activeElement).toBe(name);
    name.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));
    const confirmation=view.confirmRefresh();const dialog=root.querySelector('dialog');
    const next={...state,draft:{...state.draft,pages:[...state.draft.pages,{name:'',path:'/torrents.php',tags:null,selected:true},{name:'',path:'/torrents.php',tags:null,selected:true}]}};
    view.render(next,handlers);view.focusPage(3);expect(root.querySelector('dialog')).toBe(dialog);expect(dialog?.contains(document.activeElement)).toBe(true);
    click('[data-action=cancel-refresh]');expect(await confirmation).toBe(false);
  });
  it('locates missing fields in visible order and keeps capacity errors actionable',()=>{
    view.render(ready({draft:draft({architecture:'mtorrent'}),errors:{token:{code:'apiKeyRequired'},passkey:{code:'uidInvalid'}}}),handlers);
    click('[data-action=locate]');expect(document.activeElement?.id).toBe('passkey');
    view.render(ready({errors:{payload:{code:'qrCapacity'}}}),handlers);
    expect(root.querySelector('[data-action=locate]')?.textContent).toContain('二维码');
    click('[data-action=locate]');expect(document.activeElement?.id).toBe('pages');
  });
  it('keeps QR canvas while fullscreen opens and reports recoverable errors',()=>{
    const state:PopupState={kind:'qr',draft:draft(),payload:{text:'fixture',sourceBytes:1,compressedBytes:1}};
    view.render(ready(),handlers);document.documentElement.scrollTop=600;
    view.render(state,handlers);const canvas=root.querySelector('canvas');
    expect(document.documentElement.scrollTop).toBe(0);
    view.render({...state,openingFullscreen:true},handlers);expect(root.querySelector('canvas')).toBe(canvas);
    view.render({...state,error:{code:'qrDrawFailed'}},handlers);
    expect(root.querySelector<HTMLButtonElement>('[data-action=fullscreen]')!.disabled).toBe(true);
    click('[data-action=back]');expect(handlers.onBack).toHaveBeenCalledOnce();
  });
  it.each(['zh','en','fr','de','es'] as Locale[])('labels every control in %s',locale=>{
    view.dispose();view=createPopupView(root,locale);view.render(ready(),handlers);
    expect(root.querySelector('h1')?.textContent).toBe(createText(locale)('editTitle'));
    for(const el of root.querySelectorAll('input'))expect(root.querySelector(`label[for="${el.id}"]`),el.id).not.toBeNull();
    for(const el of root.querySelectorAll('button'))expect(el.textContent?.trim()||el.getAttribute('aria-label')).toBeTruthy();
  });
  it('removes event listeners and sensitive fields on dispose',()=>{
    view.render(ready(),handlers);const detached=root.querySelector<HTMLButtonElement>('[data-action=generate]')!;
    view.dispose();detached.click();expect(handlers.onGenerate).not.toHaveBeenCalled();expect(root.textContent).toBe('');
  });
});
