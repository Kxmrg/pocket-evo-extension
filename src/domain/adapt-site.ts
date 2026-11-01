import {independentHtml,independentHtmlNames} from './independent-html';
import { selectCandidate, type FieldCandidate } from './candidates';
import { extractTorrentPages, type DraftPage } from './torrent-pages';
import type { ArchitectureId, DetectionResult, PageSnapshot } from './types';
import { privateSiteForHost } from './private-sites';
import { extractSiteCategories } from './site-categories';
import { mapCategoriesToTags } from './site-tags';

export interface SiteDraft {
  architecture: ArchitectureId;
  scheme: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | null;
  name: string;
  address: string;
  cookie: string;
  webToken: string | null;
  webDeviceId: string | null;
  webVisitorId: string | null;
  pages: DraftPage[];
  passkey: string | null;
  userAgent: string | null;
  importUserAgent: boolean;
  tags: string | null;
  downloadTags: string | null;

  token: string | null;
  pigVisitorId?: string | null;


  fieldWarnings: Record<string, string>;
  alternatives: Record<string, FieldCandidate[]>;
}

export interface AdaptSiteInput {
  detection: DetectionResult;
  snapshot: PageSnapshot;
  cookieHeader: string;
}

const schemeMap: Partial<Record<ArchitectureId, 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>> = {
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

function siteName(snapshot: PageSnapshot, id: ArchitectureId): string {
  if (independentHtml.has(id)) return independentHtmlNames[id]!;
  if (id === 'beyondhd') return 'BeyondHD';
  if (id === 'rousi') return 'Rousi';
  if (id === 'yema') return 'YemaPT';
  if (id === 'cola') return '可乐';
  if (id === 'piggo') return '猪猪';
  if (id === 'private') return privateSiteForHost(snapshot.host)?.name ?? snapshot.host;
  const withoutGenerator = snapshot.title.replace(/\s*[-|｜:]?\s*Powered by\b.*$/i, '');
  if (id === 'unit3d') {
    const finalSegment = withoutGenerator.split(/\s+(?:-|::|\||｜)\s+/).at(-1)?.trim();
    if (finalSegment) return finalSegment;
  }
  if (id === 'gazelle') {
    const finalSegment = withoutGenerator.split('::').at(-1)?.trim();
    if (finalSegment) return finalSegment;
  }
  const brand = withoutGenerator.split(/\s+(?:-|::|\||｜)\s+/)[0] ?? '';
  const cleaned = brand
    .replace(/\s*[-|｜]\s*(?:首页|home|index)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/(^|\.)agsvpt\.(cn|com)$/.test(snapshot.host)) return 'AGSVPT';
  return Array.from(cleaned || snapshot.host).slice(0, 20).join('');
}

function siteAddress(id: ArchitectureId, snapshot: PageSnapshot): string {
  if (id !== 'mtorrent') return snapshot.origin.replace(/\/$/, '');
  const io = snapshot.host === 'm-team.io' || snapshot.host.endsWith('.m-team.io');
  const mobile = snapshot.host === 'h5.m-team.cc' || snapshot.host === 'h5.m-team.io';
  return `https://${mobile ? 'h5' : io ? 'zp' : 'kp'}.m-team.${io ? 'io' : 'cc'}`;
}

function addSelectionMetadata(
  field: string,
  label: string,
  selection: ReturnType<typeof selectCandidate>,
  warnings: Record<string, string>,
  alternatives: Record<string, FieldCandidate[]>,
): void {
  if (selection.alternatives.length > 0) alternatives[field] = selection.alternatives;
  if (!selection.value) warnings[field] = `未自动获取 ${label}`;
  else if (selection.needsConfirmation) warnings[field] = `${label} 存在多个候选，请确认`;
}

export function adaptSite({ detection, snapshot, cookieHeader }: AdaptSiteInput): SiteDraft {
  const warnings: Record<string, string> = {};
  const alternatives: Record<string, FieldCandidate[]> = {};
  const passkey = selectCandidate('passkey', snapshot);
  const cookie = detection.id === 'mtorrent' || detection.id === 'piggo' ? '' : cookieHeader;
  let mTorrentUid = '';
  let webToken = '';
  let webDeviceId = '';
  let webVisitorId = '';
  let token = '';
  let pigVisitorId = '';

  if (detection.id === 'mtorrent') {
    const uid = selectCandidate('uid', snapshot);
    const loginToken = selectCandidate('webToken', snapshot);
    const deviceId = selectCandidate('webDeviceId', snapshot);
    const visitorId = selectCandidate('webVisitorId', snapshot);
    mTorrentUid = uid.value;
    webToken = loginToken.value;
    webDeviceId = deviceId.value;
    webVisitorId = visitorId.value;
    token = '';
    addSelectionMetadata('passkey', 'UID', uid, warnings, alternatives);
    addSelectionMetadata('webToken', 'Auth（可选）', loginToken, warnings, alternatives);
    addSelectionMetadata('webDeviceId', 'DID（可选）', deviceId, warnings, alternatives);
    addSelectionMetadata('webVisitorId', 'VID（可选）', visitorId, warnings, alternatives);
    warnings.token = '请前往控制台实验室复制令牌并手动填写';
  }

  if (detection.id === 'piggo') {
    // Only the exact Piggo HTTPS origin may supply this site's bearer token.
    if (snapshot.origin === 'https://piggo.me' && snapshot.host === 'piggo.me' &&
        new URL(snapshot.url).origin === snapshot.origin) {
      token = snapshot.storage.find((entry) => entry.area === 'local' && entry.key === 'pig_token')?.value ?? '';
      if (/^[0-9a-f]{32}$/.test(snapshot.pigVisitorId ?? '')) pigVisitorId = snapshot.pigVisitorId!;
    }
    if (!token) warnings.token = '未获取登录信息，请先登录猪猪后重试';
    if (!pigVisitorId) warnings.pigVisitorId = '未获取浏览器访客信息，请等待页面加载完成后刷新';
  }

  if (!cookie && detection.id !== 'unknown' && detection.id !== 'piggo') warnings.cookie ??= '未自动获取 Cookie';
  if (detection.id !== 'mtorrent' && detection.id !== 'piggo') {
    if (passkey.needsConfirmation) warnings.passkey = 'Passkey 存在多个候选，请确认';
    if (passkey.alternatives.length > 0) alternatives.passkey = passkey.alternatives;
  }

  const name = detection.id === 'tnode' ? 'ZhuQue' : siteName(snapshot, detection.id);
  const categories = extractSiteCategories(snapshot);
  const siteTags = mapCategoriesToTags(categories);
  return {
    architecture: detection.id,
    scheme: schemeMap[detection.id] ?? null,
    name,
    address: siteAddress(detection.id, snapshot),
    cookie,
    webToken: webToken || null,
    webDeviceId: webDeviceId || null,
    webVisitorId: webVisitorId || null,
    pigVisitorId: pigVisitorId || null,
    pages: extractTorrentPages(detection.id, snapshot),
    passkey: detection.id === 'mtorrent'
      ? mTorrentUid || null
      : independentHtml.has(detection.id) || detection.id === 'piggo' || detection.id === 'rousi' || detection.id === 'yema' || detection.id === 'cola' || detection.id === 'sunnypt' || detection.id === 'gazelle' || detection.id === 'unit3d' || detection.id === 'btitracker' || detection.id === 'private' || detection.id === 'beyondhd'
        ? null
        : passkey.value || null,
    userAgent: snapshot.userAgent || null,
    importUserAgent: true,
    tags: siteTags.length > 0 ? siteTags.join(',') : null,
    downloadTags: name,

    token: token || null,


    fieldWarnings: warnings,
    alternatives,
  };
}
