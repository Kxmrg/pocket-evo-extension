import type { ArchitectureId } from './types';
export function apiProtocol(address: string): ArchitectureId | null {
  try {
    const u = new URL(address);
    if (u.protocol !== 'https:' || u.port || u.username || u.password) return null;
    const domains: Record<string, ArchitectureId> = {
      'beyond-hd.me':'beyondhd',
      'zhuque.in':'tnode', 'www.zhuque.in':'tnode',
      'api.m-team.cc':'mtorrent', 'api.m-team.io':'mtorrent',
      'kp.m-team.cc':'mtorrent', 'kp.m-team.io':'mtorrent',
      'zp.m-team.cc':'mtorrent', 'zp.m-team.io':'mtorrent',
      'haidan.cc':'haidan', 'www.haidan.cc':'haidan', 'sunnypt.top':'sunnypt', 'rousi.pro':'rousi', 'www.yemapt.org':'yema', 'www.colapt.com':'cola',
    };
    return domains[u.hostname] ?? null;
  } catch { return null; }
}
export const independentApis = new Set<ArchitectureId>(['api','beyondhd','tnode','mtorrent','haidan','sunnypt','rousi','yema','cola']);
