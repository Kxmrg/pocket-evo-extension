import { usesHxptWebSession } from './hxpt';
import {independentHtml} from './independent-html';
import { deflateSync } from 'fflate';
import QRCode from 'qrcode';
import { normalizeEntryPath } from './torrent-pages';
import { validateDraft } from './validate-draft';
import { splitTags } from './site-tags';
import { ImportPayloadError } from './import-issue';
import type { SiteDraft } from './adapt-site';

export interface EncodedPayload { text: string; compressedBytes: number; sourceBytes: number; }
export const QR_ERROR_CORRECTION_LEVEL = 'L' as const;
const MAX_DECODED_PAYLOAD_BYTES = 256 * 1024;
export function buildImportPayload(draft: SiteDraft) {
  const validation = validateDraft(draft);
  if (!validation.valid) throw new ImportPayloadError(Object.values(validation.errors)[0]!);
  const mt = draft.architecture === 'mtorrent';
  const tags = splitTags(draft.tags);
  const downloadTags = splitTags(draft.downloadTags);
  return { protocol: 'pocket-evo.site', version: 1, site: {
    family: draft.architecture === 'gazelle' ? 'gazelle' : draft.architecture === 'nexusphp' ? 'nexusphp' : draft.architecture === 'unit3d' ? 'unit3d' : draft.architecture === 'btitracker' ? 'btitracker' : 'api', name: draft.name.trim(), address: draft.address.trim(),
    entries: draft.pages.filter(p=>p.selected).map(p=>({name:p.name.trim(),path:normalizeEntryPath(draft.architecture,p.path)})),
    ...(draft.importUserAgent && draft.userAgent ? {userAgent:draft.userAgent} : {}),
    ...(tags.length ? {tags} : {}),
    ...(downloadTags.length ? {downloadTags} : {}),
    secrets: draft.architecture === 'piggo' ? {pigToken:draft.token,pigVisitorId:draft.pigVisitorId} : mt ? {apiKey:draft.token,mtUid:draft.passkey,
      ...(draft.webToken ? {webToken:draft.webToken} : {}),
      ...(draft.webDeviceId ? {webDeviceId:draft.webDeviceId} : {}),
      ...(draft.webVisitorId ? {webVisitorId:draft.webVisitorId} : {}),
    } : {cookie:draft.cookie,...(!independentHtml.has(draft.architecture) && !['gazelle','unit3d','btitracker','beyondhd'].includes(draft.architecture) && !usesHxptWebSession(draft.architecture, draft.address) && draft.passkey ? {passkey:draft.passkey} : {})},
  }};
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 2_048;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    for (const byte of chunk) binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function assertQrCapacity(text: string): void {
  try {
    QRCode.create(text, { errorCorrectionLevel: QR_ERROR_CORRECTION_LEVEL });
  } catch {
    throw new ImportPayloadError({ code: 'qrCapacity' });
  }
}

export function encodeImportPayload(draft: SiteDraft): EncodedPayload {
  const source = new TextEncoder().encode(JSON.stringify(buildImportPayload(draft)));
  if (source.byteLength > MAX_DECODED_PAYLOAD_BYTES) throw new ImportPayloadError({ code: 'decodedPayloadTooLarge' });
  const compressed = deflateSync(source, { level: 9 });
  const text = `pocket-evo://import/site?v=1&data=${toBase64Url(compressed)}`;
  assertQrCapacity(text);
  return { text, compressedBytes: compressed.byteLength, sourceBytes: source.byteLength };
}
