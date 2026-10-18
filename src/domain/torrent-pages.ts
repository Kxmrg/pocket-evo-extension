import {independentHtml,independentHtmlDefaults,normalizeYingEntry,normalizeKaragargaEntry} from './independent-html';
import { apiProtocol } from './api-protocol';
import type { ArchitectureId, PageSnapshot } from './types';

export interface DraftPage {
  name: string;
  path: string;
  tags: string | null;
  selected: boolean;
}

const defaultPathByArchitecture: Partial<Record<ArchitectureId, string>> = {
  ...independentHtmlDefaults,
  nexusphp: '/torrents.php',
  tnode: '/torrent/search',
  mtorrent: '/browse',
  haidan: '/torrents.php',
  sunnypt: '/torrents?category=All',
  rousi: '/torrents',
  yema: '/torrent/list',
  cola: '/browse?direction=desc&view=torrents',
  gazelle: '/torrents.php',
  unit3d: '/torrents',
  btitracker: '/index.php?page=torrents',
  private: '/torrents',
  beyondhd: '/torrents',
};

export function normalizeEntryPath(id: ArchitectureId, path: string): string {
  if (id === 'karagarga') return normalizeKaragargaEntry(path);
  if (id === 'ying') return normalizeYingEntry(path);
  if (id !== 'unit3d') return path;
  const u = new URL(path, 'https://entry.invalid');
  u.searchParams.set('view', 'list');
  return `${u.pathname}${u.search}${u.hash}`;
}

export function draftPageFromSnapshot(snapshot: PageSnapshot, name: string, architecture?: ArchitectureId): DraftPage | null {
  try {
    const current = new URL(snapshot.url);
    return {
      name,
      path: architecture === 'unit3d' || architecture === 'ying' || architecture === 'karagarga' ? normalizeEntryPath(architecture, `${current.pathname}${current.search}`) : apiProtocol(current.origin) === 'yema' && current.hash.startsWith('#/') ? current.hash.slice(1) : `${current.pathname || '/'}${current.search}`,
      tags: null,
      selected: true,
    };
  } catch {
    return null;
  }
}

export function createManualPage(id: ArchitectureId): DraftPage {
  return {
    name: '',
    path: defaultPathByArchitecture[id] ?? '/torrents.php',
    tags: null,
    selected: true,
  };
}

export function extractTorrentPages(id: ArchitectureId, snapshot: PageSnapshot): DraftPage[] {
  const page = (path: string): DraftPage[] => [{name:'综合',path,tags:null,selected:true}];
  if (id === 'ying') return [{name:'影视',path:'/p_torrent/video_list_t.php',tags:null,selected:true},{name:'音乐',path:'/p_music/music_list_t.php',tags:null,selected:true}];
  if (independentHtml.has(id)) return page(independentHtmlDefaults[id]!);
  if (id === 'btitracker') return page(snapshot.host === 'hd-torrents.org' ? '/torrents.php' : '/index.php?page=torrents');
  if (id === 'beyondhd') return page('/torrents');
  if (id === 'unit3d') {
    const u = new URL(snapshot.url);
    return page(/^\/torrents\/?$/.test(u.pathname) ? normalizeEntryPath(id, `${u.pathname}${u.search}`) : '/torrents?view=list');
  }
  if (id === 'mtorrent') return page('/browse');
  if (id === 'tnode') return page('/torrent/search');
  if (id === 'rousi') return page('/torrents');
  if (id === 'yema') return page('/torrent/list');
  if (id === 'cola') return page('/browse?direction=desc&view=torrents');
  if (id === 'haidan') return page('/torrents.php');
  if (id === 'sunnypt') return page('/torrents?category=All');
  if (id !== 'nexusphp') return [];
  const base = new URL(snapshot.url);
  const candidates = snapshot.links.flatMap(link=> {
    try {
      const u = new URL(link.href,base);
      if (u.origin !== base.origin || !/\/(?:torrents?|browse)(?:\.php)?$/i.test(u.pathname)) return [];
      return [{path:u.pathname, score: /^(综合|綜合|种子|種子|torrents?|browse|全部)$/i.test(link.text.trim()) ? 10 : 1}];
    } catch { return []; }
  });
  candidates.sort((a,b)=>b.score-a.score);
  return page(candidates[0]?.path ?? (/\/(?:torrents?|browse)(?:\.php)?$/i.test(base.pathname) ? base.pathname : '/torrents.php'));
}
