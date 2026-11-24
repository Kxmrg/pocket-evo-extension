import type { CollectionDeps, CollectionResult } from '../application/collect-site';
import { changeDraftArchitecture, changeDraftField, isDraftField } from '../application/edit-site-draft';
import type { ActivePageContext } from '../browser/chrome-gateway';
import type { FullscreenQrSession } from '../browser/fullscreen-qr';
import type { SiteDraft } from '../domain/adapt-site';
import type { CookieLike } from '../domain/cookies';
import { entryError } from '../domain/evo-entry';
import { ImportPayloadError, type ImportIssue } from '../domain/import-issue';
import { encodeImportPayload } from '../domain/payload';
import { splitTags } from '../domain/site-tags';
import { createManualPage, draftPageFromSnapshot } from '../domain/torrent-pages';
import type { PageSnapshot } from '../domain/types';
import { validateDraft } from '../domain/validate-draft';
import type { PopupActions, PopupState, PopupView } from './state';

export interface PopupServices {
  getActivePageContext(): Promise<ActivePageContext>;
  collectSiteDraft(deps: CollectionDeps): Promise<CollectionResult>;
  readPageSnapshot(tabId: number): Promise<PageSnapshot>;
  readCookies(url: string, tabId?: number): Promise<CookieLike[]>;
  requestCurrentOrigin(origin: string): Promise<boolean>;
  openFullscreenQr(session: FullscreenQrSession): Promise<void>;
}

type ReadyState = Extract<PopupState, { kind: 'ready' }>;
type QrState = Extract<PopupState, { kind: 'qr' }>;
const MAX_PAGES = 50;

function readyState(draft: SiteDraft, sourceOrigin?: string, dirty = false): ReadyState {
  return { kind: 'ready', draft, errors: validateDraft(draft).errors, revealed: new Set(), sourceOrigin, dirty };
}

function stateFromCollection(result: CollectionResult, sourceOrigin: string): PopupState {
  switch (result.state) {
    case 'ready': return readyState(result.draft, sourceOrigin);
    case 'permission-required': return { kind: 'permission', origin: result.origin };
    case 'unsupported': return { kind: 'unsupported', detection: result.detection };
    case 'error': return { kind: 'error', issue: result.issue };
  }
}

export function createPopupController(services: PopupServices, view: PopupView): { start(): void; dispose(): void } {
  let state: PopupState = { kind: 'idle' };
  let generation = 0;
  let started = false;
  let disposed = false;
  let confirmingRefresh = false;

  function paint(next: PopupState): void {
    if (disposed) return;
    state = next;
    view.render(state, actions);
  }

  function isCurrent(request: number): boolean {
    return !disposed && request === generation;
  }

  function replaceDraft(ready: ReadyState, draft: SiteDraft): void {
    if (draft !== ready.draft) {
      paint({ ...ready, draft, errors: validateDraft(draft).errors, dirty: true });
    }
  }

  function canAddPage(ready: ReadyState): boolean {
    return !ready.addingPage && ready.draft.pages.length < MAX_PAGES;
  }

  async function loadSite(): Promise<void> {
    if (disposed) return;
    const request = ++generation;
    paint({ kind: 'loading', reason: 'collectingSite' });
    try {
      const context = await services.getActivePageContext();
      if (!isCurrent(request)) return;
      const result = await services.collectSiteDraft({
        getContext: async () => context,
        readSnapshot: () => services.readPageSnapshot(context.tabId),
        readCookies: (url, tabId) => services.readCookies(url, tabId),
      });
      if (isCurrent(request)) paint(stateFromCollection(result, context.origin));
    } catch {
      if (isCurrent(request)) paint({ kind: 'error', issue: { code: 'contextReadFailed' } });
    }
  }

  async function refresh(): Promise<void> {
    if (disposed || confirmingRefresh) return;
    if ((state.kind === 'ready' || state.kind === 'qr') && state.dirty) {
      const request = generation;
      confirmingRefresh = true;
      try {
        if (!await view.confirmRefresh() || !isCurrent(request)) return;
      } catch {
        return;
      } finally {
        confirmingRefresh = false;
      }
    }
    await loadSite();
  }

  async function requestPermission(): Promise<void> {
    if (disposed || state.kind !== 'permission') return;
    const request = ++generation;
    const origin = state.origin;
    paint({ kind: 'loading', reason: 'requestingPermission' });
    try {
      const granted = await services.requestCurrentOrigin(origin);
      if (!isCurrent(request)) return;
      if (granted) void loadSite();
      else paint({ kind: 'error', issue: { code: 'permissionDenied' } });
    } catch {
      if (isCurrent(request)) paint({ kind: 'error', issue: { code: 'permissionRequestFailed' } });
    }
  }

  async function addCurrentPage(ready: ReadyState): Promise<void> {
    const request = generation;
    const architecture = ready.draft.architecture;
    paint({ ...ready, addingPage: true, pageActionError: undefined });
    const fail = (issue: ImportIssue): void => {
      if (isCurrent(request) && state.kind === 'ready') {
        paint({ ...state, addingPage: false, pageActionError: issue });
      }
    };
    try {
      const context = await services.getActivePageContext();
      if (!isCurrent(request) || state.kind !== 'ready') return;
      if (ready.sourceOrigin !== context.origin) {
        fail({ code: 'wrongSite' });
        return;
      }
      const snapshot = await services.readPageSnapshot(context.tabId);
      if (!isCurrent(request) || state.kind !== 'ready') return;
      if (snapshot.origin !== context.origin || new URL(snapshot.url).origin !== context.origin) {
        fail({ code: 'pageChanged' });
        return;
      }
      const page = draftPageFromSnapshot(snapshot, '', architecture);
      if (!page) {
        fail({ code: 'addPageFailed' });
        return;
      }
      const issue = entryError(architecture, page.path);
      if (issue) {
        fail(issue);
        return;
      }
      const { draft } = state;
      const index = draft.pages.length;
      replaceDraft({ ...state, addingPage: false }, { ...draft, pages: [...draft.pages, page] });
      view.focusPage(index);
    } catch {
      fail({ code: 'addPageFailed' });
    }
  }

  async function drawQr(qr: QrState, request: number): Promise<void> {
    try {
      await view.drawQr(qr.payload);
    } catch {
      if (isCurrent(request) && state.kind === 'qr') {
        paint({ ...state, error: { code: 'qrDrawFailed' } });
      }
    }
  }

  async function openFullscreen(qr: QrState): Promise<void> {
    const request = generation;
    paint({ ...qr, openingFullscreen: true, error: undefined });
    let failed = false;
    try {
      await services.openFullscreenQr({ text: qr.payload.text, siteName: qr.draft.name });
    } catch {
      failed = true;
    }
    if (isCurrent(request) && state.kind === 'qr') {
      const error: ImportIssue | undefined = state.error
        ?? (failed ? { code: 'fullscreenOpenFailed' } : undefined);
      paint({ ...state, openingFullscreen: false, error });
    }
  }

  function beginRead(): void {
    if (!confirmingRefresh) void loadSite();
  }

  const actions: PopupActions = {
    onRead: beginRead,
    onRefresh: () => { void refresh(); },
    onRequestPermission: () => { void requestPermission(); },
    onRetry: beginRead,
    onArchitectureChange(architecture) {
      if (disposed || state.kind !== 'ready') return;
      const draft = changeDraftArchitecture(state.draft, architecture);
      if (draft === state.draft) return;
      generation++;
      replaceDraft({ ...state, addingPage: false, pageActionError: undefined }, draft);
    },
    onFieldChange(field, value) {
      if (disposed || state.kind !== 'ready' || !isDraftField(field) || typeof value === 'number') return;
      const draft = changeDraftField(state.draft, field, value);
      if (draft === state.draft) return;
      if (field === 'address') {
        generation++;
        replaceDraft({ ...state, addingPage: false, pageActionError: undefined }, draft);
      } else {
        replaceDraft(state, draft);
      }
    },
    onTagToggle(tag) {
      if (disposed || state.kind !== 'ready') return;
      const tags = splitTags(state.draft.tags);
      const index = tags.indexOf(tag);
      if (index >= 0) tags.splice(index, 1);
      else tags.push(tag);
      const draft = changeDraftField(state.draft, 'tags', tags.join(','));
      replaceDraft(state, draft);
    },
    onToggleCredential(field) {
      if (disposed || state.kind !== 'ready') return;
      const revealed = new Set(state.revealed);
      if (revealed.has(field)) revealed.delete(field);
      else revealed.add(field);
      paint({ ...state, revealed });
    },
    onPageChange(index, field, value) {
      if (disposed || state.kind !== 'ready') return;
      const { draft } = state;
      const page = draft.pages[index];
      if (!page || page[field] === value) return;
      const pages = draft.pages.slice();
      pages[index] = { ...page, [field]: value };
      replaceDraft(state, { ...draft, pages });
    },
    onPageRemove(index) {
      if (disposed || state.kind !== 'ready' || !state.draft.pages[index]) return;
      const { draft } = state;
      replaceDraft(state, { ...draft, pages: draft.pages.filter((_, position) => position !== index) });
    },
    onPageAddCurrent() {
      if (disposed || state.kind !== 'ready' || !canAddPage(state)) return;
      void addCurrentPage(state);
    },
    onPageAddManual() {
      if (disposed || state.kind !== 'ready' || !canAddPage(state)) return;
      const { draft } = state;
      replaceDraft({ ...state, pageActionError: undefined }, {
        ...draft, pages: [...draft.pages, createManualPage(draft.architecture)],
      });
      view.focusPage(draft.pages.length);
    },
    onGenerate() {
      if (disposed || state.kind !== 'ready' || state.addingPage) return;
      const { draft, sourceOrigin, dirty } = state;
      const validation = validateDraft(draft);
      if (!validation.valid) {
        paint({ ...state, errors: validation.errors });
        return;
      }
      try {
        const payload = encodeImportPayload(draft);
        const request = ++generation;
        const qr: QrState = { kind: 'qr', draft, payload, sourceOrigin, dirty };
        paint(qr);
        void drawQr(qr, request);
      } catch (error) {
        const issue = error instanceof ImportPayloadError ? error.issue : { code: 'qrCapacity' } as const;
        paint({ ...state, errors: { payload: issue } });
      }
    },
    onFullscreen() {
      if (disposed || state.kind !== 'qr' || state.openingFullscreen || state.error?.code === 'qrDrawFailed') return;
      void openFullscreen(state);
    },
    onBack() {
      if (disposed || state.kind !== 'qr') return;
      generation++;
      paint(readyState(state.draft, state.sourceOrigin, state.dirty));
    },
  };

  return {
    start() {
      if (started || disposed) return;
      started = true;
      paint(state);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      state = { kind: 'idle' };
      view.dispose();
    },
  };
}
