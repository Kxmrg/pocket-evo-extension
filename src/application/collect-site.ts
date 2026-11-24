import { adaptSite, type SiteDraft } from '../domain/adapt-site';
import {
  formatCookieHeader,
  mergeCookieHeaders,
  parseCookieHeader,
  type CookieLike,
} from '../domain/cookies';
import { detectArchitecture } from '../domain/detect-architecture';
import type { ImportIssue } from '../domain/import-issue';
import type { DetectionResult, PageSnapshot } from '../domain/types';

export interface CollectionContext {
  tabId?: number;
  url: string;
  origin: string;
  hasPermission: boolean;
}

export interface CollectionDeps {
  getContext: () => Promise<CollectionContext>;
  readSnapshot: () => Promise<PageSnapshot>;
  readCookies: (url: string, tabId?: number) => Promise<CookieLike[]>;
}

export type CollectionResult =
  | { state: 'permission-required'; origin: string }
  | { state: 'unsupported'; detection: DetectionResult }
  | { state: 'ready'; detection: DetectionResult; draft: SiteDraft }
  | { state: 'error'; issue: ImportIssue };

export async function collectSiteDraft(deps: CollectionDeps): Promise<CollectionResult> {
  let context: CollectionContext;
  try {
    context = await deps.getContext();
  } catch {
    return { state: 'error', issue: { code: 'contextReadFailed' } };
  }
  if (!context.hasPermission) return { state: 'permission-required', origin: context.origin };

  let snapshot: PageSnapshot;
  try {
    snapshot = await deps.readSnapshot();
  } catch {
    return { state: 'error', issue: { code: 'pageReadFailed' } };
  }

  try {
    if (context.origin !== snapshot.origin || new URL(snapshot.url).origin !== context.origin) {
      return { state: 'error', issue: { code: 'pageChanged' } };
    }
    const detection = detectArchitecture(snapshot);
    if (!detection.supported && detection.id !== 'unknown') {
      return { state: 'unsupported', detection };
    }
    // Cola scopes its real HttpOnly session to the API path; /browse only has a marker.
    const cookieUrl = detection.id === 'cola' ? new URL('/api/v1/me', snapshot.origin).href : snapshot.url;
    let cookies: CookieLike[] = [];
    let cookieReadFailed = false;
    if (detection.id !== 'piggo') {
      try {
        cookies = await deps.readCookies(cookieUrl, context.tabId);
      } catch {
        cookieReadFailed = true;
      }
    }
    const cookieHeader = mergeCookieHeaders(
      formatCookieHeader(cookies, cookieUrl),
      detection.id === 'piggo' ? '' : snapshot.documentCookie ?? '',
    );
    const snapshotWithCookieCandidates: PageSnapshot = {
      ...snapshot,
      candidates: [
        ...snapshot.candidates,
        ...parseCookieHeader(cookieHeader)
          .map((cookie) => ({ key: cookie.name, value: cookie.value, source: 'cookie' })),
      ],
    };
    const draft = adaptSite({ detection, snapshot: snapshotWithCookieCandidates, cookieHeader });
    if (detection.id === 'mtorrent' || detection.id === 'piggo') {
      delete draft.fieldWarnings.cookie;
    } else if (cookieReadFailed) {
      draft.fieldWarnings.cookie = { code: cookieHeader ? 'cookieReadFallback' : 'cookieReadMissing' };
    } else if (cookies.length === 0 && cookieHeader) {
      draft.fieldWarnings.cookie = { code: 'cookieVisibleOnly' };
    } else if (!cookieHeader) {
      draft.fieldWarnings.cookie = { code: 'cookieUnavailable' };
    }
    return { state: 'ready', detection, draft };
  } catch {
    return { state: 'error', issue: { code: 'parseFailed' } };
  }
}
