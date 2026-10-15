import { apiProtocol, independentApis } from '../domain/api-protocol';
import QRCode from 'qrcode';
import { entryError } from '../domain/evo-entry';
import { collectSiteDraft } from '../application/collect-site';
import type { SiteDraft } from '../domain/adapt-site';
import { encodeImportPayload, QR_ERROR_CORRECTION_LEVEL } from '../domain/payload';
import { createManualPage, draftPageFromSnapshot } from '../domain/torrent-pages';
import type { ArchitectureId } from '../domain/types';
import { validateDraft } from '../domain/validate-draft';
import {
  getActivePageContext,
  readCookies,
  readPageSnapshot,
  requestCurrentOrigin,
  type ActivePageContext,
} from '../browser/chrome-gateway';
import { openFullscreenQr } from '../browser/fullscreen-qr';
import { popupStateFromCollection, renderPopup, type PopupActions, type PopupState } from './render';
import './styles.css';

const rootElement = document.querySelector<HTMLElement>('#app');
if (!rootElement) throw new Error('Popup root is missing');
const root: HTMLElement = rootElement;

let state: PopupState = { kind: 'idle' };
let activeContext: ActivePageContext | null = null;

const schemeByArchitecture: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7> = {
  nexusphp: 0,
  tnode: 1,
  mtorrent: 2,
  haidan: 3,
  sunnypt: 4,
  rousi: 5,
  yema: 6,
};

function readyState(draft: SiteDraft, revealed = new Set<string>(), sourceOrigin = activeContext?.origin): PopupState {
  return { kind: 'ready', draft, errors: validateDraft(draft).errors, revealed, sourceOrigin };
}

async function drawQr(): Promise<void> {
  if (state.kind !== 'qr') return;
  const canvas = root.querySelector<HTMLCanvasElement>('#qr-canvas');
  if (!canvas) return;
  await QRCode.toCanvas(canvas, state.payload.text, {
    width: 720,
    margin: 4,
    errorCorrectionLevel: QR_ERROR_CORRECTION_LEVEL,
    color: { dark: '#102a2b', light: '#fffdf6' },
  });
}

function paint(next: PopupState): void {
  state = next;
  renderPopup(root, state, actions);
  void drawQr();
}

function currentReady(): Extract<PopupState, { kind: 'ready' }> | null {
  return state.kind === 'ready' ? state : null;
}

function updateDraft(transform: (draft: SiteDraft) => SiteDraft): void {
  const ready = currentReady();
  if (!ready) return;
  const advanced = root.querySelector<HTMLDetailsElement>('details.advanced');
  const keepAdvancedOpen = advanced?.open ?? false;
  paint(readyState(transform(ready.draft), ready.revealed, ready.sourceOrigin));
  const nextAdvanced = root.querySelector<HTMLDetailsElement>('details.advanced');
  if (nextAdvanced) nextAdvanced.open = keepAdvancedOpen;
}

async function loadSite(): Promise<void> {
  paint({ kind: 'loading', message: '正在识别架构并收集配置…' });
  try {
    activeContext = await getActivePageContext();
    const context = activeContext;
    const result = await collectSiteDraft({
      getContext: async () => context,
      readSnapshot: async () => readPageSnapshot(context.tabId),
      readCookies,
    });
    const next = popupStateFromCollection(result, context.origin);
    paint(next.kind === 'ready' ? readyState(next.draft) : next);
  } catch (error) {
    paint({ kind: 'error', message: error instanceof Error ? error.message : '读取当前站点失败，请重试' });
  }
}

function splitTags(tags: string | null): string[] {
  return (tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
}

function showToast(message: string): void {
  let toast = document.getElementById('mc-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'mc-toast';
    toast.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#111827;color:#fff;padding:8px 14px;border-radius:8px;font:13px/1.4 -apple-system,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.3)';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = 'block';
  const node = toast as HTMLElement & { _timer?: number };
  clearTimeout(node._timer);
  node._timer = window.setTimeout(() => { node.style.display = 'none'; }, 1800);
}

const actions: PopupActions = {
  onRead: () => { void loadSite(); },
  onRefresh: () => { void loadSite(); },
  onRequestPermission: () => {
    if (state.kind !== 'permission') return;
    void requestCurrentOrigin(state.origin).then((granted) => {
      if (granted) void loadSite();
      else paint({ kind: 'error', message: '未授予当前站点权限，无法读取完整 Cookie' });
    });
  },
  onRetry: () => { void loadSite(); },
  onArchitectureChange: (architecture: ArchitectureId) => {
    updateDraft((draft) => {
      if (architecture === 'api') architecture = apiProtocol(draft.address) ?? 'api';
      const pages = draft.pages.length > 0 ? draft.pages.map(page => ({ ...page, path: page.path === createManualPage(draft.architecture).path ? createManualPage(architecture).path : page.path })) : [{
        ...createManualPage(architecture), name: '综合',
      }];
      return {
        ...draft,
        architecture,
        scheme: schemeByArchitecture[architecture] ?? null,
        token: architecture === 'nexusphp' || architecture === 'rousi' || architecture === 'yema' || architecture === 'sunnypt' || architecture === 'gazelle' || architecture === 'unit3d' || architecture === 'private' ? null : draft.token,
        webToken: architecture === 'mtorrent' ? draft.webToken : null,
        webDeviceId: architecture === 'mtorrent' ? draft.webDeviceId : null,
        webVisitorId: architecture === 'mtorrent' ? draft.webVisitorId : null,
        passkey: architecture === 'rousi' || architecture === 'yema' || architecture === 'sunnypt' || architecture === 'gazelle' || architecture === 'unit3d' || architecture === 'private' ? null : draft.passkey,
        pages,
        fieldWarnings: {},
      };
    });
  },
  onFieldChange: (field, value) => {
    updateDraft((draft) => {
      switch (field) {
        case 'name': return { ...draft, name: String(value) };
        case 'address': {
          const address = String(value);
          const architecture = independentApis.has(draft.architecture) ? apiProtocol(address) ?? 'api' : draft.architecture;
          return { ...draft, address, architecture, scheme: schemeByArchitecture[architecture] ?? null, pages: draft.pages.map(page => ({ ...page, path: page.path === createManualPage(draft.architecture).path ? createManualPage(architecture).path : page.path })) };
        }
        case 'cookie': return { ...draft, cookie: String(value), fieldWarnings: { ...draft.fieldWarnings, cookie: '' } };
        case 'webToken': return { ...draft, webToken: String(value) || null, fieldWarnings: { ...draft.fieldWarnings, webToken: '' } };
        case 'webDeviceId': return { ...draft, webDeviceId: String(value) || null, fieldWarnings: { ...draft.fieldWarnings, webDeviceId: '' } };
        case 'webVisitorId': return { ...draft, webVisitorId: String(value) || null, fieldWarnings: { ...draft.fieldWarnings, webVisitorId: '' } };
        case 'token': return { ...draft, token: String(value) || null, fieldWarnings: { ...draft.fieldWarnings, token: '' } };
        case 'passkey': return { ...draft, passkey: String(value) || null, fieldWarnings: { ...draft.fieldWarnings, passkey: '' } };
        case 'userAgent': return { ...draft, userAgent: String(value) || null };
        case 'importUserAgent': return { ...draft, importUserAgent: Boolean(value) };
        case 'tags': return { ...draft, tags: String(value) || null };
        case 'downloadTags': return { ...draft, downloadTags: String(value) || null };
        default: return draft;
      }
    });
  },
  onTagToggle: (tag) => {
    updateDraft((draft) => {
      const list = splitTags(draft.tags);
      const index = list.indexOf(tag);
      if (index >= 0) list.splice(index, 1); else list.push(tag);
      return { ...draft, tags: list.length > 0 ? list.join(',') : null };
    });
  },
  onTagRemove: (tag) => {
    updateDraft((draft) => {
      const list = splitTags(draft.tags).filter((item) => item !== tag);
      return { ...draft, tags: list.length > 0 ? list.join(',') : null };
    });
  },
  onAddCustomTag: (value) => {
    const tag = value.trim();
    updateDraft((draft) => {
      const list = splitTags(draft.tags);
      if (tag && !list.includes(tag)) list.push(tag);
      const next = list.length > 0 ? list.join(',') : null;
      return { ...draft, tags: next };
    });
    if (tag) showToast('已添加 ' + tag);
  },
  onToggleCredential: (field) => {
    const ready = currentReady();
    if (!ready) return;
    const revealed = new Set(ready.revealed);
    if (revealed.has(field)) revealed.delete(field); else revealed.add(field);
    paint({ ...ready, revealed });
  },
  onPageChange: (index, field, value) => {
    updateDraft((draft) => ({ ...draft, pages: draft.pages.map((page, pageIndex) => pageIndex === index ? { ...page, [field]: value } : page) }));
  },
  onPageRemove: (index) => {
    updateDraft((draft) => ({ ...draft, pages: draft.pages.filter((_, pageIndex) => pageIndex !== index) }));
  },
  onPageAddCurrent: () => {
    void (async () => {
      try {
        const context = await getActivePageContext();
        const current = currentReady();
        if (!current || current.sourceOrigin !== context.origin) throw new Error('请在当前站点内添加资源入口');
        const page = draftPageFromSnapshot(await readPageSnapshot(context.tabId), '');
        const reason = page ? entryError(current.draft.architecture,page.path) : null;
        if (reason) throw new Error(reason);
        if (!page) throw new Error('未能读取当前页面地址');
        updateDraft((draft) => ({ ...draft, pages: [...draft.pages, page] }));
      } catch (error) {
        const ready = currentReady();
        if (!ready) return;
        paint({ ...ready, errors: { ...ready.errors, pages: error instanceof Error ? error.message : '未能读取当前页面' } });
      }
    })();
  },
  onPageAddManual: () => {
    updateDraft((draft) => ({ ...draft, pages: [...draft.pages, createManualPage(draft.architecture)] }));
  },
  onGenerate: () => {
    const ready = currentReady();
    if (!ready) return;
    const validation = validateDraft(ready.draft);
    if (!validation.valid) {
      paint({ ...ready, errors: validation.errors });
      return;
    }
    try {
      paint({ kind: 'qr', draft: ready.draft, payload: encodeImportPayload(ready.draft) });
    } catch (error) {
      paint({ ...ready, errors: { payload: error instanceof Error ? error.message : '二维码生成失败' } });
    }
  },
  onFullscreen: () => {
    if (state.kind !== 'qr') return;
    void openFullscreenQr({ text: state.payload.text, siteName: state.draft.name });
  },
  onBack: () => {
    if (state.kind === 'qr') paint(readyState(state.draft));
  },
};

paint(state);
