import { apiProtocol } from './api-protocol';
import type { ArchitectureId, DetectionResult, PageSnapshot } from './types';
import { privateSiteForHost } from './private-sites';

interface ScoreResult {
  id: ArchitectureId;
  score: number;
  explicit: boolean;
  reasons: string[];
  supported: boolean;
}

function isHost(host: string, root: string): boolean {
  const normalized = host.toLowerCase().replace(/\.$/, '');
  return normalized === root || normalized.endsWith(`.${root}`);
}

function searchable(snapshot: PageSnapshot): string {
  return [
    snapshot.textSample,
    ...snapshot.meta.flatMap((item) => [item.name, item.property, item.content]),
    ...snapshot.resources,
  ].join('\n').toLowerCase();
}

function hrefs(snapshot: PageSnapshot): string[] {
  return snapshot.links.map((link) => link.href.toLowerCase());
}

function scoreUnit3d(snapshot: PageSnapshot): ScoreResult {
  const haystack = searchable(snapshot);
  const links = hrefs(snapshot);
  const markers = new Set(snapshot.domMarkers ?? []);
  const exactGenerator = snapshot.meta.some((item) =>
    item.name.toLowerCase() === 'generator' && /^unit3d(?:\s|$)/i.test(item.content.trim()));
  const productIdentity = /powered by\s+unit3d|unit3d-rs\s*\(core\)|unit3d-announce/.test(haystack);
  const explicit = exactGenerator || productIdentity || markers.has('unit3d-footer');
  const routeCount = [
    links.some((href) => /\/torrents(?:[/?#]|$)/.test(href)),
    links.some((href) => /\/users\/[^/?#]+/.test(href)),
    links.some((href) => /\/forums(?:[/?#]|$)/.test(href)),
    links.some((href) => /\/rss(?:[/?#]|$)/.test(href)),
  ].filter(Boolean).length;
  const hasTable = markers.has('unit3d-torrent-table');
  const hasRow = markers.has('unit3d-torrent-row');
  const hasApiRoute = links.some((href) => /\/api\/torrents\/(?:filter|search)/.test(href));
  const hasAssets = /\/build\/assets\//.test(haystack);
  const structuralScore = (routeCount >= 3 ? 2 : 0) + (hasTable ? 2 : 0) +
    (hasRow ? 2 : 0) + (hasApiRoute ? 2 : 0) + (hasAssets ? 1 : 0);
  const reasons = [
    ...(explicit ? ['检测到 UNIT3D 标识'] : []),
    ...(routeCount >= 3 ? ['检测到 UNIT3D 标准路由组合'] : []),
    ...(hasTable ? ['检测到 UNIT3D 种子表结构'] : []),
    ...(hasRow ? ['检测到 UNIT3D 种子行结构'] : []),
    ...(hasApiRoute ? ['检测到 UNIT3D API 路由'] : []),
    ...(hasAssets ? ['检测到 UNIT3D/Laravel 资源'] : []),
  ];
  return {
    id: 'unit3d',
    score: (explicit ? 10 : 0) + structuralScore,
    explicit,
    reasons,
    supported: explicit || structuralScore >= 5,
  };
}

function scoreGazelle(snapshot: PageSnapshot): ScoreResult {
  const haystack = searchable(snapshot);
  const links = hrefs(snapshot);
  const markers = new Set(snapshot.domMarkers ?? []);
  const hasGazelleBrand = /(?:powered by\s+)?gazelle/.test(haystack);
  const hasGazellePwSignature = markers.has('gazellepw-cover-wall') && markers.has('gazellepw-movie-filters');
  const hasClassicStructure = [
    'body#torrents',
    'gazelle-grouping-table',
    'gazelle-group-row',
    'gazelle-torrent-row',
  ].every((marker) => markers.has(marker));
  const hasPtpHtmlStructure = markers.has('ptp-movie-routes') && markers.has('ptp-group-table');
  const hasBtnHtmlStructure = markers.has('btn-series-links') && markers.has('btn-torrent-actions');
  const routeSignals = [
    links.some((href) => /\/ajax\.php\?action=/.test(href)),
    links.some((href) => /\/collages\.php(?:[?#]|$)/.test(href)),
    links.some((href) => /\/requests\.php(?:[?#]|$)/.test(href)),
  ];
  const hasIndependentCommonRoutes = routeSignals.filter(Boolean).length >= 2;
  const explicit = hasGazelleBrand && hasIndependentCommonRoutes;
  const reasons = [
    ...(hasGazellePwSignature ? ['检测到 GazellePW 海报墙/筛选结构'] : []),
    ...(hasClassicStructure ? ['检测到 Gazelle 分组种子表结构'] : []),
    ...(hasPtpHtmlStructure ? ['检测到 PTP HTML Gazelle 结构'] : []),
    ...(hasBtnHtmlStructure ? ['检测到 BTN HTML Gazelle 结构'] : []),
    ...(explicit ? ['检测到 Gazelle 标识和独立路由'] : []),
    ...(routeSignals[0] ? ['检测到 Gazelle AJAX 路由'] : []),
    ...(routeSignals[1] ? ['检测到 Gazelle 合集路由'] : []),
    ...(routeSignals[2] ? ['检测到 Gazelle 求种路由'] : []),
  ];
  const hasSupportedStructure = hasGazellePwSignature || hasClassicStructure ||
    hasPtpHtmlStructure || hasBtnHtmlStructure;
  const score = hasSupportedStructure ? 4 : explicit ? 3 : 0;
  return {
    id: 'gazelle',
    score,
    explicit,
    reasons,
    supported: hasSupportedStructure || explicit,
  };
}

function scoreNexusPhp(snapshot: PageSnapshot): ScoreResult {
  const haystack = searchable(snapshot);
  const links = hrefs(snapshot);
  const explicit = /(?:powered by\s+)?nexusphp/.test(haystack);
  const signals = [
    links.some((href) => /\/(?:torrents|browse)\.php(?:[?#]|$)/.test(href)),
    links.some((href) => /\/download\.php\?[^#]*\bid=|\/dl\/\d+\/\d+(?:[/?#]|$)/.test(href)),
    links.some((href) => /\/details\.php\?[^#]*\bid=/.test(href)),
    links.some((href) => /\/userdetails\.php\?[^#]*\bid=/.test(href)),
    /nexusphp|\/styles\/.*nexus/.test(haystack),
  ];
  const reasons = [
    ...(explicit ? ['检测到 NexusPHP 标识'] : []),
    ...(signals[0] ? ['检测到 NexusPHP 种子列表路由'] : []),
    ...(signals[1] ? ['检测到 NexusPHP 下载路由'] : []),
    ...(signals[2] ? ['检测到 details.php'] : []),
    ...(signals[3] ? ['检测到 userdetails.php'] : []),
    ...(!explicit && signals[4] ? ['检测到 NexusPHP 资源'] : []),
  ];
  return { id: 'nexusphp', score: (explicit ? 10 : 0) + signals.filter(Boolean).length, explicit, reasons, supported: true };
}

function fixed(id: ArchitectureId, reason: string): DetectionResult {
  return { id, supported: ['gazelle','exoticaz','filelist','cinemageddon','hdbits','karagarga','torrentleech','ying','iptorrents','btitracker', 'unit3d', 'beyondhd', 'nexusphp', 'tnode', 'mtorrent', 'haidan', 'sunnypt', 'rousi', 'yema', 'cola'].includes(id), confidence: 'certain', reasons: [reason] };
}

function detectionFromScore(result: ScoreResult): DetectionResult {
  return {
    id: result.id,
    supported: result.supported && ['gazelle','exoticaz','filelist','cinemageddon','hdbits','karagarga','torrentleech','ying','iptorrents','btitracker', 'unit3d', 'beyondhd', 'nexusphp', 'tnode', 'mtorrent', 'haidan', 'sunnypt', 'rousi', 'yema', 'cola'].includes(result.id),
    confidence: result.explicit ? 'certain' : 'likely',
    reasons: result.reasons,
  };
}

export function detectArchitecture(snapshot: PageSnapshot): DetectionResult {
  // Adapted NP fork: its homepage brands itself PTT-NP and exposes only two
  // generic route signals. Keep the override limited to verified site hosts.
  const host = snapshot.host.toLowerCase().replace(/\.$/, '');
  if (host === 'www.uhddolby.com') return fixed('nexusphp', '已适配高清杜比域名');
  if (host === 'pttime.org' || host === 'www.pttime.org') {
    return fixed('nexusphp', '已适配 PTTime / PTT-NP 域名');
  }
  if (isHost(snapshot.host, 'hd-space.org') || isHost(snapshot.host, 'hd-torrents.org') || /powered by\s+(?:btitracker|xbtit)\b/i.test(searchable(snapshot))) return fixed('btitracker', 'BtiTracker / xbtit');
  const api = apiProtocol(snapshot.origin);
  if (api) return fixed(api, '独立架构站点：按域名识别');
  const privateSite = privateSiteForHost(snapshot.host);
  if (privateSite && privateSite.id !== 'beyondhd') return fixed('private', `固定 Private 域名：${privateSite.root}`);

  if (['alpharatio.cc','anthelion.me','broadcasthe.net','brokenstones.is','dicmusic.com','gazellegames.net','hdf.world','passthepopcorn.me','redacted.sh','emparadise.rs','greatposterwall.com','jpopsuki.eu'].some(host => isHost(snapshot.host, host))) return fixed('gazelle', 'Gazelle / HTML');

  if (isHost(snapshot.host, 'eiga.moi') || isHost(snapshot.host, 'blutopia.cc') || isHost(snapshot.host, 'lst.gg') || isHost(snapshot.host, 'seedpool.org')) return fixed('unit3d', '固定 UNIT3D 域名');

  const gazelle = scoreGazelle(snapshot);
  if (gazelle.score >= 4) return detectionFromScore(gazelle);

  for (const result of [scoreUnit3d(snapshot), gazelle, scoreNexusPhp(snapshot)]) {
    if (result.explicit || result.score >= 3) {
      return detectionFromScore(result);
    }
  }

  return { id: 'unknown', supported: false, confidence: 'unknown', reasons: [] };
}
