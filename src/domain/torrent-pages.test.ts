import {expect,it} from 'vitest';
import {extractTorrentPages,draftPageFromSnapshot,createManualPage} from './torrent-pages';
import {fixture} from './evo-fixture';
import {buildImportPayload} from './payload';
import type {PageSnapshot} from './types';
function snapshot(url:string,links:PageSnapshot['links']=[]):PageSnapshot{return {url,origin:new URL(url).origin,host:new URL(url).hostname,title:'Test',userAgent:'Fixture',meta:[],resources:[],links,textSample:'',storage:[],candidates:[]};}
it('finds TTG browse.php and AGSV torrents.php from same-origin navigation',()=>{
 for(const path of ['/browse.php','/torrents.php']) expect(extractTorrentPages('nexusphp',snapshot('https://pt.example/index.php',[{text:'综合',href:'https://pt.example'+path}]))[0]?.path).toBe(path);
});
it('does not treat current category, homepage, detail or external links as the default',()=>{
 expect(extractTorrentPages('nexusphp',snapshot('https://pt.example/torrents.php?cat=401'))[0]?.path).toBe('/torrents.php');
 expect(extractTorrentPages('nexusphp',snapshot('https://pt.example/index.php',[{text:'综合',href:'https://evil.invalid/browse.php'}]))[0]?.path).toBe('/torrents.php');
});
it('always starts MT at browse, including when reading API settings',()=>{for(const path of ['/index','/usercp','/browse/adult'])expect(extractTorrentPages('mtorrent',snapshot('https://kp.m-team.cc'+path))[0]?.path).toBe('/browse');});
it('preserves explicitly added category query',()=>{expect(draftPageFromSnapshot(snapshot('https://kp.m-team.cc/browse?team=44&team=9'),'官组')?.path).toBe('/browse?team=44&team=9');expect(createManualPage('mtorrent').path).toBe('/browse');});
it.each([
  ['https://kp.m-team.cc/browse/tvshow?countries=8', '/browse/tvshow?countries=8'],
  ['https://h5.m-team.cc/index#/torrents?mode=tvshow&countries=8&countries=9&page=3', '/browse/tvshow?countries=8&countries=9'],
])('preserves country filters from %s in the import payload', (url, path) => {
  const page = draftPageFromSnapshot(snapshot(url), 'TV', 'mtorrent');
  expect(page).not.toBeNull();
  const draft = fixture('mtorrent');
  draft.pages.push(page!);
  expect(buildImportPayload(draft).site.entries).toContainEqual({name: 'TV', path});
});
it('uses Tnode search and offers no unsupported architecture defaults',()=>{expect(extractTorrentPages('tnode',snapshot('https://zhuque.in/'))[0]?.path).toBe('/torrent/search');expect(extractTorrentPages('unknown',snapshot('https://example.com/'))).toEqual([]);});
it('converts mobile MT categories to API entry syntax',()=>{
  expect(draftPageFromSnapshot(snapshot('https://h5.m-team.cc/index#/torrents?mode=movie&cat=401&sources=2&page=3'),'电影')?.path).toBe('/browse/movie?cat=401&source=2');
  expect(draftPageFromSnapshot(snapshot('https://h5.m-team.io/index#/torrents?onlyFav=1'),'收藏')).toBeNull();
});

it('uses the HXPT web entry for manual pages and keeps explicit category filters', () => {
  const origin = 'https://www.hxpt.org';
  expect(createManualPage('nexusphp', origin).path).toBe('/torrents');
  expect(createManualPage('nexusphp', origin + '.example').path).toBe('/torrents.php');
  expect(draftPageFromSnapshot(snapshot(origin + '/torrents?category_id=1&p=5'), '电影', 'nexusphp')?.path)
    .toBe('/torrents?category_id=1');
  expect(draftPageFromSnapshot(snapshot(origin + '/torrent/42'), '详情', 'nexusphp')).toBeNull();
});
