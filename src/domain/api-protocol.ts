import type { ArchitectureId } from './types';
export function apiProtocol(address: string): ArchitectureId | null {
  try {
    const u = new URL(address);
    if ((u.protocol !== 'https:' && !(u.protocol === 'http:' && u.hostname === 'cinemageddon.net')) || u.port || u.username || u.password) return null;
    const domains: Record<string, ArchitectureId> = {
      'beyond-hd.me':'beyondhd',
      'exoticaz.to':'exoticaz','filelist.io':'filelist','cinemageddon.net':'cinemageddon',
      'hdbits.org':'hdbits','karagarga.in':'karagarga','www.torrentleech.org':'torrentleech','star-space.net':'ying','iptorrents.com':'iptorrents','www.yzyy.org':'yzyy',
      'zhuque.in':'tnode', 'www.zhuque.in':'tnode',
      'm-team.cc':'mtorrent', 'm-team.io':'mtorrent',
      'h5.m-team.cc':'mtorrent', 'h5.m-team.io':'mtorrent',
      'api.m-team.cc':'mtorrent', 'api.m-team.io':'mtorrent',
      'kp.m-team.cc':'mtorrent', 'kp.m-team.io':'mtorrent',
      'zp.m-team.cc':'mtorrent', 'zp.m-team.io':'mtorrent',
      'haidan.cc':'haidan', 'www.haidan.cc':'haidan', 'sunnypt.top':'sunnypt', 'rousi.pro':'rousi', 'www.yemapt.org':'yema', 'www.colapt.com':'cola',
    };
    return domains[u.hostname] ?? null;
  } catch { return null; }
}
export const independentApis = new Set<ArchitectureId>(['exoticaz','filelist','cinemageddon','hdbits','karagarga','torrentleech','ying','iptorrents','yzyy','api','beyondhd','tnode','mtorrent','haidan','sunnypt','rousi','yema','cola']);
