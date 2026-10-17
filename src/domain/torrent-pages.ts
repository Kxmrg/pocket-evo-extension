import { apiProtocol } from './api-protocol';
import type { ArchitectureId, PageSnapshot } from './types';

export interface DraftPage {
  name: string;
  path: string;
  tags: string | null;
  selected: boolean;
}

const defaultPathByArchitecture: Partial<Record<ArchitectureId, string>> = {
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
  private: '/torrents',
};

export function draftPageFromSnapshot(snapshot: PageSnapshot, name: string): DraftPage | null {
  try {
    const current = new URL(snapshot.url);
    return {
      name,
      path: apiProtocol(current.origin) === 'yema' && current.hash.startsWith('#/') ? current.hash.slice(1) : `${current.pathname || '/'}${current.search}`,
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
