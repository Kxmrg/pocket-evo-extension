import { independentHtml } from './independent-html';
import { apiProtocol } from './api-protocol';
import type { SiteDraft } from './adapt-site';
import { entryError } from './evo-entry';
import type { ImportIssue } from './import-issue';
import { normalizeEntryPath, type DraftPage } from './torrent-pages';
import { splitTags } from './site-tags';
import type { ArchitectureId } from './types';

export interface DraftValidation { valid: boolean; errors: Record<string, ImportIssue>; }
function validPiggoToken(token: string | null): boolean {
  if (!token || token.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return false;
  try {
    const payload = token.split('.')[1]!;
    const binary = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return false;
    const expiry = (decoded as Record<string, unknown>).exp;
    return expiry == null || typeof expiry === 'number' && Number.isFinite(expiry) && expiry > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function selectedPageIssue(architecture: ArchitectureId, pages: DraftPage[]): ImportIssue | null {
  const selected = pages.map((page, index) => ({ page, index })).filter(({ page }) => page.selected);
  if (!selected.length || selected.length > 50) return { code: 'pagesCount' };

  const unnamed = selected.find(({ page }) => !page.name.trim());
  if (unnamed) return { code: 'pageNameRequired', index: unnamed.index };
  const longName = selected.find(({ page }) => Array.from(page.name.trim()).length > 40);
  if (longName) return { code: 'pageNameTooLong', index: longName.index };

  const names = new Set<string>();
  for (const { page, index } of selected) {
    const name = page.name.trim().toLowerCase();
    if (names.has(name)) return { code: 'pageNameDuplicate', index };
    names.add(name);
  }

  for (const { page, index } of selected) {
    const issue = entryError(architecture, page.path)
      ?? entryError(architecture, normalizeEntryPath(architecture, page.path));
    if (issue) return { ...issue, index };
  }
  return null;
}

export function validateDraft(draft: SiteDraft): DraftValidation {
  const errors: Record<string, ImportIssue> = {};
  const expected: Record<string,number> = {nexusphp:0,tnode:1,mtorrent:2,haidan:3,sunnypt:4,rousi:5,yema:6,cola:7,piggo:8};
  if (!independentHtml.has(draft.architecture) && !['gazelle','unit3d','btitracker','beyondhd'].includes(draft.architecture) && (draft.scheme === null || expected[draft.architecture] !== draft.scheme)) errors.architecture = { code: 'architectureUnsupported' };
  if (draft.architecture !== 'gazelle' && draft.architecture !== 'nexusphp' && draft.architecture !== 'unit3d' && draft.architecture !== 'btitracker' && apiProtocol(draft.address) !== draft.architecture) errors.address = { code: 'addressUnsupported' };
  if (!draft.name.trim()) errors.name = { code: 'nameRequired' };
  else if (Array.from(draft.name.trim()).length > 20) errors.name = { code: 'nameTooLong' };
  try {
    const address = draft.address.trim();
    // WHATWG URL repairs missing slashes, backslashes and embedded line breaks;
    // Evo receives the original text and requires an actual root origin.
    if (address.length > 2048 || /[\s\x00-\x1f\\]/.test(address) || !/^https?:\/\/[^/?#]+\/?$/i.test(address)) throw new Error();
    const u = new URL(address);
    if (!['http:','https:'].includes(u.protocol) || !u.hostname || u.username || u.password || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')) throw new Error();
  } catch { errors.address = { code: 'addressInvalid' }; }
  if (draft.architecture !== 'mtorrent' && draft.architecture !== 'piggo' && (!draft.cookie.trim() || draft.cookie.length > 16384 || /[\r\n]/.test(draft.cookie))) errors.cookie = { code: 'cookieInvalid' };
  if (draft.architecture !== 'mtorrent' && ((draft.passkey?.length ?? 0)>256 || /[\s\x00-\x1f]/.test(draft.passkey ?? ''))) errors.passkey = { code: 'passkeyInvalid' };
  if (draft.architecture === 'mtorrent') {
    if (!draft.token?.trim()) errors.token = { code: 'apiKeyRequired' };
    if (!/^[1-9][0-9]{0,19}$/.test(draft.passkey ?? '')) errors.passkey = { code: 'uidInvalid' };
    const fields = [['token', 'API Key'], ['webToken', 'Auth'], ['webDeviceId', 'DID'], ['webVisitorId', 'VID']] as const;
    for (const [key, field] of fields) {
      if ((draft[key]?.length ?? 0)>16384 || /[\s\x00-\x1f]/.test(draft[key] ?? '')) {
        errors[key] = { code: 'credentialInvalid', field };
      }
    }
  }
  if (draft.architecture === 'piggo' && !validPiggoToken(draft.token)) errors.token = { code: 'pigTokenInvalid' };
  if (draft.architecture === 'piggo' && !/^[0-9a-f]{32}$/.test(draft.pigVisitorId ?? '')) errors.pigVisitorId = { code: 'pigVisitorMissing' };
  if (draft.importUserAgent && ((draft.userAgent?.length ?? 0)>512 || /[\r\n]/.test(draft.userAgent ?? ''))) errors.userAgent = { code: 'userAgentInvalid' };
  const pageIssue = selectedPageIssue(draft.architecture, draft.pages);
  if (pageIssue) errors.pages = pageIssue;
  for (const k of ['tags','downloadTags'] as const) {
    const tags=splitTags(draft[k]);
    if (tags.length>20 || tags.some(s=>Array.from(s).length>40)) errors[k] = { code: 'tagsLimit' };
  }
  return {valid:!Object.keys(errors).length,errors};
}
