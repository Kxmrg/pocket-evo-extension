import type { ArchitectureId } from './types';

const mtModes = new Set(['normal', 'adult', 'movie', 'music', 'tvshow', 'anime', 'waterfall', 'rss', 'rankings', 'all']);
const mtFields = new Set(['cat', 'stand', 'team', 'source', 'medium', 'videoCodec', 'audioCodec']);
export function safeEntryPath(path: string): boolean {
  if (path.length > 2048 || /[\s\x00-\x1f]/.test(path)) return false;
  let decoded = path;
  try {
    for (let i = 0; i < 8; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\x00-\x1f]/.test(decoded) || decoded.split('?')[0]?.split('/').includes('..')) return false;
    const u = new URL(decoded, 'https://entry.invalid');
    return !u.hash && ![...u.searchParams.keys()].some(k => /^(passkey|authkey|token|access_token|api_key|apikey|cookie|password|authorization)$/i.test(k));
  } catch { return false; }
}
export function validEntry(architecture: ArchitectureId, path: string): boolean {
  if (!safeEntryPath(path)) return false;
  const u = new URL(path, 'https://entry.invalid');
  if (architecture === 'mtorrent') {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'browse' || parts.length > 2 || !mtModes.has(parts[1] ?? 'normal')) return false;
    return [...u.searchParams.keys()].every(k => mtFields.has(k) && u.searchParams.getAll(k).length <= 100 && u.searchParams.getAll(k).every(v => /^[1-9]\d*$/.test(v)));
  }
  if (architecture === 'tnode') {
    if (/^\/torrent\/search\/?$/.test(path)) return true;
    try {
      if (!path.startsWith('/torrent/search/')) return false;
      const value = JSON.parse(decodeURIComponent(atob(path.slice('/torrent/search/'.length))));
      const keys = new Set(['page','size','type','order','sorter','keyword','tags','category','medium','videoCoding','resolution','connStatus','downloadStatus','more']);
      if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).some(k=>!keys.has(k))) return false;
      for (const k of ['tags','category','medium','videoCoding','resolution']) if (value[k] != null && (!Array.isArray(value[k]) || value[k].length > 100 || value[k].some((v: unknown)=>!Number.isSafeInteger(v) || Number(v)<=0))) return false;
      for (const k of ['page','size']) if (value[k] != null && (!Number.isSafeInteger(value[k]) || value[k]<1)) return false;
      for (const k of ['connStatus','downloadStatus']) if (value[k] != null && (![0,1,2].includes(value[k]))) return false;
      if (value.type != null && !['title','tmdbid','imdbid'].includes(value.type)) return false;
      if (value.order != null && !['','asc','desc'].includes(value.order)) return false;
      if (value.sorter != null && !['id','upload_time','size','seeding','leeching','complete'].includes(value.sorter)) return false;
      if (value.keyword != null && (typeof value.keyword !== 'string' || value.keyword.length>1024)) return false;
      return value.more == null || typeof value.more === 'boolean';
    } catch { return false; }
  }
  if (architecture === 'cola') return u.pathname === '/browse' && [...u.searchParams.keys()].every(k => new Set(['view','direction','q','category','douban_id','imdb_id','year','genre','resolution','source','video_codec','hdr','audio','subtitle','episode','season_number','seeded','version_sort','sort','page','pageSize']).has(k) && u.searchParams.getAll(k).length===1 && (u.searchParams.get(k)?.length ?? 0)<=1024);
  if (architecture === 'rousi' || architecture === 'yema') {
    const allowed = new Set(architecture === 'rousi' ? ['q','category','promotion','sort'] : ['keyword','categoryId','uploadPromotionType','downloadPromotionType','sorterField','sorterOrder']);
    return u.pathname === (architecture === 'rousi' ? '/torrents' : '/torrent/list') && [...u.searchParams.keys()].every(k=>allowed.has(k) && u.searchParams.getAll(k).length===1 && (u.searchParams.get(k)?.length ?? 0)<=1024);
  }
  if (architecture === 'haidan') return u.pathname === '/torrents.php' && [...u.searchParams.keys()].every(k => new Set(['cat','spstate','resolutionType','movieCodeCType','audioCodeCType','mediaType','yearType','areaType','langType','styleType','search','search_area','search_mode','inclbookmarked','incldead','allsec','sort','type']).has(k) && u.searchParams.getAll(k).length === 1 && (u.searchParams.get(k)?.length ?? 0) <= 1024);
  if (architecture === 'sunnypt') return u.pathname === '/torrents' && [...u.searchParams.keys()].every(k => new Set(['category','tmdbId','keyword','resetIndex','section','promotion','sort_by','sort_order','added_after','added_before','bookmarked','health','max_completed','max_leechers','max_seeders','max_size','min_completed','min_leechers','min_seeders','min_size','owner']).has(k) && u.searchParams.getAll(k).length === 1 && (u.searchParams.get(k)?.length ?? 0) <= 1024);
  return architecture === 'nexusphp';
}

/** Describe unsupported entries without ever echoing query values or credentials. */
export function entryError(architecture: ArchitectureId, path: string): string | null {
  if (!safeEntryPath(path)) return '地址不安全或格式错误，请使用不含凭据的站内相对地址';
  if (validEntry(architecture, path)) return null;
  if (architecture === 'mtorrent') {
    const u = new URL(path, 'https://entry.invalid');
    if (!validEntry(architecture, u.pathname)) return 'MT 入口需为 /browse 或受支持的 /browse/分类';
    const unsupported = [...new Set([...u.searchParams.keys()].filter(k => !mtFields.has(k)))];
    if (unsupported.length) {
      const keys = unsupported.filter(k => /^[A-Za-z][A-Za-z0-9_]{0,30}$/.test(k));
      return `MT 暂不支持这些筛选参数${keys.length ? `：${keys.join('、')}` : ''}，请修改或取消选择此入口`;
    }
    return 'MT 分类参数必须为正整数，每类最多100个';
  }
  return '此入口路径或搜索参数不受 Evo 支持，请修改或取消选择此入口';
}
