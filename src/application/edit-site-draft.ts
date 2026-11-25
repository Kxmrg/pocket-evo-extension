import type { SiteDraft } from '../domain/adapt-site';
import { apiProtocol, independentApis } from '../domain/api-protocol';
import { independentHtml } from '../domain/independent-html';
import { createManualPage } from '../domain/torrent-pages';
import type { ArchitectureId } from '../domain/types';
import { validateDraft } from '../domain/validate-draft';

const draftFields = [
  'name', 'address', 'cookie', 'token', 'passkey', 'webToken', 'webDeviceId', 'webVisitorId',
  'pigVisitorId', 'userAgent', 'importUserAgent', 'tags', 'downloadTags',
] as const;
export type DraftField = (typeof draftFields)[number];
const editable = new Set<string>(draftFields);

const schemeByArchitecture: Partial<Record<ArchitectureId, SiteDraft['scheme']>> = {
  nexusphp: 0,
  tnode: 1,
  mtorrent: 2,
  haidan: 3,
  sunnypt: 4,
  rousi: 5,
  yema: 6,
  cola: 7,
  piggo: 8,
};

const noPasskey = new Set<ArchitectureId>([
  ...independentHtml, 'rousi', 'yema', 'cola', 'sunnypt', 'gazelle', 'unit3d', 'btitracker', 'private', 'beyondhd',
]);

export function isDraftField(field: string): field is DraftField {
  return editable.has(field);
}

function crossesPiggo(from: ArchitectureId, to: ArchitectureId): boolean {
  return from !== to && (from === 'piggo' || to === 'piggo');
}

function convertedPages(draft: SiteDraft, architecture: ArchitectureId, address = draft.address): SiteDraft['pages'] {
  const from = createManualPage(draft.architecture, draft.address).path;
  const to = createManualPage(architecture, address).path;
  if (from === to) return draft.pages;
  return draft.pages.map(page => page.path === from ? { ...page, path: to } : page);
}

function clearIncompatiblePasskey(draft: SiteDraft): SiteDraft {
  const { architecture, passkey } = draft;
  if (architecture === 'piggo') return withCredential(draft, 'passkey', null);
  const hidden = architecture === 'tnode' || noPasskey.has(architecture);
  if (hidden && passkey && validateDraft(draft).errors.passkey) {
    return withCredential(draft, 'passkey', null);
  }
  return draft;
}

export function changeDraftArchitecture(draft: SiteDraft, architecture: ArchitectureId): SiteDraft {
  if (architecture === 'api') architecture = apiProtocol(draft.address) ?? 'api';
  if (architecture === draft.architecture) return draft;
  return clearIncompatiblePasskey({
    ...draft,
    architecture,
    scheme: schemeByArchitecture[architecture] ?? null,
    token: crossesPiggo(draft.architecture, architecture) || architecture === 'nexusphp' || noPasskey.has(architecture)
      ? null : draft.token,
    webToken: architecture === 'mtorrent' ? draft.webToken : null,
    webDeviceId: architecture === 'mtorrent' ? draft.webDeviceId : null,
    webVisitorId: architecture === 'mtorrent' ? draft.webVisitorId : null,
    pigVisitorId: null,
    passkey: noPasskey.has(architecture) ? null : draft.passkey,
    pages: convertedPages(draft, architecture),
    fieldWarnings: {},
  });
}

function withCredential<T extends 'cookie' | 'webToken' | 'webDeviceId' | 'webVisitorId' | 'pigVisitorId' | 'token' | 'passkey'>(
  draft: SiteDraft, field: T, value: SiteDraft[T],
): SiteDraft {
  if (!(field in draft.fieldWarnings)) {
    return draft[field] === value ? draft : { ...draft, [field]: value };
  }
  const fieldWarnings = { ...draft.fieldWarnings };
  delete fieldWarnings[field];
  return { ...draft, [field]: value, fieldWarnings };
}

export function changeDraftField(draft: SiteDraft, field: DraftField, value: string | boolean | null): SiteDraft {
  const text = String(value ?? '');
  switch (field) {
    case 'address': {
      if (draft.address === text) return draft;
      const architecture = independentApis.has(draft.architecture) ? apiProtocol(text) ?? draft.architecture : draft.architecture;
      const next: SiteDraft = {
        ...draft, address: text, architecture, scheme: schemeByArchitecture[architecture] ?? null,
        token: crossesPiggo(draft.architecture, architecture) ? null : draft.token,
        pigVisitorId: architecture === 'piggo' && architecture === draft.architecture ? draft.pigVisitorId : null,
        pages: convertedPages(draft, architecture, text),
      };
      return architecture === draft.architecture ? next : clearIncompatiblePasskey(next);
    }
    case 'cookie':
      return withCredential(draft, field, text);
    case 'webToken':
    case 'webDeviceId':
    case 'webVisitorId':
    case 'pigVisitorId':
    case 'token':
    case 'passkey':
      return withCredential(draft, field, text || null);
    case 'name':
      return draft.name === text ? draft : { ...draft, name: text };
    case 'userAgent':
    case 'tags':
    case 'downloadTags': {
      const next = text || null;
      return draft[field] === next ? draft : { ...draft, [field]: next };
    }
    case 'importUserAgent': {
      const checked = Boolean(value);
      return draft.importUserAgent === checked ? draft : { ...draft, importUserAgent: checked };
    }
  }
}
