import { describe, expect, it } from 'vitest';
import type { SiteDraft } from '../domain/adapt-site';
import { createManualPage } from '../domain/torrent-pages';
import { validateDraft } from '../domain/validate-draft';
import { changeDraftArchitecture, changeDraftField, isDraftField } from './edit-site-draft';

function fixture(): SiteDraft {
  return {
    architecture: 'mtorrent', scheme: 2, name: 'M-Team', address: 'https://api.m-team.cc',
    cookie: '', token: 'fixture-api', webToken: 'fixture-web', webDeviceId: 'fixture-device',
    webVisitorId: 'fixture-visitor', pigVisitorId: null, passkey: 'fixture-passkey',
    userAgent: null, importUserAgent: false, tags: null, downloadTags: null,
    pages: [{ ...createManualPage('mtorrent'), name: 'All' }],
    alternatives: {}, fieldWarnings: {},
  };
}

describe('draft field edits', () => {
  it('preserves M-Team credentials while the address is incomplete', () => {
    const draft = fixture();
    const next = changeDraftField(draft, 'address', 'https://api.m-team.c');
    expect(next).toMatchObject({
      architecture: 'mtorrent', scheme: 2, token: draft.token, webToken: draft.webToken,
      webDeviceId: draft.webDeviceId, webVisitorId: draft.webVisitorId, pages: draft.pages,
    });
  });

  it('preserves Piggo credentials until the address matches another protocol', () => {
    const draft: SiteDraft = {
      ...fixture(), architecture: 'piggo', scheme: 8, address: 'https://piggo.me',
      token: 'fixture-token', pigVisitorId: 'fixture-pig-visitor',
      pages: [{ ...createManualPage('piggo'), name: 'All' }],
    };
    const partial = changeDraftField(draft, 'address', 'https://piggo.m');
    expect(partial).toMatchObject({
      architecture: 'piggo', scheme: 8, token: draft.token, pigVisitorId: draft.pigVisitorId,
      pages: draft.pages,
    });
    const switched = changeDraftField(partial, 'address', 'https://api.m-team.cc');
    expect(switched).toMatchObject({ architecture: 'mtorrent', token: null, pigVisitorId: null });
    expect(switched.pages[0]?.path).toBe('/browse');
  });

  it.each([
    ['https://zhuque.in', 'tnode'],
    ['https://piggo.me', 'piggo'],
    ['https://www.colapt.com', 'cola'],
  ])('clears an inherited invalid Passkey when the address switches to %s', (address, architecture) => {
    const draft: SiteDraft = {
      ...fixture(), architecture: 'haidan', scheme: 3, address: 'https://haidan.cc',
      cookie: 'session=fixture', passkey: 'invalid pass key',
      pages: [{ ...createManualPage('haidan'), name: 'All' }],
    };
    const partial = changeDraftField(draft, 'address', address.slice(0, -1));
    expect(partial.passkey).toBe(draft.passkey);
    const next = changeDraftField(partial, 'address', address);
    expect(next).toMatchObject({ architecture, passkey: null });
    expect(validateDraft(next).errors.passkey).toBeUndefined();
  });

  it('preserves valid legacy Passkeys for TNode and drops them for Piggo on address changes', () => {
    const draft: SiteDraft = {
      ...fixture(), architecture: 'haidan', scheme: 3, address: 'https://haidan.cc',
      cookie: 'session=fixture', pages: [{ ...createManualPage('haidan'), name: 'All' }],
    };
    const tnode = changeDraftField(draft, 'address', 'https://zhuque.in');
    expect(tnode.passkey).toBe(draft.passkey);
    expect(validateDraft(tnode).valid).toBe(true);
    expect(changeDraftField(draft, 'address', 'https://piggo.me').passkey).toBeNull();
  });

  it('deletes only the edited credential warning and keeps the source immutable', () => {
    const draft = {
      ...fixture(),
      fieldWarnings: { token: { code: 'contextReadFailed' }, cookie: { code: 'contextReadFailed' } },
    } satisfies SiteDraft;
    const next = changeDraftField(draft, 'token', '');
    expect(next.token).toBeNull();
    expect(next.fieldWarnings).toEqual({ cookie: { code: 'contextReadFailed' } });
    expect(draft.fieldWarnings).toHaveProperty('token');
    expect(changeDraftField(next, 'name', next.name)).toBe(next);
  });

  it('recognizes only editable fields', () => {
    expect(isDraftField('importUserAgent')).toBe(true);
    expect(isDraftField('architecture')).toBe(false);
    expect(isDraftField('constructor')).toBe(false);
  });
});

describe('draft architecture changes', () => {
  it('keeps an emptied page list empty when switching architectures', () => {
    const draft: SiteDraft = { ...fixture(), architecture: 'nexusphp', scheme: 0, pages: [] };
    const next = changeDraftArchitecture(draft, 'gazelle');
    expect(next.pages).toEqual([]);
    expect(validateDraft(next).errors.pages?.code).toBe('pagesCount');
  });

  it.each([
    ['https://zhuque.in', 'tnode'],
    ['https://piggo.me', 'piggo'],
  ])('clears an invalid hidden Passkey when switching to the API protocol for %s', (address, architecture) => {
    const draft: SiteDraft = {
      ...fixture(), architecture: 'nexusphp', scheme: 0, address,
      cookie: 'session=fixture', passkey: 'invalid pass key',
      pages: [{ ...createManualPage('nexusphp'), name: 'All' }],
    };
    expect(validateDraft(draft).errors.passkey?.code).toBe('passkeyInvalid');
    const next = changeDraftArchitecture(draft, 'api');
    expect(next.architecture).toBe(architecture);
    expect(next.passkey).toBeNull();
    expect(validateDraft(next).errors.passkey).toBeUndefined();
  });

  it('preserves a valid legacy Passkey when switching to TNode', () => {
    const draft: SiteDraft = {
      ...fixture(), architecture: 'nexusphp', scheme: 0, address: 'https://zhuque.in',
      cookie: 'session=fixture', pages: [{ ...createManualPage('nexusphp'), name: 'All' }],
    };
    const next = changeDraftArchitecture(draft, 'api');
    expect(next.passkey).toBe(draft.passkey);
    expect(validateDraft(next).valid).toBe(true);
  });

  it('clears M-Team-only credentials and converts default paths on explicit NP switch', () => {
    const draft = fixture();
    draft.pages.push({ ...createManualPage('mtorrent'), name: 'Movies', path: '/browse/movie' });
    const next = changeDraftArchitecture(draft, 'nexusphp');
    expect(next).toMatchObject({
      architecture: 'nexusphp', scheme: 0, token: null, webToken: null,
      webDeviceId: null, webVisitorId: null, passkey: draft.passkey, fieldWarnings: {},
    });
    expect(next.pages.map(({ path }) => path)).toEqual(['/torrents.php', '/browse/movie']);
    expect(draft.pages[0]?.path).toBe('/browse');
  });
});
