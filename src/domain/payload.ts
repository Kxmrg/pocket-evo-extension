import { deflateSync } from 'fflate';
import QRCode from 'qrcode';
import { validateDraft } from './validate-draft';
import type { SiteDraft } from './adapt-site';

export interface EncodedPayload { text: string; compressedBytes: number; sourceBytes: number; }
export const QR_ERROR_CORRECTION_LEVEL = 'L' as const;
const splitTags = (value: string | null) => [...new Set((value ?? '').split(',').map(s=>s.trim()).filter(Boolean))];
export function buildImportPayload(draft: SiteDraft) {
  const validation = validateDraft(draft);
  if (!validation.valid) throw new Error(Object.values(validation.errors)[0]);
  const mt = draft.architecture === 'mtorrent';
  return { protocol: 'pocket-evo.site', version: 1, site: {
    family: draft.architecture === 'nexusphp' ? 'nexusphp' : 'api', name: draft.name.trim(), address: draft.address.trim(),
    entries: draft.pages.filter(p=>p.selected).map(p=>({name:p.name.trim(),path:p.path})),
    ...(draft.importUserAgent && draft.userAgent ? {userAgent:draft.userAgent} : {}),
    ...(draft.tags ? {tags:splitTags(draft.tags)} : {}),
    ...(draft.downloadTags ? {downloadTags:splitTags(draft.downloadTags)} : {}),
    secrets: mt ? {apiKey:draft.token,mtUid:draft.passkey,
      ...(draft.webToken ? {webToken:draft.webToken} : {}),
      ...(draft.webDeviceId ? {webDeviceId:draft.webDeviceId} : {}),
      ...(draft.webVisitorId ? {webVisitorId:draft.webVisitorId} : {}),
    } : {cookie:draft.cookie,...(draft.passkey ? {passkey:draft.passkey} : {})},
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
    throw new Error('二维码数据过大，请减少种子页面后重试');
  }
}

export function encodeImportPayload(draft: SiteDraft): EncodedPayload {
  const source = new TextEncoder().encode(JSON.stringify(buildImportPayload(draft)));
  const compressed = deflateSync(source, { level: 9 });
  const text = `pocket-evo://import/site?v=1&data=${toBase64Url(compressed)}`;
  assertQrCapacity(text);
  return { text, compressedBytes: compressed.byteLength, sourceBytes: source.byteLength };
}
